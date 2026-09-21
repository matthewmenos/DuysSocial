// Token claim (watch-to-earn) — shared by:
//   POST /api/claim-rewards        (canonical, used by the browser wallet flow)
//   POST /api/wallet/claim-tokens  (legacy alias kept for the in-app wallet page)
//
// Flow:
//  1. In ONE transaction: row-lock the user (SELECT ... FOR UPDATE on Postgres),
//     enforce the daily claim limit + minimum-points rule, then atomically deduct
//     points (guarded `points >= spent`), write the ledger entry and create the
//     `pending` TokenClaim. Committing before the chain call means a crash leaves
//     an auditable pending claim rather than free tokens.
//  2. Transfer DUYS from the vault via viem (chain picked from BSC_CHAIN_ID).
//  3. Success -> TokenClaim "confirmed" + txHash.
//     Failure -> refund points + ledger entry, TokenClaim "failed", HTTP 502.
import { createHash } from "node:crypto";
import type { Response } from "express";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { createPublicClient, createWalletClient, http, parseUnits, type Chain } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Address } from "viem";
import type { AuthedRequest } from "../session.js";

const DUYS_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable" as const,
    type: "function",
  },
] as const;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export class ClaimError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.error ?? "claim_error"));
    this.name = "ClaimError";
  }
}

/** True when the configured database is PostgreSQL (enables row-level locking). */
export function isPostgres() {
  return config.databaseUrl.startsWith("postgresql") || config.databaseUrl.startsWith("postgres");
}

/**
 * Chain descriptor derived from BSC_CHAIN_ID / BSC_RPC_URL.
 *
 * Deliberately does NOT import "viem/chains": that module defines ~1000 chains and
 * costs >30s of on-the-fly transpile time under tsx, which made the API miss its
 * own health-check window. Building the descriptor inline is exact and instant.
 */
function activeChain(): Chain {
  return {
    id: config.bscChainId,
    name: config.bscChainId === 56 ? "BNB Smart Chain" : `BSC ${config.bscChainId}`,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [config.bscRpc] } },
  };
}

function vaultAccount(): PrivateKeyAccount {
  if (!config.vaultKey) throw new Error("VAULT_PRIVATE_KEY not configured");
  return privateKeyToAccount(config.vaultKey as `0x${string}`);
}

/** sha256 of the lower-cased address — the unique index lives here, not on the address. */
export function walletHash(address: string) {
  return createHash("sha256").update(address.toLowerCase()).digest("hex");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface ClaimResult {
  ok: true;
  txHash: string | null;
  tokens: number;
  pointsSpent: number;
  to: string;
}

export async function claimTokens(userId: number, requestedAddress?: string): Promise<ClaimResult> {
  if (!config.blockchainEnabled) throw new ClaimError(503, { error: "blockchain_disabled" });

  // ── Step 1: lock + validate + deduct, all inside one transaction ───────────
  const prepared = await prisma.$transaction(async (tx) => {
    let points: number;
    let walletAddress: string | null;

    if (isPostgres()) {
      const rows = await tx.$queryRawUnsafe<Array<{ id: number; points: number; wallet_address: string | null }>>(
        "SELECT id, points, wallet_address FROM users WHERE id = $1 FOR UPDATE",
        userId,
      );
      const row = rows[0];
      if (!row) throw new ClaimError(404, { error: "user_not_found" });
      points = row.points;
      walletAddress = row.wallet_address;
    } else {
      const row = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, points: true, walletAddress: true },
      });
      if (!row) throw new ClaimError(404, { error: "user_not_found" });
      points = row.points;
      walletAddress = row.walletAddress;
    }

    const me = await tx.user.findUnique({ where: { id: userId }, select: { verifiedBadge: true } });
    const max = me?.verifiedBadge ? config.claimMaxDailyVerified : config.claimMaxDaily;
    const todays = await tx.tokenClaim.count({
      where: { userId, createdAt: { gte: startOfToday() }, status: { not: "failed" } },
    });
    if (todays >= max) throw new ClaimError(400, { error: "daily_limit", max });

    if (points < config.claimMinPoints) {
      throw new ClaimError(400, { error: "below_min", min: config.claimMinPoints, have: points });
    }
    const tokens = Math.floor(points / config.claimPointsPerToken);
    if (tokens <= 0) throw new ClaimError(400, { error: "no_tokens_earned" });
    const pointsSpent = tokens * config.claimPointsPerToken;

    const to = String(requestedAddress || walletAddress || "");
    if (!ADDRESS_RE.test(to)) throw new ClaimError(400, { error: "bad_address" });

    // Guarded decrement: a concurrent request cannot spend the same points twice.
    const updated = await tx.user.updateMany({
      where: { id: userId, points: { gte: pointsSpent } },
      data: { points: { decrement: pointsSpent } },
    });
    if (updated.count === 0) {
      throw new ClaimError(400, { error: "below_min", min: config.claimMinPoints, have: points });
    }
    await tx.pointLedger.create({ data: { userId, delta: -pointsSpent, reason: "claim_tokens", ref: to } });
    const claim = await tx.tokenClaim.create({
      data: { userId, pointsSpent, tokensAmount: tokens, toAddress: to, status: "pending" },
      select: { id: true },
    });
    return { claimId: claim.id, pointsSpent, tokens, to };
  });

  const { claimId, pointsSpent, tokens, to } = prepared;

  // ── Step 2: on-chain transfer from the vault ───────────────────────────────
  let txHash: string | null = null;
  try {
    const chain = activeChain();
    const publicClient = createPublicClient({ chain, transport: http(config.bscRpc) });
    const walletClient = createWalletClient({ chain, transport: http(config.bscRpc), account: vaultAccount() });
    const hash = await walletClient.writeContract({
      address: config.duysContract as Address,
      abi: DUYS_ABI,
      functionName: "transfer",
      args: [to as Address, parseUnits(String(tokens), 18)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    txHash = receipt.transactionHash;
  } catch (err) {
    console.error("[claim] chain transfer failed:", err);
    // ── Step 3: refund + audit ───────────────────────────────────────────────
    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { points: { increment: pointsSpent } } }),
        prisma.pointLedger.create({
          data: { userId, delta: pointsSpent, reason: "claim_refund", ref: String(claimId) },
        }),
      ]);
    } catch (rollbackErr) {
      console.error("[claim] rollback failed:", rollbackErr);
    }
    await prisma.tokenClaim.update({
      where: { id: claimId },
      data: { status: "failed", errorMsg: String(err).slice(0, 500) },
    });
    throw new ClaimError(502, { error: "chain_failed", detail: String(err).slice(0, 200) });
  }

  await prisma.tokenClaim.update({
    where: { id: claimId },
    data: { status: "confirmed", txHash: txHash ?? "" },
  });
  return { ok: true, txHash, tokens, pointsSpent, to };
}

/** Express handler shared by both claim routes. */
export async function handleClaim(req: AuthedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: "auth_required" });
  const body = req.body as { toAddress?: unknown } | undefined;
  const requested = body?.toAddress ? String(body.toAddress) : undefined;
  try {
    res.json(await claimTokens(req.user.id, requested));
  } catch (err) {
    if (err instanceof ClaimError) return res.status(err.status).json(err.body);
    console.error("[claim] unexpected failure:", err);
    res.status(500).json({ error: "claim_failed" });
  }
}


