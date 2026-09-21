import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { prisma, getSetting } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { config } from "../config.js";
import { creditPoints, spendPoints, spendTokens, creditTokens } from "../services/points.js";
import { notify } from "../services/notify.js";
import { saveFile, deleteFiles } from "../services/storage.js";
import { startCall, drainMailbox, getCall, endCall, pushCallEvent } from "../socket.js";
import { ethers } from "ethers";
import { fetchMidRate, applySpread, toAmount } from "../services/swap.js";
import { handleClaim, walletHash } from "../services/claims.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
export const moneyRouter = Router();

// One-time signing nonces for wallet linking (userId -> nonce).
const walletNonces = new Map<number, { nonce: string; at: number }>();
const NONCE_TTL_MS = 5 * 60 * 1000;

function walletNonceFor(userId: number): string {
  const now = Date.now();
  const existing = walletNonces.get(userId);
  if (existing && now - existing.at < NONCE_TTL_MS) return existing.nonce;
  const nonce = `Sign in to DUYS to link your wallet.\n\nNonce: ${Date.now()}.${Math.floor(Math.random() * 1e9)}`;
  walletNonces.set(userId, { nonce, at: now });
  return nonce;
}

moneyRouter.get("/wallet", requireAuth, async (req: AuthedRequest, res) => {
  const txs = await prisma.walletTx.findMany({ where: { userId: req.user!.id }, orderBy: { id: "desc" }, take: 50 });
  const ledger = await prisma.pointLedger.findMany({ where: { userId: req.user!.id }, orderBy: { id: "desc" }, take: 50 });
  const claims = await prisma.tokenClaim.findMany({ where: { userId: req.user!.id }, orderBy: { id: "desc" }, take: 20 });
  res.json({
    user: {
      points: req.user!.points,
      duysTokens: req.user!.duysTokens,
      balanceCents: req.user!.balanceCents,
      walletAddress: req.user!.walletAddress,
    },
    txs,
    ledger,
    claims,
    ice: config.iceServers,
    walletConnectId: config.walletConnectId,
    blockchainEnabled: config.blockchainEnabled,
    claim: {
      pointsPerToken: config.claimPointsPerToken,
      minPoints: config.claimMinPoints,
    },
  });
});

moneyRouter.post("/wallet/tip", requireAuth, async (req: AuthedRequest, res) => {
  const toId = Number(req.body.toId);
  const amount = Number(req.body.amount);
  const currency = String(req.body.currency || "points");
  if (toId === req.user!.id || amount <= 0) return res.status(400).json({ error: "invalid" });
  if (currency === "points") {
    const ok = await spendPoints(req.user!.id, amount, "tip_out", String(toId));
    if (!ok) return res.status(400).json({ error: "insufficient" });
    await creditPoints(toId, amount, "tip_in", String(req.user!.id));
  } else {
    const ok = await spendTokens(req.user!.id, amount);
    if (!ok) return res.status(400).json({ error: "insufficient" });
    await creditTokens(toId, amount);
  }
  await prisma.tip.create({
    data: { fromId: req.user!.id, toId, postId: req.body.postId ? Number(req.body.postId) : null, currency, amount },
  });
  await notify(toId, `@${req.user!.username} tipped you ${amount} ${currency}`, { actorId: req.user!.id, kind: "tip" });
  res.json({ ok: true });
});

moneyRouter.post("/wallet/connect/nonce", requireAuth, (req: AuthedRequest, res) => {
  res.json({ nonce: walletNonceFor(req.user!.id) });
});

moneyRouter.post("/wallet/connect/verify", requireAuth, async (req: AuthedRequest, res) => {
  const address = String(req.body.address || "");
  const signature = String(req.body.signature || "");
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error: "bad_address" });
  if (!signature) return res.status(400).json({ error: "signature_required" });
  const stored = walletNonces.get(req.user!.id);
  if (!stored || Date.now() - stored.at > NONCE_TTL_MS) {
    return res.status(400).json({ error: "nonce_expired" });
  }
  // Recover the signer from the signature; it must match the claimed address.
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(stored.nonce, signature);
  } catch {
    return res.status(400).json({ error: "bad_signature" });
  }
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return res.status(400).json({ error: "signer_mismatch" });
  }
  // The unique index lives on the hash, so a plain address can never be probed
  // and unlinked users never collide on an empty-string default.
  const hash = walletHash(address);
  const taken = await prisma.user.findFirst({
    where: { walletAddressHash: hash, id: { not: req.user!.id } },
  });
  if (taken) return res.status(409).json({ error: "wallet_taken" });
  walletNonces.delete(req.user!.id);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { walletAddress: address, walletAddressHash: hash },
  });
  res.json({ ok: true, address });
});

moneyRouter.post("/wallet/disconnect", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { walletAddress: null, walletAddressHash: null } });
  res.json({ ok: true });
});

// Delegates to services/claims.ts (same implementation as POST /api/claim-rewards)
// so locking, daily limits and refunds can never drift between the two routes.
moneyRouter.post("/wallet/claim-tokens", requireAuth, handleClaim);

moneyRouter.get("/earn", requireAuth, async (req: AuthedRequest, res) => {
  const views = await prisma.adView.findMany({ where: { userId: req.user!.id }, orderBy: { id: "desc" }, take: 20 });
  res.json({ reward: config.pointsAdReward, views, hypelab: config.hypelabSlug });
});

moneyRouter.post("/earn/ad", requireAuth, async (req: AuthedRequest, res) => {
  await creditPoints(req.user!.id, config.pointsAdReward, "watch_ad");
  await prisma.adView.create({ data: { userId: req.user!.id, reward: config.pointsAdReward } });
  res.json({ points: req.user!.points + config.pointsAdReward, reward: config.pointsAdReward });
});

moneyRouter.post("/earn/webhooks/hypelab", async (req, res) => {
  // A rewarded-ad webhook mints points, so it must never be open in production:
  // with a signing secret configured the HMAC is mandatory; without one we only
  // accept calls in dev/test (otherwise anyone could credit themselves points).
  if (!config.hypelabSigningSecret) {
    if (!config.debug) return res.status(503).json({ error: "webhook_disabled" });
  } else {
    const raw = (req as { rawBody?: Buffer }).rawBody;
    const provided = String(req.headers["x-hypelab-signature"] || req.headers["x-signature"] || "");
    if (!raw || !provided) return res.status(401).json({ error: "signature_required" });
    const expected = crypto.createHmac("sha256", config.hypelabSigningSecret).update(raw).digest("hex");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "bad_signature" });
    }
  }
  const eventId = String(req.body.event_id || req.body.eventId || "");
  const userId = Number(req.body.user_id || req.body.userId);
  if (!eventId || !userId) return res.status(400).json({ error: "bad" });
  const existing = await prisma.hypelabEvent.findUnique({ where: { eventId } });
  if (existing) return res.json({ ok: true, duplicate: true });
  await prisma.hypelabEvent.create({ data: { eventId, userId, reward: config.pointsAdReward } });
  await creditPoints(userId, config.pointsAdReward, "hypelab");
  res.json({ ok: true });
});

moneyRouter.get("/referral", requireAuth, async (req: AuthedRequest, res) => {
  const refs = await prisma.referral.findMany({ where: { referrerId: req.user!.id } });
  const users = await prisma.user.findMany({ where: { id: { in: refs.map((r) => r.refereeId) } } });
  const cuts = await prisma.pointLedger.findMany({
    where: { userId: req.user!.id, reason: "referral_cut" },
    select: { delta: true },
  });
  res.json({
    code: req.user!.username,
    count: refs.length,
    bonus: config.pointsReferralBonus,
    percent: Math.round(config.referralEarnPercent * 100),
    earned: cuts.reduce((sum, c) => sum + c.delta, 0),
    referees: users.map((u) => ({
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
    })),
  });
});

moneyRouter.get("/leaderboard", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ where: { isBanned: false }, orderBy: { points: "desc" }, take: 50 });
  res.json({ users });
});

moneyRouter.get("/verification", requireAuth, async (req: AuthedRequest, res) => {
  const fees = {
    blue: Number(await getSetting("verification_fee_blue", 5)),
    gold: Number(await getSetting("verification_fee_gold", 25)),
    grey: Number(await getSetting("verification_fee_grey", 15)),
  };
  const pending = await prisma.verificationRequest.findFirst({
    where: { userId: req.user!.id, status: "pending" },
  });
  res.json({
    badge: req.user!.verifiedBadge,
    expires: req.user!.verifiedBadgeExpires,
    face: req.user!.faceVerifyStatus,
    fees,
    pending,
    // Balance strip on the verification page (legacy shows both).
    points: req.user!.points,
    tokens: req.user!.duysTokens,
  });
});

// "Your Applications" list on the verification page.
moneyRouter.get("/verification/history", requireAuth, async (req: AuthedRequest, res) => {
  const requests = await prisma.verificationRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { id: "desc" },
    take: 10,
  });
  res.json({ requests });
});

moneyRouter.post("/verification/apply", requireAuth, async (req: AuthedRequest, res) => {
  const badge = String(req.body.badge || "blue");
  if (!["blue", "gold", "grey"].includes(badge)) return res.status(400).json({ error: "bad_badge" });
  const fee = Number(await getSetting(`verification_fee_${badge}`, badge === "gold" ? 25 : badge === "grey" ? 15 : 5));
  const method = String(req.body.paymentMethod || "points");
  if (method === "points") {
    const ok = await spendPoints(req.user!.id, Math.round(fee * 1000), "verification", badge);
    if (!ok) return res.status(400).json({ error: "insufficient" });
  } else {
    const ok = await spendTokens(req.user!.id, fee);
    if (!ok) return res.status(400).json({ error: "insufficient" });
  }
  const row = await prisma.verificationRequest.create({
    data: {
      userId: req.user!.id,
      badge,
      paymentMethod: method,
      amount: fee,
      reason: String(req.body.reason || ""),
    },
  });
  res.json({ request: row });
});

moneyRouter.post("/verification/face", requireAuth, upload.fields([{ name: "idPhoto" }, { name: "selfie" }]), async (req: AuthedRequest, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const idPhoto = files?.idPhoto?.[0];
  const selfie = files?.selfie?.[0];
  if (!idPhoto || !selfie) return res.status(400).json({ error: "need_photos" });
  const idSaved = await saveFile(idPhoto.buffer, idPhoto.originalname, idPhoto.mimetype, { privateBucket: true });
  const selfSaved = await saveFile(selfie.buffer, selfie.originalname, selfie.mimetype, { privateBucket: true });
  let confidence = 0;
  let status = "pending";
  if (config.faceWorkerUrl) {
    try {
      const r = await fetch(`${config.faceWorkerUrl.replace(/\/$/, "")}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idUrl: idSaved.url, selfieUrl: selfSaved.url }),
      });
      const j = (await r.json()) as { confidence?: number; ok?: boolean };
      confidence = j.confidence || 0;
      status = j.ok ? "pending" : "pending";
    } catch {
      /* admin review */
    }
  }
  await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      faceIdPhotoKey: idSaved.key,
      faceSelfieKey: selfSaved.key,
      faceConfidence: confidence,
      faceVerifyStatus: status,
      faceNationality: String(req.body.nationality || ""),
      faceIdType: String(req.body.idType || ""),
    },
  });
  res.json({ status, confidence });
});

moneyRouter.get("/boost/rate", requireAuth, async (_req, res) => {
  res.json({ perDay: Number(await getSetting("boost_fee_usd_per_day", 1)) });
});

moneyRouter.post("/boost/:postId", requireAuth, async (req: AuthedRequest, res) => {
  const post = await prisma.post.findUnique({ where: { id: Number(req.params.postId) } });
  if (!post || post.authorId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  const days = Math.max(1, Number(req.body.days || 1));
  const rate = Number(await getSetting("boost_fee_usd_per_day", 1));
  const amount = days * 1000;
  const ok = await spendPoints(req.user!.id, amount, "boost", String(post.id));
  if (!ok) return res.status(400).json({ error: "insufficient" });
  const ends = new Date();
  ends.setDate(ends.getDate() + days);
  await prisma.boost.create({
    data: {
      postId: post.id,
      userId: req.user!.id,
      days,
      paymentMethod: "points",
      amount,
      geo: String(req.body.geo || ""),
      ageMin: Number(req.body.ageMin || 18),
      ageMax: Number(req.body.ageMax || 65),
      landingUrl: String(req.body.landingUrl || ""),
      cta: String(req.body.cta || ""),
      audience: String(req.body.audience || ""),
      endsAt: ends,
    },
  });
  await prisma.post.update({
    where: { id: post.id },
    data: { isSponsored: true, boostUntil: ends, cta: String(req.body.cta || ""), landingUrl: String(req.body.landingUrl || "") },
  });
  res.json({ ok: true, endsAt: ends });
});

moneyRouter.get("/swap/config", requireAuth, async (_req, res) => {
  res.json({
    enabledBuy: await getSetting("swap_buy_enabled", true),
    enabledSell: await getSetting("swap_sell_enabled", true),
    spread: config.swapSpread,
    minUsdt: config.swapMinUsdt,
    vault: config.vaultAddress,
    usdt: config.usdtContract,
    duys: config.duysContract,
    mid: await fetchMidRate(),
  });
});

moneyRouter.post("/swap/quote", requireAuth, async (req, res) => {
  const side = String(req.body.side || "buy");
  if (side !== "buy" && side !== "sell") return res.status(400).json({ error: "bad_side" });
  const fromAmount = Number(req.body.fromAmount || 0);
  if (fromAmount <= 0) return res.status(400).json({ error: "bad_amount" });
  const mid = await fetchMidRate();
  const rate = applySpread(mid, side);
  const toAmount_ = toAmount(mid, side, fromAmount);
  res.json({ mid, rate, toAmount: toAmount_, fromAmount, side });
});

moneyRouter.post("/swap/start", requireAuth, async (req: AuthedRequest, res) => {
  const side = String(req.body.side || "buy");
  if (side !== "buy" && side !== "sell") return res.status(400).json({ error: "bad_side" });
  const fromAmount = Number(req.body.fromAmount || 0);
  if (fromAmount <= 0) return res.status(400).json({ error: "bad_amount" });
  const mid = await fetchMidRate();
  const rate = applySpread(mid, side);
  const quote = toAmount(mid, side, fromAmount);
  if (fromAmount < config.swapMinUsdt * (side === "buy" ? 1 : rate)) {
    return res.status(400).json({ error: "below_min" });
  }
  const swap = await prisma.swap.create({
    data: {
      userId: req.user!.id,
      side,
      fromAmount,
      toAmount: quote,
      rate,
      userAddress: String(req.body.userAddress || req.user!.walletAddress || ""),
    },
  });
  res.json({ swap, depositAddress: config.vaultAddress, mid, rate });
});

// User has sent USDT to the vault on-chain; record the deposit tx hash.
moneyRouter.post("/swap/deposit", requireAuth, async (req: AuthedRequest, res) => {
  const swapId = Number(req.body.swapId);
  const txHash = String(req.body.txHash || "").trim();
  const swap = await prisma.swap.findFirst({ where: { id: swapId, userId: req.user!.id } });
  if (!swap || swap.side !== "sell") return res.status(404).json({ error: "not_found" });
  if (swap.status === "paid" || swap.status === "cancelled") {
    return res.status(400).json({ error: "bad_state" });
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return res.status(400).json({ error: "bad_tx" });
  await prisma.swap.update({ where: { id: swap.id }, data: { depositTx: txHash, status: "pending" } });
  res.json({ ok: true, swapId: swap.id });
});

// Confirm a pending swap and, when blockchain is enabled, pay out tokens.
moneyRouter.post("/swap/confirm", requireAuth, async (req: AuthedRequest, res) => {
  const swapId = Number(req.body.swapId);
  const swap = await prisma.swap.findFirst({ where: { id: swapId, userId: req.user!.id } });
  if (!swap || swap.status === "cancelled") return res.status(404).json({ error: "not_found" });
  if (swap.status !== "pending" && swap.status !== "awaiting_deposit") {
    return res.status(400).json({ error: "bad_state" });
  }
  // For a sell, a confirmed deposit tx is required before payout.
  if (swap.side === "sell" && !swap.depositTx) {
    return res.status(400).json({ error: "awaiting_deposit" });
  }
  // Credit in-app tokens immediately for buy; for sell we rely on the vault
  // USDT payout (out of scope of the in-app ledger).
  if (swap.side === "buy") {
    await creditTokens(req.user!.id, swap.toAmount);
    await prisma.swap.update({ where: { id: swap.id }, data: { status: "confirmed", payoutTx: "in_app" } });
    return res.json({ ok: true, status: "confirmed" });
  }
  if (config.blockchainEnabled) {
    try {
      const provider = new ethers.JsonRpcProvider(config.bscRpc);
      const wallet = new ethers.Wallet(config.vaultKey, provider);
      const erc20 = new ethers.Contract(
        config.usdtContract,
        ["function transfer(address to,uint256 amount) returns (bool)"],
        wallet,
      );
      const payoutTo = swap.userAddress || req.user!.walletAddress || "";
      if (!/^0x[a-fA-F0-9]{40}$/.test(payoutTo)) {
        return res.status(400).json({ error: "no_address" });
      }
      const tx = await erc20.transfer(
        payoutTo,
        ethers.parseUnits(String(swap.toAmount), config.usdtDecimals),
      );
      const rec = await tx.wait();
      await prisma.swap.update({
        where: { id: swap.id },
        data: { status: "confirmed", payoutTx: rec?.hash || tx.hash },
      });
      return res.json({ ok: true, status: "confirmed", payoutTx: rec?.hash || tx.hash });
    } catch (e) {
      await prisma.swap.update({
        where: { id: swap.id },
        data: { status: "failed", errorMsg: String(e).slice(0, 200) },
      });
      return res.status(500).json({ error: "chain_failed" });
    }
  }
  await prisma.swap.update({ where: { id: swap.id }, data: { status: "confirmed" } });
  res.json({ ok: true, status: "confirmed", note: "blockchain_disabled" });
});

moneyRouter.get("/swap/history", requireAuth, async (req: AuthedRequest, res) => {
  const swaps = await prisma.swap.findMany({ where: { userId: req.user!.id }, orderBy: { id: "desc" }, take: 30 });
  res.json({ swaps });
});

moneyRouter.get("/shop/:username", requireAuth, async (req: AuthedRequest, res) => {
  const seller = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!seller) return res.status(404).json({ error: "not_found" });
  const listings = await prisma.shopListing.findMany({ where: { sellerId: seller.id, active: true } });
  const purchases = await prisma.shopPurchase.findMany({ where: { buyerId: req.user!.id } });
  res.json({ seller: { username: seller.username, displayName: seller.displayName }, listings, owned: purchases.map((p) => p.listingId) });
});

moneyRouter.post("/shop/:username/create", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (req.user!.username !== String(req.params.username).toLowerCase()) return res.status(403).json({ error: "forbidden" });
  let fileKey = "", fileUrl = "";
  if (req.file) {
    const s = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    fileKey = s.key;
    fileUrl = s.url;
  }
  const listing = await prisma.shopListing.create({
    data: {
      sellerId: req.user!.id,
      title: String(req.body.title || "Item"),
      description: String(req.body.description || ""),
      priceDuys: Number(req.body.priceDuys || 0),
      fileKey,
      fileUrl,
    },
  });
  res.json({ listing });
});

moneyRouter.post("/shop/listings/:id/buy", requireAuth, async (req: AuthedRequest, res) => {
  const listing = await prisma.shopListing.findUnique({ where: { id: Number(req.params.id) } });
  if (!listing || !listing.active) return res.status(404).json({ error: "not_found" });
  const ok = await spendTokens(req.user!.id, listing.priceDuys);
  if (!ok) return res.status(400).json({ error: "insufficient" });
  await creditTokens(listing.sellerId, listing.priceDuys);
  await prisma.shopPurchase.create({ data: { buyerId: req.user!.id, listingId: listing.id, paid: listing.priceDuys } });
  res.json({ ok: true, fileUrl: listing.fileUrl });
});

moneyRouter.get("/stories/u/:username", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!user) return res.status(404).json({ error: "not_found" });
  const stories = await prisma.story.findMany({
    where: { authorId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { id: "asc" },
  });
  res.json({ stories });
});

moneyRouter.post("/stories", requireAuth, upload.single("media"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  const s = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const expires = new Date(Date.now() + 86400000);
  const story = await prisma.story.create({
    data: {
      authorId: req.user!.id,
      mediaKey: s.key,
      mediaUrl: s.url,
      mediaKind: s.kind,
      caption: String(req.body.caption || ""),
      expiresAt: expires,
    },
  });
  res.json({ story });
});

moneyRouter.post("/stories/:id/seen", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId: Number(req.params.id), userId: req.user!.id } },
    create: { storyId: Number(req.params.id), userId: req.user!.id },
    update: {},
  });
  res.json({ ok: true });
});

moneyRouter.post("/stories/:id/react", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.storyReaction.upsert({
    where: { storyId_userId: { storyId: Number(req.params.id), userId: req.user!.id } },
    create: { storyId: Number(req.params.id), userId: req.user!.id, emoji: String(req.body.emoji || "❤️") },
    update: { emoji: String(req.body.emoji || "❤️") },
  });
  res.json({ ok: true });
});

moneyRouter.post("/stories/:id/delete", requireAuth, async (req: AuthedRequest, res) => {
  const s = await prisma.story.findUnique({ where: { id: Number(req.params.id) } });
  if (!s || s.authorId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  await prisma.story.delete({ where: { id: s.id } });
  await deleteFiles([s.mediaKey]);
  res.json({ ok: true });
});

moneyRouter.post("/calls/start", requireAuth, async (req: AuthedRequest, res) => {
  const convId = Number(req.body.convId);
  const members = await prisma.conversationMember.findMany({ where: { conversationId: convId } });
  const id = startCall(convId, req.user!.id, members.map((m) => m.userId), String(req.body.kind || "audio"));
  res.json({ callId: id, ice: config.iceServers });
});

moneyRouter.post("/calls/:id/accept", requireAuth, (req: AuthedRequest, res) => {
  const c = getCall(String(req.params.id));
  if (c) c.status = "active";
  for (const m of c?.members || []) pushCallEvent(m, { type: "accepted", callId: req.params.id, userId: req.user!.id });
  res.json({ ok: true, ice: config.iceServers });
});

moneyRouter.post("/calls/:id/decline", requireAuth, (req: AuthedRequest, res) => {
  const c = getCall(String(req.params.id));
  for (const m of c?.members || []) pushCallEvent(m, { type: "declined", callId: req.params.id });
  res.json({ ok: true });
});

moneyRouter.post("/calls/:id/end", requireAuth, (req: AuthedRequest, res) => {
  const c = endCall(String(req.params.id));
  for (const m of c?.members || []) pushCallEvent(m, { type: "ended", callId: req.params.id });
  res.json({ ok: true });
});

moneyRouter.post("/calls/:id/signal", requireAuth, (req: AuthedRequest, res) => {
  const to = Number(req.body.to);
  pushCallEvent(to, { type: "signal", callId: req.params.id, from: req.user!.id, data: req.body.data });
  res.json({ ok: true });
});

moneyRouter.get("/calls/poll", requireAuth, (req: AuthedRequest, res) => {
  res.json({ events: drainMailbox(req.user!.id) });
});
