import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";

export let io: Server;

const frames = new Map<number, { jpeg: Buffer; at: number }>();
const calls = new Map<string, { convId: number; callerId: number; members: Set<number>; kind: string; status: string }>();
const mailboxes = new Map<number, unknown[]>();

export function roomFrame(roomId: number, jpeg: Buffer) {
  frames.set(roomId, { jpeg, at: Date.now() });
}
export function getRoomFrame(roomId: number) {
  return frames.get(roomId);
}

export function startCall(convId: number, callerId: number, members: number[], kind: string) {
  const id = `${Date.now()}-${callerId}`;
  calls.set(id, { convId, callerId, members: new Set(members), kind, status: "ringing" });
  for (const m of members) {
    if (m === callerId) continue;
    const box = mailboxes.get(m) || [];
    box.push({ type: "incoming", callId: id, convId, callerId, kind });
    mailboxes.set(m, box);
  }
  return id;
}

export function drainMailbox(userId: number) {
  const box = mailboxes.get(userId) || [];
  mailboxes.set(userId, []);
  return box;
}

export function pushCallEvent(userId: number, ev: unknown) {
  const box = mailboxes.get(userId) || [];
  box.push(ev);
  mailboxes.set(userId, box);
}

export function getCall(id: string) {
  return calls.get(id);
}

export function attachSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  io.on("connection", (socket) => {
    const online = new Set<number>();
    // Presence: clients declare which user this socket belongs to.
    socket.on("presence", (userId: number) => {
      online.add(Number(userId));
      io.emit("presence", { userId: Number(userId), online: true });
    });
    socket.on("disconnect", () => {
      io.emit("presence", { userId: [...online][0] ?? 0, online: false });
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
}
