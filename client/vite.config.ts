import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/media": { target: "http://localhost:5000", changeOrigin: true },
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
        // Socket.io needs the full path passed through
        rewrite: (path) => path,
      },
      "/sw.js": { target: "http://localhost:5000", changeOrigin: true },
    },
    // Enable cors for socket.io polling
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  },
});
