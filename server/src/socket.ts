import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";

export let io: Server;

type Frame = { jpeg: Buffer; at: number };
type Call = {
  convId: number;
  callerId: number;
  members: Set<number>;
  kind: string;
  status: string;
  at: number;
};

// Everything below is in-process state. The TTLs + mailbox cap keep these maps
// from growing without bound on a long-lived server.
const FRAME_TTL_MS = 30_000; // a live frame is stale after 30s
const CALL_TTL_MS = 2 * 60 * 60 * 1000; // abandoned call records expire after 2h
const MAILBOX_MAX = 200; // per-user queued call events

const frames = new Map<number, Frame>();
const calls = new Map<string, Call>();
const mailboxes = new Map<number, unknown[]>();

export function roomFrame(roomId: number, jpeg: Buffer) {
  frames.set(roomId, { jpeg, at: Date.now() });
}

export function getRoomFrame(roomId: number) {
  const f = frames.get(roomId);
  if (!f) return undefined;
  if (Date.now() - f.at > FRAME_TTL_MS) {
    frames.delete(roomId);
    return undefined;
  }
  return f;
}

function enqueue(userId: number, ev: unknown) {
  const box = mailboxes.get(userId) || [];
  box.push(ev);
  if (box.length > MAILBOX_MAX) box.splice(0, box.length - MAILBOX_MAX);
  mailboxes.set(userId, box);
}

export function startCall(convId: number, callerId: number, members: number[], kind: string) {
  const id = `${Date.now()}-${callerId}`;
  calls.set(id, {
    convId,
    callerId,
    members: new Set(members),
    kind,
    status: "ringing",
    at: Date.now(),
  });
  for (const m of members) {
    if (m === callerId) continue;
    enqueue(m, { type: "incoming", callId: id, convId, callerId, kind });
  }
  return id;
}

/** Mark a call ended and release its record (members already received `ended`). */
export function endCall(id: string) {
  const call = calls.get(id);
  if (call) calls.delete(id);
  return call;
}

export function drainMailbox(userId: number) {
  const box = mailboxes.get(userId) || [];
  mailboxes.delete(userId);
  return box;
}

export function pushCallEvent(userId: number, ev: unknown) {
  enqueue(userId, ev);
}

export function getCall(id: string) {
  return calls.get(id);
}

/** Periodic sweep for stale frames / abandoned calls. Returns the timer (unref'd). */
export function startSocketCleanup() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [roomId, f] of frames) if (now - f.at > FRAME_TTL_MS) frames.delete(roomId);
    for (const [id, c] of calls) if (now - c.at > CALL_TTL_MS) calls.delete(id);
  }, 15_000);
  timer.unref?.();
  return timer;
}

export function attachSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  io.on("connection", (socket) => {
    // Presence is per socket (one socket == one user), so a disconnect always
    // reports the id this socket actually declared.
    let userId = 0;
    socket.on("presence", (id: number) => {
      userId = Number(id) || 0;
      if (userId) io.emit("presence", { userId, online: true });
    });
    socket.on("disconnect", () => {
      if (userId) io.emit("presence", { userId, online: false });
    });
    socket.on("join_conv", (id: number) => socket.join(`conv:${id}`));
    socket.on("leave_conv", (id: number) => socket.leave(`conv:${id}`));
    socket.on("typing", (payload: { convId: number; userId: number; username: string }) => {
      socket.to(`conv:${payload.convId}`).emit("typing", { convId: payload.convId, userId: payload.userId, username: payload.username });
    });
    socket.on("stop_typing", (payload: { convId: number; userId: number }) => {
      socket.to(`conv:${payload.convId}`).emit("stop_typing", { convId: payload.convId, userId: payload.userId });
    });
    socket.on("join_live", (id: number) => socket.join(`live:${id}`));
    socket.on("live_signal", (payload: { roomId: number; data: unknown }) => {
      socket.to(`live:${payload.roomId}`).emit("live_signal", payload);
    });
    socket.on("call_signal", (payload: { callId: string; to: number; data: unknown }) => {
      io.emit(`call:${payload.callId}`, payload);
    });
  });
  startSocketCleanup();
}
