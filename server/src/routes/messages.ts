import { Router } from "express";
import { randomBytes } from "node:crypto";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, publicUser, type AuthedRequest } from "../session.js";
import { saveFile } from "../services/storage.js";
import { io } from "../socket.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
export const messagesRouter = Router();

async function member(convId: number, userId: number) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: convId, userId } },
  });
}

messagesRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const memberships = await prisma.conversationMember.findMany({ where: { userId: req.user!.id } });
  const convs = await prisma.conversation.findMany({
    where: { id: { in: memberships.map((m) => m.conversationId) } },
  });
  const last = await Promise.all(
    convs.map(async (c) => {
      const msg = await prisma.message.findFirst({
        where: { conversationId: c.id, deleted: false, id: { gt: memberships.find((m) => m.conversationId === c.id)?.clearedUpto || 0 } },
        orderBy: { id: "desc" },
      });
      const mem = memberships.find((m) => m.conversationId === c.id)!;
      const unread = await prisma.message.count({
        where: { conversationId: c.id, deleted: false, id: { gt: mem.lastReadMessageId } },
      });
      const members = await prisma.conversationMember.findMany({ where: { conversationId: c.id } });
      const otherId = members.find((x) => x.userId !== req.user!.id)?.userId;
      const otherUser = otherId ? await prisma.user.findUnique({ where: { id: otherId } }) : null;
      const other = otherUser
        ? { id: otherUser.id, username: otherUser.username, displayName: otherUser.displayName, avatarUrl: otherUser.avatarUrl }
        : null;
      return { ...c, lastMessage: msg, unread, muted: mem.isMuted, other };
    }),
  );
  res.json({ conversations: last });
});

messagesRouter.get("/count", requireAuth, async (req: AuthedRequest, res) => {
  const memberships = await prisma.conversationMember.findMany({ where: { userId: req.user!.id } });
  let total = 0;
  for (const m of memberships) {
    total += await prisma.message.count({
      where: { conversationId: m.conversationId, deleted: false, id: { gt: m.lastReadMessageId } },
    });
  }
  res.json({ count: total });
});

messagesRouter.post("/start/:username", requireAuth, async (req: AuthedRequest, res) => {
  const other = await prisma.user.findUnique({ where: { username: String(req.params.username).toLowerCase() } });
  if (!other) return res.status(404).json({ error: "not_found" });
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: req.user!.id, blockedId: other.id },
        { blockerId: other.id, blockedId: req.user!.id },
      ],
    },
  });
  if (blocked) return res.status(403).json({ error: "blocked" });
  if (other.whoCanDm === "nobody") return res.status(403).json({ error: "dm_closed" });
  if (other.whoCanDm === "following") {
    const f = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: other.id, followeeId: req.user!.id } },
    });
    if (!f) return res.status(403).json({ error: "dm_closed" });
  }
  const mine = await prisma.conversationMember.findMany({ where: { userId: req.user!.id } });
  for (const m of mine) {
    const conv = await prisma.conversation.findUnique({ where: { id: m.conversationId } });
    if (!conv || conv.isGroup) continue;
    const members = await prisma.conversationMember.findMany({ where: { conversationId: conv.id } });
    if (members.length === 2 && members.some((x) => x.userId === other.id)) {
      return res.json({ conversationId: conv.id });
    }
  }
  const conv = await prisma.conversation.create({ data: { createdBy: req.user!.id, isGroup: false } });
  await prisma.conversationMember.createMany({
    data: [
      { conversationId: conv.id, userId: req.user!.id, role: "owner" },
      { conversationId: conv.id, userId: other.id, role: "member" },
    ],
  });
  res.json({ conversationId: conv.id });
});

messagesRouter.post("/group/create", requireAuth, async (req: AuthedRequest, res) => {
  const title = String(req.body.title || "Group");
  const ids: number[] = (req.body.userIds || []).map(Number);
  const conv = await prisma.conversation.create({
    data: {
      createdBy: req.user!.id,
      isGroup: true,
      title,
      description: String(req.body.description || ""),
      inviteToken: randomBytes(12).toString("hex"),
      isPrivate: Boolean(req.body.isPrivate),
    },
  });
  await prisma.conversationMember.create({
    data: { conversationId: conv.id, userId: req.user!.id, role: "owner" },
  });
  for (const id of ids) {
    if (id === req.user!.id) continue;
    await prisma.conversationMember.create({ data: { conversationId: conv.id, userId: id, role: "member" } }).catch(() => {});
  }
  res.json({ conversation: conv });
});

messagesRouter.get("/c/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const mem = await member(id, req.user!.id);
  if (!mem) return res.status(403).json({ error: "forbidden" });
  const conv = await prisma.conversation.findUnique({ where: { id } });
  const messages = await prisma.message.findMany({
    where: { conversationId: id, deleted: false, id: { gt: mem.clearedUpto } },
    orderBy: { id: "asc" },
    take: 200,
  });
  const members = await prisma.conversationMember.findMany({ where: { conversationId: id } });
  const users = await prisma.user.findMany({ where: { id: { in: members.map((m) => m.userId) } } });
  const umap = Object.fromEntries(users.map((u) => [u.id, u]));
  const withSenders = messages.map((m) => ({
    ...m,
    displayName: umap[m.senderId]?.displayName || "",
    username: umap[m.senderId]?.username || "",
    avatarUrl: umap[m.senderId]?.avatarUrl || "",
  }));
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: req.user!.id } },
    data: { lastReadMessageId: messages.at(-1)?.id || mem.lastReadMessageId },
  });
  res.json({ conversation: conv, messages: withSenders, members: users.map(publicUser), role: mem.role });
});

messagesRouter.post("/c/:id/send", requireAuth, upload.single("media"), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const mem = await member(id, req.user!.id);
  if (!mem) return res.status(403).json({ error: "forbidden" });
  let media = { mediaUrl: "", mediaKind: "", mediaKey: "", mediaMime: "" };
  if (req.file) {
    const s = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    media = { mediaUrl: s.url, mediaKind: s.kind, mediaKey: s.key, mediaMime: s.mime };
  }
  const msg = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: req.user!.id,
      body: String(req.body.body || ""),
      replyTo: req.body.replyTo ? Number(req.body.replyTo) : null,
      viewOnce: Boolean(req.body.viewOnce),
      ...media,
    },
  });
  io.to(`conv:${id}`).emit("message", { ...msg, sender: publicUser(req.user!) });
  res.json({ message: msg });
});

messagesRouter.post("/c/:id/typing", requireAuth, async (req: AuthedRequest, res) => {
  io.to(`conv:${Number(req.params.id)}`).emit("typing", { userId: req.user!.id, username: req.user!.username });
  res.json({ ok: true });
});

messagesRouter.post("/c/:id/recording", requireAuth, async (req: AuthedRequest, res) => {
  io.to(`conv:${Number(req.params.id)}`).emit("recording", { userId: req.user!.id });
  res.json({ ok: true });
});

messagesRouter.post("/m/:id/react", requireAuth, async (req: AuthedRequest, res) => {
  const messageId = Number(req.params.id);
  const emoji = String(req.body.emoji || "❤️");
  await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId, userId: req.user!.id } },
    create: { messageId, userId: req.user!.id, emoji },
    update: { emoji },
  });
  res.json({ ok: true });
});

messagesRouter.post("/m/:id/edit", requireAuth, async (req: AuthedRequest, res) => {
  const msg = await prisma.message.findUnique({ where: { id: Number(req.params.id) } });
  if (!msg || msg.senderId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  const updated = await prisma.message.update({
    where: { id: msg.id },
    data: { body: String(req.body.body || ""), edited: true },
  });
  io.to(`conv:${msg.conversationId}`).emit("message_edit", updated);
  res.json({ message: updated });
});

messagesRouter.post("/m/:id/delete", requireAuth, async (req: AuthedRequest, res) => {
  const msg = await prisma.message.findUnique({ where: { id: Number(req.params.id) } });
  if (!msg || msg.senderId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  await prisma.message.update({ where: { id: msg.id }, data: { deleted: true, body: "" } });
  io.to(`conv:${msg.conversationId}`).emit("message_delete", { id: msg.id });
  res.json({ ok: true });
});

messagesRouter.post("/m/:id/pin", requireAuth, async (req: AuthedRequest, res) => {
  const msg = await prisma.message.findUnique({ where: { id: Number(req.params.id) } });
  if (!msg) return res.status(404).json({ error: "not_found" });
  await prisma.message.update({ where: { id: msg.id }, data: { pinned: !msg.pinned } });
  res.json({ pinned: !msg.pinned });
});

messagesRouter.post("/m/:id/forward", requireAuth, async (req: AuthedRequest, res) => {
  const msg = await prisma.message.findUnique({ where: { id: Number(req.params.id) } });
  if (!msg) return res.status(404).json({ error: "not_found" });
  const srcMem = await member(msg.conversationId, req.user!.id);
  if (!srcMem) return res.status(403).json({ error: "forbidden" });
  const targetConvId = Number(req.body.conversationId);
  if (!targetConvId) return res.status(400).json({ error: "need_conversation" });
  const tgtMem = await member(targetConvId, req.user!.id);
  if (!tgtMem) return res.status(403).json({ error: "not_member" });
  const fwd = await prisma.message.create({
    data: {
      conversationId: targetConvId,
      senderId: req.user!.id,
      body: msg.body,
      mediaUrl: msg.mediaUrl,
      mediaKind: msg.mediaKind,
      mediaKey: msg.mediaKey,
      mediaMime: msg.mediaMime,
      forwarded: true,
    },
  });
  io.to(`conv:${targetConvId}`).emit("message", { ...fwd, sender: publicUser(req.user!) });
  res.json({ message: fwd });
});

messagesRouter.post("/c/:id/mute", requireAuth, async (req: AuthedRequest, res) => {
  const mem = await member(Number(req.params.id), req.user!.id);
  if (!mem) return res.status(403).json({ error: "forbidden" });
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: Number(req.params.id), userId: req.user!.id } },
    data: { isMuted: !mem.isMuted },
  });
  res.json({ muted: !mem.isMuted });
});

messagesRouter.post("/c/:id/block", requireAuth, async (req: AuthedRequest, res) => {
  const conv = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) } });
  if (!conv || conv.isGroup) return res.status(400).json({ error: "not_dm" });
  const members = await prisma.conversationMember.findMany({ where: { conversationId: conv.id } });
  const other = members.find((m) => m.userId !== req.user!.id);
  if (!other) return res.status(400).json({ error: "no_other" });
  const key = { blockerId_blockedId: { blockerId: req.user!.id, blockedId: other.userId } };
  const existing = await prisma.block.findUnique({ where: key });
  if (existing) await prisma.block.delete({ where: key });
  else await prisma.block.create({ data: { blockerId: req.user!.id, blockedId: other.userId } });
  res.json({ blocked: !existing });
});

messagesRouter.post("/c/:id/leave", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId: Number(req.params.id), userId: req.user!.id } },
  });
  res.json({ ok: true });
});

messagesRouter.get("/join/:token", requireAuth, async (req: AuthedRequest, res) => {
  const conv = await prisma.conversation.findFirst({ where: { inviteToken: String(req.params.token) } });
  if (!conv) return res.status(404).json({ error: "not_found" });
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: conv.id, userId: req.user!.id } },
    create: { conversationId: conv.id, userId: req.user!.id, role: "member" },
    update: {},
  });
  res.json({ conversationId: conv.id });
});
