import { io } from "socket.io-client";

// Connect to the API server via the Vite dev proxy (/socket.io -> API server).
// In production the built client is served by the API server itself, so the
// relative URL (same origin) is correct.
export const socket = io(import.meta.env.VITE_API_URL || "", {
  withCredentials: true,
  autoConnect: true,
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  path: "/socket.io",
});

// Dev logging for debugging connection issues.
if (import.meta.env.DEV) {
  socket.on("connect", () => console.info("[socket] connected", socket.id));
  socket.on("disconnect", (reason) => console.info("[socket] disconnect", reason));
  socket.on("connect_error", (err: Error & { description?: unknown }) =>
    console.error("[socket] connect_error", err.message, err.description));
}
