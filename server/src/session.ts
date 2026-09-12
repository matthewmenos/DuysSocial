import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import type { User } from "@prisma/client";

const COOKIE = "duys_session";

export type AuthedRequest = Request & { user?: User | null; pending2fa?: number };

function sign(payload: string) {
  const sig = crypto.createHmac("sha256", config.secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verify(token: string | undefined) {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = crypto.createHmac("sha256", config.secret).update(payload).digest("hex");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function setSession(res: Response, data: Record<string, unknown>, maxAge = 60 * 60 * 24 * 30) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  res.cookie(COOKIE, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: !config.debug,
    maxAge: maxAge * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    location: u.location,
    website: u.website,
    avatarUrl: u.avatarUrl,
    bannerUrl: u.bannerUrl,
    points: u.points,
    duysTokens: u.duysTokens,
    balanceCents: u.balanceCents,
    verifiedBadge: u.verifiedBadge,
    verifiedBadgeExpires: u.verifiedBadgeExpires,
    isAdmin: u.isAdmin,
    theme: u.theme,
    lastSeen: u.lastSeen,
    profileSlug: u.profileSlug,
    pinnedPostId: u.pinnedPostId,
    walletAddress: u.walletAddress,
    ringtoneUrl: u.ringtoneUrl,
    whoCanDm: u.whoCanDm,
    showOnline: u.showOnline,
    showLastSeen: u.showLastSeen,
    faceVerifyStatus: u.faceVerifyStatus,
    twofaEnabled: u.twofaEnabled,
    createdAt: u.createdAt,
  };
}

export async function loadUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.user = null;
  const data = verify(req.cookies?.[COOKIE]);
  if (data?.pending2fa) {
    req.pending2fa = Number(data.pending2fa);
  }
  if (data?.uid && data.authenticated) {
    const user = await prisma.user.findUnique({ where: { id: Number(data.uid) } });
    if (user && !user.isBanned) {
      req.user = user;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastSeen: new Date() },
      }).catch(() => {});
    }
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "auth_required" });
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "auth_required" });
  if (!req.user.isAdmin) return res.status(403).json({ error: "admin_required" });
  next();
}
