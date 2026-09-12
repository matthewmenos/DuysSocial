// Watch-to-Earn: claim rewards endpoint.
// POST /api/claim-rewards
//
// Flow:
//  1. Lock the user row (SELECT ... FOR UPDATE on Postgres; tx on SQLite).
//  2. Verify pointsBalance >= claimMinPoints (10 pts = 1 DUYS token).
//  3. Deduct points in DB and commit FIRST.
//  4. Transfer DUYS tokens from vault via viem.
//  5. On chain success: record TokenClaim "confirmed" + txHash.
//  6. On chain failure: rollback points, record TokenClaim "failed".
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { config } from "../config.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
} from "viem";
import { bscTestnet } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Address } from "viem";

export const claimRouter = Router();

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

function vaultAccount(): PrivateKeyAccount {
  const key = config.vaultKey;
  if (!key) throw new Error("VAULT_PRIVATE_KEY not configured");
  return privateKeyToAccount(key as `0x${string}`);
}

/**
 * POST /api/claim-rewards
 * Body: { toAddress?: string }
 */
claimRouter.post("/claim-rewards", requireAuth, async (req: AuthedRequest, res) => {
  if (!config.blockchainEnabled) {
    return res.status(503).json({ error: "blockchain_disabled" });
  }
  const userId = req.user!.id;
  // Step 1: lock row + validate balance
  let user: { id: number; points: number; walletAddress: string } | null;
  try {
    if (config.databaseUrl.startsWith("postgresql") || config.databaseUrl.startsWith("postgres")) {
      const locked = await prisma.$queryRawUnsafe<
        Array<{ id: number; points: number; wallet_address: string }>
      >("SELECT id, points, wallet_address FROM users WHERE id = $1 FOR UPDATE", userId);
      const row = locked[0];
      if (!row) return res.status(404).json({ error: "user_not_found" });
      user = { id: row.id, points: row.points, walletAddress: row.wallet_address };
    } else {
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, points: true, walletAddress: true },
        });
        return u ?? null;
      });
      if (!user) return res.status(404).json({ error: "user_not_found" });
    }
  } catch (err) {
    console.error("[claim-rewards] row lock failed:", err);
    return res.status(500).json({ error: "lock_failed" });
  }
  const points = user.points;
  if (points < config.claimMinPoints) {
    return res.status(400).json({ error: "below_min", min: config.claimMinPoints, have: points });
  }
  const tokens = Math.floor(points / config.claimPointsPerToken);
  if (tokens <= 0) return res.status(400).json({ error: "no_tokens_earned" });
  const pointsSpent = tokens * config.claimPointsPerToken;
  const to: Address = (req.body.toAddress as Address) || user.walletAddress;
  if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    return res.status(400).json({ error: "bad_address" });
  }
  // Step 3: deduct points in DB and commit FIRST
  let claimRecord;
  try {
    claimRecord = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: pointsSpent } },
      });
      return tx.tokenClaim.create({
        data: { userId, pointsSpent, tokensAmount: tokens, toAddress: to, status: "pending" },
        select: { id: true },
      });
    });
  } catch (err) {
    console.error("[claim-rewards] points deduction failed:", err);
    return res.status(500).json({ error: "deduct_failed" });
  }
  // Step 4: transfer DUYS tokens from vault via viem
  let txHash: string | null = null;
  try {
    const vault = vaultAccount();
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(config.bscRpc) });
    const walletClient = createWalletClient({ chain: bscTestnet, transport: http(config.bscRpc), account: vault });
    const amountWei = parseUnits(String(tokens), 18);
    const hash = await walletClient.writeContract({
      address: config.duysContract as Address,
      abi: DUYS_ABI,
      functionName: "transfer",
      args: [to, amountWei],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    txHash = receipt.transactionHash;
  } catch (err) {
    console.error("[claim-rewards] chain transfer failed:", err);
    // Step 6: rollback points
    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { points: { increment: pointsSpent } } }),
      ]);
    } catch (rollbackErr) {
      console.error("[claim-rewards] rollback failed:", rollbackErr);
    }
    await prisma.tokenClaim.update({
      where: { id: claimRecord.id },
      data: { status: "failed", errorMsg: String(err).slice(0, 500) },
    });
    return res.status(502).json({ error: "chain_failed", detail: String(err).slice(0, 200) });
  }
  // Step 5: record confirmed claim
  await prisma.tokenClaim.update({
    where: { id: claimRecord.id },
    data: { status: "confirmed", txHash: txHash ?? "" },
  });
  res.json({ ok: true, txHash, tokens, pointsSpent, to });
});
