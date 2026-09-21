import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { loadUser } from "./session.js";
import { ensureAdmin, seedConfig } from "./services/users.js";
import { attachSocket } from "./socket.js";
import { startCacheCleanup } from "./services/cache.js";
import { authRouter } from "./routes/auth.js";
import { socialRouter } from "./routes/social.js";
import { profileRouter } from "./routes/profile.js";
import { channelsRouter } from "./routes/channels.js";
import { messagesRouter } from "./routes/messages.js";
import { liveRouter } from "./routes/live.js";
import { moneyRouter } from "./routes/money.js";
import { claimRouter } from "./routes/claimRewards.js";
import { adminRouter } from "./routes/admin.js";
import { metaRouter } from "./routes/meta.js";

const clientDist = path.join(config.root, "client", "dist");

const app = express();
app.set("trust proxy", 1);

// The SPA is same-origin; media may be served from Cloudflare R2. CSP is only
// enforced in production because the Vite dev server injects inline preamble
// scripts (which require 'unsafe-inline' and would hide real violations).
const r2Origin = (() => {
  if (!config.r2PublicUrl) return [];
  try {
    return [new URL(config.r2PublicUrl).origin];
  } catch {
    return [];
  }
})();

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "blob:", "https:", ...r2Origin],
  mediaSrc: ["'self'", "blob:", "https:", ...r2Origin],
  fontSrc: ["'self'", "data:"],
  connectSrc: ["'self'", "ws:", "wss:", ...r2Origin],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
};

app.use(
  helmet({
    contentSecurityPolicy: config.debug ? false : { directives: cspDirectives },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(
  express.json({
    limit: "2mb",
    verify: (req: express.Request, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(loadUser);
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Credential endpoints get a much tighter budget than the global limiter so
// password/2FA guessing cannot ride on the 300/min allowance.
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});
app.use(["/api/auth/login", "/api/auth/register", "/api/auth/2fa", "/api/auth/google"], authLimiter);

app.use("/api/auth", authRouter);
app.use("/api", metaRouter);
app.use("/api", socialRouter);
app.use("/api", profileRouter);
app.use("/api/channels", channelsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/live", liveRouter);
app.use("/api", moneyRouter);
app.use("/api", claimRouter);
app.use("/api/admin", adminRouter);

fs.mkdirSync(config.localUploadDir, { recursive: true });
app.use("/media", express.static(config.localUploadDir));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve built client (production)
if (fs.existsSync(clientDist)) {
  // Hashed Vite assets are content-addressed, so they can be cached forever,
  // but index.html must always be revalidated: if a browser caches the old HTML
  // it keeps requesting a bundle filename that no longer exists after a deploy,
  // which renders a blank page until a hard refresh.
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        } else if (/[.\-][A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpg|svg)$/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/media") || req.path.startsWith("/socket.io")) {
      return next();
    }
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const server = http.createServer(app);
attachSocket(server);

server.listen(config.apiPort, async () => {
  await seedConfig();
  await ensureAdmin();
  startCacheCleanup();
  console.log(`${config.appName} API on :${config.apiPort}`);
});
