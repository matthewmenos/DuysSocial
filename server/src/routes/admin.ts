import { Router } from "express";
import { prisma, getSetting, setSetting } from "../prisma.js";
import { requireAdmin, publicUser, type AuthedRequest } from "../session.js";
import { notify } from "../services/notify.js";
import { creditPoints } from "../services/points.js";
import { config } from "../config.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

async function log(req: AuthedRequest, action: string, targetType = "", targetId = 0, detail = "") {
  await prisma.adminActivityLog.create({
    data: {
      adminId: req.user!.id,
      adminUsername: req.user!.username,
      action,
      targetType,
      targetId,
      detail,
    },
  });
}

adminRouter.get("/overview", async (_req, res) => {
  const [users, posts, reports, pendingVerif] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.report.count({ where: { status: "open" } }),
    prisma.verificationRequest.count({ where: { status: "pending" } }),
  ]);
  res.json({ users, posts, reports, pendingVerif });
});

adminRouter.get("/analytics", async (_req, res) => {
  const users = await prisma.user.count();
  const posts = await prisma.post.count();
  const messages = await prisma.message.count();
  const points = await prisma.user.aggregate({ _sum: { points: true } });
  res.json({ users, posts, messages, points: points._sum.points || 0 });
});

adminRouter.get("/users", async (req, res) => {
  const q = String(req.query.q || "");
  const filter = String(req.query.filter || "");
  const users = await prisma.user.findMany({
    where: {
      ...(filter === "banned" ? { isBanned: true } : {}),
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
    take: 100,
  });
  res.json({ users: users.map(publicUser) });
});

adminRouter.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ error: "not_found" });
  const notes = await prisma.adminNote.findMany({ where: { userId: user.id }, orderBy: { id: "desc" } });
  res.json({ user: { ...publicUser(user), email: user.email, isBanned: user.isBanned, isAdmin: user.isAdmin }, notes });
});

adminRouter.post("/users/:id/ban", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ error: "not_found" });
  await prisma.user.update({ where: { id: user.id }, data: { isBanned: !user.isBanned } });
  await log(req, user.isBanned ? "unban" : "ban", "user", user.id);
  res.json({ banned: !user.isBanned });
});

adminRouter.post("/users/:id/badge", async (req: AuthedRequest, res) => {
  const badge = String(req.body.badge || "");
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { verifiedBadge: badge, verifiedBadgeExpires: badge ? expires.toISOString().slice(0, 10) : "" },
  });
  await log(req, "badge", "user", Number(req.params.id), badge);
  res.json({ ok: true });
});

adminRouter.post("/users/:id/delete", async (req: AuthedRequest, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  await log(req, "delete_user", "user", Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.post("/users/:id/credit", async (req: AuthedRequest, res) => {
  const amount = Number(req.body.amount || 0);
  await creditPoints(Number(req.params.id), amount, "admin_credit");
  await log(req, "credit", "user", Number(req.params.id), String(amount));
  res.json({ ok: true });
});

adminRouter.post("/users/:id/debit", async (req: AuthedRequest, res) => {
  const amount = Number(req.body.amount || 0);
  await creditPoints(Number(req.params.id), -Math.abs(amount), "admin_debit");
  await log(req, "debit", "user", Number(req.params.id), String(amount));
  res.json({ ok: true });
});

adminRouter.post("/users/:id/note", async (req: AuthedRequest, res) => {
  const note = await prisma.adminNote.create({
    data: { userId: Number(req.params.id), adminId: req.user!.id, note: String(req.body.note || "") },
  });
  res.json({ note });
});

adminRouter.post("/users/:id/toggle-admin", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ error: "not_found" });
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: !user.isAdmin } });
  res.json({ isAdmin: !user.isAdmin });
});

adminRouter.get("/verifications", async (_req, res) => {
  const rows = await prisma.verificationRequest.findMany({ where: { status: "pending" }, orderBy: { id: "desc" } });
  res.json({ requests: rows });
});

adminRouter.post("/verifications/:id/:action", async (req: AuthedRequest, res) => {
  const row = await prisma.verificationRequest.findUnique({ where: { id: Number(req.params.id) } });
  if (!row) return res.status(404).json({ error: "not_found" });
  const action = String(req.params.action);
  if (action === "approve") {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);
    await prisma.user.update({
      where: { id: row.userId },
      data: { verifiedBadge: row.badge, verifiedBadgeExpires: expires.toISOString().slice(0, 10) },
    });
  }
  await prisma.verificationRequest.update({
    where: { id: row.id },
    data: { status: action === "approve" ? "approved" : "rejected", reviewedBy: req.user!.id },
  });
  await notify(row.userId, `Verification ${action}d`, { kind: "system" });
  res.json({ ok: true });
});

adminRouter.get("/finance", async (_req, res) => {
  const txs = await prisma.walletTx.findMany({ orderBy: { id: "desc" }, take: 100 });
  res.json({ txs });
});

adminRouter.post("/finance/:id/:action", async (req: AuthedRequest, res) => {
  await prisma.walletTx.update({
    where: { id: Number(req.params.id) },
    data: { status: req.params.action === "approve" ? "completed" : "rejected" },
  });
  res.json({ ok: true });
});

adminRouter.get("/posts", async (req, res) => {
  const posts = await prisma.post.findMany({ orderBy: { id: "desc" }, take: 80 });
  res.json({ posts });
});

adminRouter.post("/posts/:id/delete", async (req: AuthedRequest, res) => {
  await prisma.post.delete({ where: { id: Number(req.params.id) } });
  await log(req, "delete_post", "post", Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.get("/reports", async (_req, res) => {
  const reports = await prisma.report.findMany({ where: { status: "open" }, orderBy: { weight: "desc" } });
  res.json({ reports });
});

adminRouter.post("/reports/:id/dismiss", async (req, res) => {
  await prisma.report.update({ where: { id: Number(req.params.id) }, data: { status: "dismissed" } });
  res.json({ ok: true });
});

adminRouter.post("/reports/:id/delete-post", async (req, res) => {
  const r = await prisma.report.findUnique({ where: { id: Number(req.params.id) } });
  if (r?.postId) await prisma.post.delete({ where: { id: r.postId } }).catch(() => {});
  await prisma.report.update({ where: { id: r!.id }, data: { status: "actioned" } });
  res.json({ ok: true });
});

adminRouter.post("/reports/:id/ban-user", async (req, res) => {
  const r = await prisma.report.findUnique({ where: { id: Number(req.params.id) } });
  if (r?.reportedUserId) await prisma.user.update({ where: { id: r.reportedUserId }, data: { isBanned: true } });
  await prisma.report.update({ where: { id: r!.id }, data: { status: "actioned" } });
  res.json({ ok: true });
});

adminRouter.get("/subscriptions", async (_req, res) => {
  const tiers = await prisma.subscriptionTier.findMany();
  res.json({ tiers });
});

adminRouter.post("/subscriptions", async (req, res) => {
  const tier = await prisma.subscriptionTier.create({
    data: { name: String(req.body.name || "Tier"), priceDuys: Number(req.body.priceDuys || 0) },
  });
  res.json({ tier });
});

adminRouter.post("/subscriptions/:id/update", async (req, res) => {
  const tier = await prisma.subscriptionTier.update({
    where: { id: Number(req.params.id) },
    data: { name: String(req.body.name || ""), priceDuys: Number(req.body.priceDuys || 0) },
  });
  res.json({ tier });
});

adminRouter.post("/subscriptions/:id/delete", async (req, res) => {
  await prisma.subscriptionTier.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

adminRouter.get("/economy", async (_req, res) => {
  const keys = ["verification_fee_blue", "verification_fee_gold", "verification_fee_grey", "boost_fee_usd_per_day", "post_char_limit", "post_char_limit_verified"];
  const values: Record<string, unknown> = {};
  for (const k of keys) values[k] = await getSetting(k, "");
  res.json({ values });
});

adminRouter.post("/economy", async (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) await setSetting(k, String(v));
  res.json({ ok: true });
});

adminRouter.get("/settings", async (_req, res) => {
  res.json({
    announcement_enabled: await getSetting("announcement_enabled", false),
    announcement_text: await getSetting("announcement_text", ""),
  });
});

adminRouter.post("/settings", async (req, res) => {
  if (req.body.announcement_enabled != null) await setSetting("announcement_enabled", Boolean(req.body.announcement_enabled));
  if (req.body.announcement_text != null) await setSetting("announcement_text", String(req.body.announcement_text));
  res.json({ ok: true });
});

adminRouter.get("/features", async (_req, res) => {
  res.json({
    swap_buy_enabled: await getSetting("swap_buy_enabled", true),
    swap_sell_enabled: await getSetting("swap_sell_enabled", true),
  });
});

adminRouter.post("/features", async (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) await setSetting(k, v as string | boolean);
  res.json({ ok: true });
});

adminRouter.post("/broadcast", async (req: AuthedRequest, res) => {
  const body = String(req.body.body || "");
  const title = String(req.body.title || "Announcement");
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) await notify(u.id, body, { kind: "system" });
  await prisma.broadcastLog.create({ data: { adminId: req.user!.id, title, body } });
  res.json({ ok: true, sent: users.length });
});

adminRouter.get("/blockchain", async (_req, res) => {
  const claims = await prisma.tokenClaim.findMany({ orderBy: { id: "desc" }, take: 50 });
  res.json({ claims, enabled: config.blockchainEnabled, vault: config.vaultAddress, contract: config.duysContract });
});

adminRouter.post("/blockchain/claims/:id/void", async (req, res) => {
  await prisma.tokenClaim.update({ where: { id: Number(req.params.id) }, data: { status: "failed", errorMsg: "voided" } });
  res.json({ ok: true });
});

adminRouter.get("/stories", async (_req, res) => {
  res.json({ stories: await prisma.story.findMany({ orderBy: { id: "desc" }, take: 50 }) });
});
adminRouter.post("/stories/:id/delete", async (req, res) => {
  await prisma.story.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
adminRouter.get("/comments", async (_req, res) => {
  res.json({ comments: await prisma.comment.findMany({ orderBy: { id: "desc" }, take: 80 }) });
});
adminRouter.post("/comments/:id/delete", async (req, res) => {
  await prisma.comment.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
adminRouter.get("/live", async (_req, res) => {
  res.json({ rooms: await prisma.room.findMany({ orderBy: { id: "desc" }, take: 40 }) });
});
adminRouter.post("/live/:id/end", async (req, res) => {
  await prisma.room.update({ where: { id: Number(req.params.id) }, data: { status: "ended", endedAt: new Date() } });
  res.json({ ok: true });
});
adminRouter.get("/channels", async (_req, res) => {
  res.json({ channels: await prisma.channel.findMany({ orderBy: { id: "desc" } }) });
});
adminRouter.post("/channels/:id/delete", async (req, res) => {
  await prisma.channel.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
adminRouter.post("/channels/:id/badge", async (req, res) => {
  await prisma.channel.update({ where: { id: Number(req.params.id) }, data: { verifiedBadge: String(req.body.badge || "") } });
  res.json({ ok: true });
});
adminRouter.get("/groups", async (_req, res) => {
  res.json({ groups: await prisma.conversation.findMany({ where: { isGroup: true } }) });
});
adminRouter.post("/groups/:id/delete", async (req, res) => {
  await prisma.conversation.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
adminRouter.post("/groups/:id/badge", async (req, res) => {
  await prisma.conversation.update({ where: { id: Number(req.params.id) }, data: { verifiedBadge: String(req.body.badge || "") } });
  res.json({ ok: true });
});
adminRouter.get("/entity-verifications", async (_req, res) => {
  res.json({
    channels: await prisma.channelVerifApp.findMany({ where: { status: "pending" } }),
    groups: await prisma.groupVerifApp.findMany({ where: { status: "pending" } }),
    faces: await prisma.user.findMany({ where: { faceVerifyStatus: "pending" }, take: 50 }),
  });
});
adminRouter.post("/verifications/channel/:id/:action", async (req, res) => {
  const app = await prisma.channelVerifApp.findUnique({ where: { id: Number(req.params.id) } });
  if (!app) return res.status(404).json({ error: "not_found" });
  const ok = req.params.action === "approve";
  await prisma.channelVerifApp.update({ where: { id: app.id }, data: { status: ok ? "approved" : "rejected", reviewedAt: new Date() } });
  if (ok) await prisma.channel.update({ where: { id: app.channelId }, data: { verifiedBadge: "blue", verificationStatus: "approved" } });
  res.json({ ok: true });
});
adminRouter.post("/verifications/group/:id/:action", async (req, res) => {
  const app = await prisma.groupVerifApp.findUnique({ where: { id: Number(req.params.id) } });
  if (!app) return res.status(404).json({ error: "not_found" });
  const ok = req.params.action === "approve";
  await prisma.groupVerifApp.update({ where: { id: app.id }, data: { status: ok ? "approved" : "rejected", reviewedAt: new Date() } });
  if (ok) await prisma.conversation.update({ where: { id: app.groupId }, data: { verifiedBadge: "blue", verificationStatus: "approved" } });
  res.json({ ok: true });
});
adminRouter.post("/face/:userId/:action", async (req, res) => {
  const status = req.params.action === "approve" ? "verified" : "rejected";
  await prisma.user.update({ where: { id: Number(req.params.userId) }, data: { faceVerifyStatus: status } });
  res.json({ ok: true });
});
adminRouter.get("/activity", async (_req, res) => {
  res.json({ logs: await prisma.adminActivityLog.findMany({ orderBy: { id: "desc" }, take: 100 }) });
});
adminRouter.get("/content", async (req, res) => {
  const q = String(req.query.q || "");
  const posts = q ? await prisma.post.findMany({ where: { body: { contains: q } }, take: 30 }) : [];
  const comments = q ? await prisma.comment.findMany({ where: { body: { contains: q } }, take: 30 }) : [];
  res.json({ posts, comments });
});
adminRouter.get("/boosts", async (_req, res) => {
  res.json({ boosts: await prisma.boost.findMany({ orderBy: { id: "desc" }, take: 50 }) });
});
adminRouter.post("/boosts/:id/cancel", async (req, res) => {
  const b = await prisma.boost.findUnique({ where: { id: Number(req.params.id) } });
  if (b) await prisma.post.update({ where: { id: b.postId }, data: { isSponsored: false, boostUntil: null } });
  res.json({ ok: true });
});
