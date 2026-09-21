import { Router } from "express";
import { prisma, getSetting } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { config } from "../config.js";
import { legalDocs, legalPayload } from "../legal/index.js";

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
  // Enrich with actor + post preview so the page can render the DUYS-style rows
  // (avatar, kind badge, text, post thumbnail, unread dot) without N+1 requests.
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is number => typeof v === "number"))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } } });
  const amap = Object.fromEntries(
    actors.map((a) => [a.id, { username: a.username, displayName: a.displayName, avatarUrl: a.avatarUrl }]),
  );
  const postIds = [
    ...new Set(rows.filter((r) => r.entityType === "post" && r.entityId).map((r) => r.entityId as number)),
  ];
  const posts = await prisma.post.findMany({ where: { id: { in: postIds } } });
  const media = await prisma.media.findMany({ where: { postId: { in: postIds } } });
  const pmap = Object.fromEntries(
    posts.map((p) => {
      const m = media.find((x) => x.postId === p.id);
      return [
        p.id,
        { body: p.body, mediaUrl: m?.url || "", mediaKind: m?.kind || "" },
      ];
    }),
  );
  res.json({
    notifications: rows.map((r) => ({
      ...r,
      actor: r.actorId ? amap[r.actorId] ?? null : null,
      post: r.entityType === "post" && r.entityId ? pmap[r.entityId] ?? null : null,
    })),
  });
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
  const endpoint = String(req.body.endpoint || "");
  if (!endpoint) return res.status(400).json({ error: "no_endpoint" });
  const keys = {
    p256dh: String(req.body.keys?.p256dh || ""),
    auth: String(req.body.keys?.auth || ""),
  };
  // Upsert on endpoint: re-subscribing the same browser must not insert duplicates.
  const existing = await prisma.pushSubscription.findFirst({
    where: { userId: req.user!.id, endpoint },
  });
  if (existing) {
    await prisma.pushSubscription.update({ where: { id: existing.id }, data: keys });
  } else {
    await prisma.pushSubscription.create({ data: { userId: req.user!.id, endpoint, ...keys } });
  }
  res.json({ ok: true });
});

metaRouter.post("/push/unsubscribe", requireAuth, async (req: AuthedRequest, res) => {
  const endpoint = String(req.body.endpoint || "");
  if (!endpoint) return res.status(400).json({ error: "no_endpoint" });
  await prisma.pushSubscription.deleteMany({ where: { userId: req.user!.id, endpoint } });
  res.json({ ok: true });
});

metaRouter.get("/legal/:page", (req, res) => {
  const page = String(req.params.page);
  const docs = legalDocs(config.appName);
  const doc = docs[page];
  if (!doc) return res.status(404).json({ error: "not_found" });
  res.json(legalPayload(doc, docs));
});
