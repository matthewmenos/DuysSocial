import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, publicUser, type AuthedRequest } from "../session.js";
import { saveFile } from "../services/storage.js";
import { serializePost } from "../services/posts.js";
import { notify } from "../services/notify.js";
import { spendTokens, creditTokens } from "../services/points.js";
import { sanitizeUsername, USERNAME_RE } from "../services/users.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
export const profileRouter = Router();

profileRouter.get("/u/:username", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!user || user.isBanned) return res.status(404).json({ error: "not_found" });
  const posts = await prisma.post.findMany({
    where: { authorId: user.id, channelId: null },
    orderBy: { id: "desc" },
    take: 30,
  });
  const serialized = [];
  for (const p of posts) {
    const s = await serializePost(p.id, req.user!.id);
    if (s) serialized.push(s);
  }
  const followers = await prisma.follow.count({ where: { followeeId: user.id } });
  const following = await prisma.follow.count({ where: { followerId: user.id } });
  const isFollowing = Boolean(
    await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: req.user!.id, followeeId: user.id } },
    }),
  );
  const blocked = Boolean(
    await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: user.id } },
    }),
  );
  const sub = await prisma.userSubscription.findUnique({
    where: { subscriberId_creatorId: { subscriberId: req.user!.id, creatorId: user.id } },
  });
  const creatorSub = await prisma.creatorSubscription.findUnique({ where: { userId: user.id } });
  let tier = null;
  if (creatorSub) tier = await prisma.subscriptionTier.findUnique({ where: { id: creatorSub.tierId } });
  res.json({
    user: publicUser(user),
    posts: serialized,
    followers,
    following,
    isFollowing,
    blocked,
    subscribed: Boolean(sub && sub.expiresAt > new Date()),
    tier,
  });
});

profileRouter.get("/u/slug/:slug", requireAuth, async (req, res) => {
  const user = await prisma.user.findFirst({ where: { profileSlug: String(req.params.slug) } });
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json({ username: user.username });
});

profileRouter.post("/u/:username/follow", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!user || user.id === req.user!.id) return res.status(400).json({ error: "invalid" });
  const key = { followerId_followeeId: { followerId: req.user!.id, followeeId: user.id } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) {
    await prisma.follow.delete({ where: key });
    return res.json({ following: false });
  }
  await prisma.follow.create({ data: { followerId: req.user!.id, followeeId: user.id } });
  await notify(user.id, `@${req.user!.username} followed you`, {
    actorId: req.user!.id,
    kind: "follow",
  });
  res.json({ following: true });
});

profileRouter.get("/u/:username/followers", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!user) return res.status(404).json({ error: "not_found" });
  const rows = await prisma.follow.findMany({ where: { followeeId: user.id }, take: 50 });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.followerId) } } });
  res.json({ users: users.map(publicUser) });
});

profileRouter.get("/u/:username/following", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!user) return res.status(404).json({ error: "not_found" });
  const rows = await prisma.follow.findMany({ where: { followerId: user.id }, take: 50 });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.followeeId) } } });
  res.json({ users: users.map(publicUser) });
});

profileRouter.get("/u/:username/analytics", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!user || user.id !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  const posts = await prisma.post.count({ where: { authorId: user.id } });
  const views = await prisma.postView.count();
  const myLikes = await prisma.post.aggregate({ where: { authorId: user.id }, _sum: { likeCount: true, viewCount: true } });
  res.json({ posts, likes: myLikes._sum.likeCount || 0, views: myLikes._sum.viewCount || 0, extraViews: views });
});

profileRouter.get("/settings", requireAuth, async (req: AuthedRequest, res) => {
  res.json({ user: publicUser(req.user!) });
});

profileRouter.post("/settings", requireAuth, async (req: AuthedRequest, res) => {
  const data: Record<string, unknown> = {};
  for (const k of ["displayName", "bio", "location", "website", "whoCanDm"] as const) {
    if (req.body[k] != null) data[k] = String(req.body[k]);
  }
  if (req.body.showOnline != null) data.showOnline = Boolean(req.body.showOnline);
  if (req.body.showLastSeen != null) data.showLastSeen = Boolean(req.body.showLastSeen);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json({ user: publicUser(user) });
});

profileRouter.post("/settings/theme", requireAuth, async (req: AuthedRequest, res) => {
  const theme = req.body.theme === "light" ? "light" : "dark";
  await prisma.user.update({ where: { id: req.user!.id }, data: { theme } });
  res.json({ theme });
});

profileRouter.post("/settings/username", requireAuth, async (req: AuthedRequest, res) => {
  const username = sanitizeUsername(String(req.body.username || ""));
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: "invalid" });
  if (await prisma.user.findUnique({ where: { username } })) return res.status(409).json({ error: "taken" });
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { username } });
  res.json({ user: publicUser(user) });
});

profileRouter.post("/settings/slug", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.user!.verifiedBadge) return res.status(403).json({ error: "verified_only" });
  const slug = String(req.body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { profileSlug: slug } });
  res.json({ user: publicUser(user) });
});

profileRouter.post("/settings/upload-avatar", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  const saved = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: saved.url } });
  res.json({ user: publicUser(user) });
});

profileRouter.post("/settings/upload-banner", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  const saved = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { bannerUrl: saved.url } });
  res.json({ user: publicUser(user) });
});

profileRouter.post("/settings/ringtone", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  const saved = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { ringtoneUrl: saved.url } });
  res.json({ user: publicUser(user) });
});

profileRouter.delete("/settings/ringtone", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { ringtoneUrl: "" } });
  res.json({ ok: true });
});

profileRouter.post("/settings/delete", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.delete({ where: { id: req.user!.id } });
  res.json({ ok: true });
});

profileRouter.post("/posts/:id/pin", requireAuth, async (req: AuthedRequest, res) => {
  const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
  if (!post || post.authorId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  await prisma.user.update({ where: { id: req.user!.id }, data: { pinnedPostId: post.id } });
  res.json({ ok: true });
});

profileRouter.post("/posts/:id/unpin", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { pinnedPostId: null } });
  res.json({ ok: true });
});

profileRouter.post("/u/:username/subscription/set-tier", requireAuth, async (req: AuthedRequest, res) => {
  const username = String(req.params.username).toLowerCase();
  if (username !== req.user!.username) return res.status(403).json({ error: "forbidden" });
  const tierId = Number(req.body.tierId);
  await prisma.creatorSubscription.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, tierId },
    update: { tierId },
  });
  res.json({ ok: true });
});

profileRouter.post("/u/:username/subscription/subscribe", requireAuth, async (req: AuthedRequest, res) => {
  const creator = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!creator) return res.status(404).json({ error: "not_found" });
  const cs = await prisma.creatorSubscription.findUnique({ where: { userId: creator.id } });
  if (!cs) return res.status(400).json({ error: "no_tier" });
  const tier = await prisma.subscriptionTier.findUnique({ where: { id: cs.tierId } });
  if (!tier) return res.status(400).json({ error: "no_tier" });
  const ok = await spendTokens(req.user!.id, tier.priceDuys);
  if (!ok) return res.status(400).json({ error: "insufficient_tokens" });
  await creditTokens(creator.id, tier.priceDuys);
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await prisma.userSubscription.upsert({
    where: { subscriberId_creatorId: { subscriberId: req.user!.id, creatorId: creator.id } },
    create: { subscriberId: req.user!.id, creatorId: creator.id, tierId: tier.id, expiresAt: expires },
    update: { expiresAt: expires, tierId: tier.id },
  });
  res.json({ ok: true });
});

profileRouter.post("/u/:username/subscription/unsubscribe", requireAuth, async (req: AuthedRequest, res) => {
  const creator = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!creator) return res.status(404).json({ error: "not_found" });
  await prisma.userSubscription.deleteMany({
    where: { subscriberId: req.user!.id, creatorId: creator.id },
  });
  res.json({ ok: true });
});
