import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { spendTokens, creditTokens } from "../services/points.js";
import { io, roomFrame, getRoomFrame } from "../socket.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
export const liveRouter = Router();

liveRouter.get("/", requireAuth, async (_req, res) => {
  const rooms = await prisma.room.findMany({ where: { status: "live" }, orderBy: { id: "desc" } });
  const hosts = await prisma.user.findMany({ where: { id: { in: rooms.map((r) => r.hostId) } } });
  const map = Object.fromEntries(hosts.map((h) => [h.id, h]));
  res.json({
    rooms: rooms.map((r) => ({
      ...r,
      host: map[r.hostId]
        ? { username: map[r.hostId].username, displayName: map[r.hostId].displayName, avatarUrl: map[r.hostId].avatarUrl }
        : null,
    })),
  });
});

liveRouter.post("/start", requireAuth, async (req: AuthedRequest, res) => {
  const room = await prisma.room.create({
    data: {
      hostId: req.user!.id,
      kind: req.body.kind === "space" ? "space" : "video",
      title: String(req.body.title || `${req.user!.displayName}'s room`),
    },
  });
  res.json({ room });
});

liveRouter.get("/:id", requireAuth, async (req, res) => {
  const room = await prisma.room.findUnique({ where: { id: Number(req.params.id) } });
  if (!room) return res.status(404).json({ error: "not_found" });
  const host = await prisma.user.findUnique({ where: { id: room.hostId } });
  const messages = await prisma.roomMessage.findMany({ where: { roomId: room.id }, orderBy: { id: "asc" }, take: 100 });
  res.json({
    room,
    host: host ? { username: host.username, displayName: host.displayName, avatarUrl: host.avatarUrl, verifiedBadge: host.verifiedBadge } : null,
    messages,
  });
});

liveRouter.post("/:id/frame", requireAuth, upload.single("frame"), async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({ where: { id: Number(req.params.id) } });
  if (!room || room.hostId !== req.user!.id) return res.status(403).json({ error: "forbidden" });
  if (req.file) {
    roomFrame(room.id, req.file.buffer);
    io.to(`live:${room.id}`).emit("frame", { at: Date.now() });
  }
  res.json({ ok: true });
});

liveRouter.get("/:id/frame.jpg", async (req, res) => {
  const f = getRoomFrame(Number(req.params.id));
  if (!f) return res.status(404).end();
  res.setHeader("Content-Type", "image/jpeg");
  res.send(f.jpeg);
});

liveRouter.post("/:id/chat", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = Number(req.params.id);
  const msg = await prisma.roomMessage.create({
    data: { roomId, userId: req.user!.id, body: String(req.body.body || "") },
  });
  io.to(`live:${roomId}`).emit("chat", { ...msg, username: req.user!.username });
  res.json({ message: msg });
});

liveRouter.post("/:id/react", requireAuth, async (req: AuthedRequest, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("react", { emoji: req.body.emoji || "❤️", userId: req.user!.id });
  res.json({ ok: true });
});

liveRouter.post("/:id/end", requireAuth, async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({ where: { id: Number(req.params.id) } });
  if (!room || (room.hostId !== req.user!.id && !req.user!.isAdmin)) return res.status(403).json({ error: "forbidden" });
  await prisma.room.update({ where: { id: room.id }, data: { status: "ended", endedAt: new Date() } });
  io.to(`live:${room.id}`).emit("ended");
  res.json({ ok: true });
});

liveRouter.post("/:id/tip", requireAuth, async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({ where: { id: Number(req.params.id) } });
  if (!room) return res.status(404).json({ error: "not_found" });
  const amount = Number(req.body.amount || 0);
  const ok = await spendTokens(req.user!.id, amount);
  if (!ok) return res.status(400).json({ error: "insufficient" });
  await creditTokens(room.hostId, amount);
  io.to(`live:${room.id}`).emit("tip", { from: req.user!.username, amount });
  res.json({ ok: true });
});

liveRouter.post("/:id/speak-request", requireAuth, (req: AuthedRequest, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("speak_request", { userId: req.user!.id, username: req.user!.username });
  res.json({ ok: true });
});
liveRouter.post("/:id/speak-allow", requireAuth, (req, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("speak_allow", { userId: Number(req.body.userId) });
  res.json({ ok: true });
});
liveRouter.post("/:id/speak-deny", requireAuth, (req, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("speak_deny", { userId: Number(req.body.userId) });
  res.json({ ok: true });
});
liveRouter.post("/:id/join-request", requireAuth, (req: AuthedRequest, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("join_request", { userId: req.user!.id, username: req.user!.username });
  res.json({ ok: true });
});
liveRouter.post("/:id/join-allow", requireAuth, (req, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("join_allow", { userId: Number(req.body.userId) });
  res.json({ ok: true });
});
liveRouter.post("/:id/join-deny", requireAuth, (req, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("join_deny", { userId: Number(req.body.userId) });
  res.json({ ok: true });
});
liveRouter.post("/:id/signal", requireAuth, (req, res) => {
  io.to(`live:${Number(req.params.id)}`).emit("live_signal", req.body);
  res.json({ ok: true });
});
