import { Router } from "express";
import { randomBytes } from "node:crypto";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { saveFile } from "../services/storage.js";
import { serializePost } from "../services/posts.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
export const channelsRouter = Router();

function token() {
  return randomBytes(12).toString("hex");
}

channelsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const mine = await prisma.channelSubscription.findMany({ where: { userId: req.user!.id } });
  const channels = await prisma.channel.findMany({
    where: { id: { in: mine.map((m) => m.channelId) } },
  });
  const discover = await prisma.channel.findMany({
    where: { isPrivate: false },
    orderBy: { subscriberCount: "desc" },
    take: 30,
  });
  res.json({ mine: channels, discover });
});

channelsRouter.post("/create", requireAuth, upload.single("avatar"), async (req: AuthedRequest, res) => {
  const name = String(req.body.name || "").trim();
  const handle = String(req.body.handle || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (!name || handle.length < 3) return res.status(400).json({ error: "invalid" });
  if (await prisma.channel.findUnique({ where: { handle } })) return res.status(409).json({ error: "handle_taken" });
  let avatarUrl = "";
  if (req.file) {
    const s = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    avatarUrl = s.url;
  }
  const ch = await prisma.channel.create({
    data: {
      ownerId: req.user!.id,
      name,
      handle,
      description: String(req.body.description || ""),
      avatarUrl,
      inviteToken: token(),
      isPrivate: Boolean(req.body.isPrivate),
      subscriberCount: 1,
    },
  });
  await prisma.channelSubscription.create({
    data: { channelId: ch.id, userId: req.user!.id, role: "owner" },
  });
  res.json({ channel: ch });
});

channelsRouter.get("/c/:handle", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch) return res.status(404).json({ error: "not_found" });
  const sub = await prisma.channelSubscription.findUnique({
    where: { channelId_userId: { channelId: ch.id, userId: req.user!.id } },
  });
  if (ch.isPrivate && !sub) return res.json({ channel: ch, gated: true });
  const posts = await prisma.post.findMany({ where: { channelId: ch.id }, orderBy: { id: "desc" }, take: 40 });
  const serialized = [];
  for (const p of posts) {
    const s = await serializePost(p.id, req.user!.id);
    if (s) serialized.push(s);
  }
  res.json({ channel: ch, role: sub?.role || null, muted: sub?.isMuted || false, posts: serialized });
});

channelsRouter.post("/c/:handle/subscribe", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch) return res.status(404).json({ error: "not_found" });
  const key = { channelId_userId: { channelId: ch.id, userId: req.user!.id } };
  const existing = await prisma.channelSubscription.findUnique({ where: key });
  if (existing && existing.role !== "owner") {
    await prisma.channelSubscription.delete({ where: key });
    await prisma.channel.update({ where: { id: ch.id }, data: { subscriberCount: { decrement: 1 } } });
    return res.json({ subscribed: false });
  }
  if (!existing) {
    await prisma.channelSubscription.create({ data: { channelId: ch.id, userId: req.user!.id, role: "member" } });
    await prisma.channel.update({ where: { id: ch.id }, data: { subscriberCount: { increment: 1 } } });
  }
  res.json({ subscribed: true });
});

channelsRouter.get("/join/:token", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findFirst({ where: { inviteToken: String(req.params.token) } });
  if (!ch) return res.status(404).json({ error: "not_found" });
  await prisma.channelSubscription.upsert({
    where: { channelId_userId: { channelId: ch.id, userId: req.user!.id } },
    create: { channelId: ch.id, userId: req.user!.id, role: "member" },
    update: {},
  });
  res.json({ handle: ch.handle });
});

channelsRouter.post("/c/:handle/mute", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch) return res.status(404).json({ error: "not_found" });
  const sub = await prisma.channelSubscription.findUnique({
    where: { channelId_userId: { channelId: ch.id, userId: req.user!.id } },
  });
  if (!sub) return res.status(400).json({ error: "not_member" });
  await prisma.channelSubscription.update({
    where: { channelId_userId: { channelId: ch.id, userId: req.user!.id } },
    data: { isMuted: !sub.isMuted },
  });
  res.json({ muted: !sub.isMuted });
});

channelsRouter.post("/c/:handle/broadcast", requireAuth, upload.array("media", 8), async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch) return res.status(404).json({ error: "not_found" });
  const sub = await prisma.channelSubscription.findUnique({
    where: { channelId_userId: { channelId: ch.id, userId: req.user!.id } },
  });
  if (!sub || !["owner", "admin"].includes(sub.role)) return res.status(403).json({ error: "forbidden" });
  const post = await prisma.post.create({
    data: { authorId: req.user!.id, kind: "text", body: String(req.body.body || ""), channelId: ch.id },
  });
  for (const f of (req.files as Express.Multer.File[]) || []) {
    const s = await saveFile(f.buffer, f.originalname, f.mimetype);
    await prisma.media.create({ data: { postId: post.id, ownerId: req.user!.id, ...s } });
  }
  res.json({ post: await serializePost(post.id, req.user!.id) });
});

channelsRouter.get("/c/:handle/members", requireAuth, async (req, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch) return res.status(404).json({ error: "not_found" });
  const subs = await prisma.channelSubscription.findMany({ where: { channelId: ch.id } });
  const users = await prisma.user.findMany({ where: { id: { in: subs.map((s) => s.userId) } } });
  const umap = Object.fromEntries(users.map((u) => [u.id, u]));
  res.json({
    members: subs.map((s) => ({
      role: s.role,
      user: umap[s.userId]
        ? { id: umap[s.userId].id, username: umap[s.userId].username, displayName: umap[s.userId].displayName, avatarUrl: umap[s.userId].avatarUrl }
        : null,
    })),
  });
});

async function requireStaff(handle: string, userId: number) {
  const ch = await prisma.channel.findUnique({ where: { handle: handle.toLowerCase() } });
  if (!ch) return null;
  const sub = await prisma.channelSubscription.findUnique({
    where: { channelId_userId: { channelId: ch.id, userId } },
  });
  if (!sub || !["owner", "admin"].includes(sub.role)) return null;
  return { ch, sub };
}

channelsRouter.post("/c/:handle/promote/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  await prisma.channelSubscription.update({
    where: { channelId_userId: { channelId: ctx.ch.id, userId: Number(req.params.userId) } },
    data: { role: "admin" },
  });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/demote/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  await prisma.channelSubscription.update({
    where: { channelId_userId: { channelId: ctx.ch.id, userId: Number(req.params.userId) } },
    data: { role: "member" },
  });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/remove/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  await prisma.channelSubscription.delete({
    where: { channelId_userId: { channelId: ctx.ch.id, userId: Number(req.params.userId) } },
  });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/pin/:postId", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  await prisma.channel.update({ where: { id: ctx.ch.id }, data: { pinnedPostId: Number(req.params.postId) } });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/unpin", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  await prisma.channel.update({ where: { id: ctx.ch.id }, data: { pinnedPostId: null } });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/regen-invite", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  const inviteToken = token();
  await prisma.channel.update({ where: { id: ctx.ch.id }, data: { inviteToken } });
  res.json({ inviteToken });
});

channelsRouter.post("/c/:handle/edit", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await requireStaff(String(req.params.handle), req.user!.id);
  if (!ctx) return res.status(403).json({ error: "forbidden" });
  const ch = await prisma.channel.update({
    where: { id: ctx.ch.id },
    data: {
      name: req.body.name != null ? String(req.body.name) : undefined,
      description: req.body.description != null ? String(req.body.description) : undefined,
      isPrivate: req.body.isPrivate != null ? Boolean(req.body.isPrivate) : undefined,
    },
  });
  res.json({ channel: ch });
});

channelsRouter.post("/c/:handle/delete", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch || ch.ownerId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  await prisma.channel.delete({ where: { id: ch.id } });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/react/:postId", requireAuth, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.postId);
  const emoji = String(req.body.emoji || "❤️");
  await prisma.channelPostReaction.upsert({
    where: { postId_userId: { postId, userId: req.user!.id } },
    create: { postId, userId: req.user!.id, emoji },
    update: { emoji },
  });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/self-verify", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch || ch.ownerId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  if (!req.user!.verifiedBadge) return res.status(400).json({ error: "need_badge" });
  if (req.user!.selfVerifiedChannelId) return res.status(400).json({ error: "already_used" });
  await prisma.channel.update({ where: { id: ch.id }, data: { selfVerified: true, verifiedBadge: req.user!.verifiedBadge } });
  await prisma.user.update({ where: { id: req.user!.id }, data: { selfVerifiedChannelId: ch.id } });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/unself-verify", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch || ch.ownerId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  await prisma.channel.update({ where: { id: ch.id }, data: { selfVerified: false, verifiedBadge: "" } });
  await prisma.user.update({ where: { id: req.user!.id }, data: { selfVerifiedChannelId: null } });
  res.json({ ok: true });
});

channelsRouter.post("/c/:handle/apply-verify", requireAuth, async (req: AuthedRequest, res) => {
  const ch = await prisma.channel.findUnique({ where: { handle: String(req.params.handle).toLowerCase() } });
  if (!ch || ch.ownerId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  await prisma.channelVerifApp.create({
    data: { channelId: ch.id, applicantId: req.user!.id, message: String(req.body.message || "") },
  });
  await prisma.channel.update({ where: { id: ch.id }, data: { verificationStatus: "pending" } });
  res.json({ ok: true });
});
