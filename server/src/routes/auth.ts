import { Router } from "express";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { applyReferral, sanitizeUsername, USERNAME_RE } from "../services/users.js";
import {
  clearSession,
  publicUser,
  requireAuth,
  setSession,
  type AuthedRequest,
} from "../session.js";

export const authRouter = Router();

authRouter.get("/me", (req: AuthedRequest, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user) });
});

authRouter.get("/check-username", async (req, res) => {
  const u = sanitizeUsername(String(req.query.username || ""));
  if (!USERNAME_RE.test(u)) return res.json({ available: false, reason: "invalid" });
  const exists = await prisma.user.findUnique({ where: { username: u } });
  res.json({ available: !exists });
});

authRouter.post("/register", async (req: AuthedRequest, res) => {
  const displayName = String(req.body.displayName || "").trim();
  const username = sanitizeUsername(String(req.body.username || ""));
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const confirm = String(req.body.confirmPassword || "");
  const ref = String(req.body.ref || "");
  if (!displayName || !USERNAME_RE.test(username) || !email.includes("@") || password.length < 8) {
    return res.status(400).json({ error: "invalid_fields" });
  }
  if (password !== confirm) return res.status(400).json({ error: "password_mismatch" });
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "email_taken" });
  if (await prisma.user.findUnique({ where: { username } })) return res.status(409).json({ error: "username_taken" });
  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  await applyReferral(user.id, ref);
  setSession(res, { uid: user.id, authenticated: true });
  res.json({ user: publicUser(user) });
});

authRouter.post("/login", async (req: AuthedRequest, res) => {
  const ident = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: ident }, { username: ident }] },
  });
  if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid_credentials" });
  if (user.isBanned) return res.status(403).json({ error: "banned" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  if (user.twofaEnabled) {
    setSession(res, { pending2fa: user.id }, 600);
    return res.json({ twofa: true });
  }
  setSession(res, { uid: user.id, authenticated: true });
  res.json({ user: publicUser(user) });
});

authRouter.post("/2fa/verify", async (req: AuthedRequest, res) => {
  const uid = req.pending2fa;
  if (!uid) return res.status(400).json({ error: "no_challenge" });
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user?.twofaSecret) return res.status(400).json({ error: "no_challenge" });
  const token = String(req.body.token || "");
  if (!authenticator.check(token, user.twofaSecret)) return res.status(401).json({ error: "bad_code" });
  setSession(res, { uid: user.id, authenticated: true });
  res.json({ user: publicUser(user) });
});

authRouter.get("/2fa/setup", requireAuth, async (req: AuthedRequest, res) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(req.user!.email, config.appName, secret);
  const qr = await QRCode.toDataURL(otpauth);
  res.json({ secret, qr });
});

authRouter.post("/2fa/enable", requireAuth, async (req: AuthedRequest, res) => {
  const secret = String(req.body.secret || "");
  const token = String(req.body.token || "");
  if (!authenticator.check(token, secret)) return res.status(400).json({ error: "bad_code" });
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { twofaSecret: secret, twofaEnabled: true },
  });
  res.json({ ok: true });
});

authRouter.post("/2fa/disable", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { twofaSecret: "", twofaEnabled: false },
  });
  res.json({ ok: true });
});

authRouter.get("/google", (_req, res) => {
  if (!config.googleClientId) return res.status(400).json({ error: "google_disabled" });
  const redirect = `${config.appUrl.replace(/\/$/, "")}/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", `${config.clientOrigin}/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  void redirect;
  res.json({ url: url.toString() });
});

authRouter.post("/google/callback", async (req, res) => {
  if (!config.googleClientId) return res.status(400).json({ error: "google_disabled" });
  const code = String(req.body.code || "");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: `${config.clientOrigin}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return res.status(400).json({ error: "oauth_failed" });
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as { id: string; email: string; name?: string; picture?: string };
  if (!profile.email) return res.status(400).json({ error: "no_email" });
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.id }, { email: profile.email.toLowerCase() }] },
  });
  if (!user) {
    return res.json({
      needsUsername: true,
      google: { id: profile.id, email: profile.email, name: profile.name, picture: profile.picture },
    });
  }
  if (!user.googleId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.id } });
  }
  if (user.isBanned) return res.status(403).json({ error: "banned" });
  setSession(res, { uid: user.id, authenticated: true });
  res.json({ user: publicUser(user) });
});

authRouter.post("/google/setup", async (req, res) => {
  const googleId = String(req.body.googleId || "");
  const email = String(req.body.email || "").toLowerCase();
  const displayName = String(req.body.displayName || "").trim();
  const username = sanitizeUsername(String(req.body.username || ""));
  const avatarUrl = String(req.body.avatarUrl || "");
  const ref = String(req.body.ref || "");
  if (!googleId || !email || !USERNAME_RE.test(username)) return res.status(400).json({ error: "invalid" });
  if (await prisma.user.findUnique({ where: { username } })) return res.status(409).json({ error: "username_taken" });
  const user = await prisma.user.create({
    data: { googleId, email, username, displayName: displayName || username, avatarUrl },
  });
  await applyReferral(user.id, ref);
  setSession(res, { uid: user.id, authenticated: true });
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});
