import fs from "node:fs";
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

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
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

const server = http.createServer(app);
attachSocket(server);

server.listen(config.apiPort, async () => {
  await seedConfig();
  await ensureAdmin();
  startCacheCleanup();
  console.log(`${config.appName} API on :${config.apiPort}`);
});
