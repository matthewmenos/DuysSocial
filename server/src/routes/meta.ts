import { Router } from "express";
import { prisma, getSetting } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { config } from "../config.js";

export const metaRouter = Router();

metaRouter.get("/bootstrap", async (req: AuthedRequest, res) => {
  const unread = req.user
    ? await prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
    : 0;
  let unreadMessages = 0;
  if (req.user) {
    const mems = await prisma.conversationMember.findMany({ where: { userId: req.user.id } });
    for (const m of mems) {
      unreadMessages += await prisma.message.count({
        where: { conversationId: m.conversationId, deleted: false, id: { gt: m.lastReadMessageId } },
      });
    }
  }
  res.json({
    appName: config.appName,
    user: req.user
      ? {
          id: req.user.id,
          username: req.user.username,
          displayName: req.user.displayName,
          avatarUrl: req.user.avatarUrl,
          points: req.user.points,
          verifiedBadge: req.user.verifiedBadge,
          isAdmin: req.user.isAdmin,
          theme: req.user.theme,
        }
      : null,
    unreadNotifications: unread,
    unreadMessages,
    announcementEnabled: await getSetting("announcement_enabled", false),
    announcementText: await getSetting("announcement_text", ""),
    googleEnabled: Boolean(config.googleClientId),
    vapidPublic: config.vapidPublic,
    postCharLimit: req.user?.verifiedBadge
      ? await getSetting("post_char_limit_verified", config.postCharLimitVerified)
      : await getSetting("post_char_limit", config.postCharLimit),
  });
});

metaRouter.get("/notifications", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { id: "desc" },
    take: 50,
  });
  res.json({ notifications: rows });
});

metaRouter.get("/notifications/tray", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { id: "desc" },
    take: 12,
  });
  res.json({ notifications: rows });
});

metaRouter.post("/notifications/read", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id }, data: { isRead: true } });
  res.json({ ok: true });
});

metaRouter.post("/push/subscribe", requireAuth, async (req: AuthedRequest, res) => {
  const sub = req.body;
  await prisma.pushSubscription.create({
    data: {
      userId: req.user!.id,
      endpoint: String(sub.endpoint || ""),
      p256dh: String(sub.keys?.p256dh || ""),
      auth: String(sub.keys?.auth || ""),
    },
  });
  res.json({ ok: true });
});

metaRouter.get("/legal/:page", (req, res) => {
  const page = String(req.params.page);
  const copy: Record<string, { title: string; body: string }> = {
    terms: { title: "Terms of Service", body: "Use DUYS respectfully. Do not spam, scam, or post illegal content. $DUYS points are in-app rewards, not investment advice." },
    privacy: { title: "Privacy Policy", body: "We store account data, posts, messages, and optional verification photos. Media may live on Cloudflare R2. You can delete your account in Settings." },
    guidelines: { title: "Community Guidelines", body: "Be civil. No harassment, CSAM, or violent threats. Report abuse. Repeat offenders may be banned." },
  };
  if (!copy[page]) return res.status(404).json({ error: "not_found" });
  res.json(copy[page]);
});
