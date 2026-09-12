import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { charLimit, feed, serializePost } from "../services/posts.js";
import { saveFile } from "../services/storage.js";
import { creditTokens, spendTokens } from "../services/points.js";
import { notify } from "../services/notify.js";
import { getFeedCache, setFeedCache, invalidateFeedCache } from "../services/cache.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
export const socialRouter = Router();

socialRouter.get("/feed", requireAuth, async (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || "for_you");
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;
  const sinceId = req.query.since ? Number(req.query.since) : undefined;
  // Check cache first (skip when paginating via beforeId or polling via sinceId)
  const useCache = beforeId === undefined && sinceId === undefined;
  if (useCache) {
    const cached = getFeedCache(req.user!.id, scope);
    if (cached) {
      return res.json(cached);
    }
  }
  // "N new posts": return count of posts newer than sinceId (for the banner)
  if (sinceId !== undefined) {
    const sincePost = await prisma.post.findUnique({ where: { id: sinceId } });
    if (!sincePost) return res.json({ newPosts: 0 });
    const count = await prisma.post.count({
      where: {
        createdAt: { gt: sincePost.createdAt },
        ...(scope === "following" ? { authorId: { in: (await prisma.follow.findMany({ where: { followerId: req.user!.id } })).map(f => f.followeeId) } } : {}),
        channelId: null,
      },
    });
    return res.json({ newPosts: count });
  }
  const posts = await feed(req.user!.id, scope, beforeId);
  const now = new Date();
  await prisma.story.deleteMany({ where: { expiresAt: { lt: now } } });
  const mine = await prisma.story.findMany({
    where: { authorId: req.user!.id, expiresAt: { gt: now } },
    orderBy: { id: "desc" },
  });
  const follows = await prisma.follow.findMany({ where: { followerId: req.user!.id } });
  const others = await prisma.story.findMany({
    where: { authorId: { in: follows.map((f) => f.followeeId) }, expiresAt: { gt: now } },
    orderBy: { id: "desc" },
  });
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(others.map((s) => s.authorId))] } },
  });
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));
  const suggestions = await prisma.user.findMany({
    where: { id: { not: req.user!.id }, isBanned: false },
    take: 5,
    orderBy: { points: "desc" },
  });
  const payload = {
    posts,
    myStory: mine,
    otherStories: others.map((s) => ({
      ...s,
      author: authorMap[s.authorId]
        ? {
            username: authorMap[s.authorId].username,
            displayName: authorMap[s.authorId].displayName,
            avatarUrl: authorMap[s.authorId].avatarUrl,
          }
        : null,
    })),
    suggestions: suggestions.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      verifiedBadge: u.verifiedBadge,
    })),
  };
  if (useCache) setFeedCache(req.user!.id, scope, payload as any);
  res.json(payload);
});

socialRouter.get("/explore", requireAuth, async (req: AuthedRequest, res) => {
  const posts = await feed(req.user!.id, "for_you");
  const topVerified = await prisma.user.findMany({
    where: { verifiedBadge: { not: "" }, isBanned: false },
    take: 6,
    orderBy: { points: "desc" },
  });
  res.json({ posts, topVerified });
});

socialRouter.get("/search", requireAuth, async (req: AuthedRequest, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [], hashtags: [], posts: [] });
  const users = await prisma.user.findMany({
    where: {
      isBanned: false,
      OR: [
        { username: { contains: q } },
        { displayName: { contains: q } },
      ],
    },
    take: 20,
  });
  const tag = q.replace(/^#/, "").toLowerCase();
  const hashtags = await prisma.hashtag.findMany({
    where: { tag: { contains: tag } },
    orderBy: { postCount: "desc" },
    take: 10,
  });
  const posts = await prisma.post.findMany({
    where: { body: { contains: q }, channelId: null },
    take: 20,
    orderBy: { id: "desc" },
  });
  const serialized = [];
  for (const p of posts) {
    const s = await serializePost(p.id, req.user!.id);
    if (s) serialized.push(s);
  }
  res.json({ users, hashtags, posts: serialized });
});

socialRouter.get("/users/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const users = await prisma.user.findMany({
    where: {
      isBanned: false,
      OR: [
        { username: { contains: q } },
        { displayName: { contains: q } },
      ],
    },
    take: 8,
  });
  res.json({ users });
});

socialRouter.get("/hashtags", requireAuth, async (_req, res) => {
  const tags = await prisma.hashtag.findMany({ orderBy: { postCount: "desc" }, take: 20 });
  res.json({ tags });
});

socialRouter.post("/posts", requireAuth, upload.array("media", 8), async (req: AuthedRequest, res) => {
  const kind = String(req.body.kind || "text");
  const body = String(req.body.body || "");
  const title = String(req.body.title || "");
  const channelId = req.body.channelId ? Number(req.body.channelId) : null;
  const pollOptions = ([] as string[])
    .concat(req.body.pollOptions || [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const isExclusive = Boolean(req.body.isExclusive);
  const unlockPrice = Number(req.body.unlockPrice || 0);
  let scheduledAt: Date | null = null;
  if (req.body.scheduledAt) {
    scheduledAt = new Date(req.body.scheduledAt);
  }
  const verified = Boolean(req.user!.verifiedBadge);
  if (kind !== "article" && body.length > (await charLimit(verified))) {
    return res.status(400).json({ error: "too_long" });
  }
  const files = (req.files as Express.Multer.File[]) || [];
  if (!body.trim() && !files.length && !pollOptions.length) return res.status(400).json({ error: "empty_post" });
  const post = await prisma.post.create({
    data: {
      authorId: req.user!.id,
      kind,
      body,
      title,
      channelId,
      isExclusive: isExclusive && verified,
      unlockPrice: isExclusive && verified ? unlockPrice : 0,
      scheduledAt: scheduledAt && verified ? scheduledAt : null,
    },
  });
  for (const f of files) {
    const saved = await saveFile(f.buffer, f.originalname, f.mimetype);
    await prisma.media.create({
      data: { postId: post.id, ownerId: req.user!.id, ...saved },
    });
  }
  for (const label of pollOptions.slice(0, 6)) {
    await prisma.pollOption.create({ data: { postId: post.id, label } });
  }
  const tags = [...body.matchAll(/#([A-Za-z0-9_]+)/g)].map((m) => m[1].toLowerCase());
  for (const tag of tags) {
    await prisma.hashtag.upsert({
      where: { tag },
      create: { tag, postCount: 1 },
      update: { postCount: { increment: 1 }, lastUsed: new Date() },
    });
  }
  invalidateFeedCache(req.user!.id);
  res.status(201).json({ post: await serializePost(post.id, req.user!.id) });
});

socialRouter.get("/posts/:id", requireAuth, async (req: AuthedRequest, res) => {
  const post = await serializePost(Number(req.params.id), req.user!.id);
  if (!post) return res.status(404).json({ error: "not_found" });
  await prisma.postView.upsert({
    where: { userId_postId: { userId: req.user!.id, postId: Number(req.params.id) } },
    create: { userId: req.user!.id, postId: Number(req.params.id) },
    update: {},
  });
  res.json({ post });
});

socialRouter.post("/posts/:id/like", requireAuth, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id);
  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: req.user!.id } },
  });
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if (existing) {
    await prisma.like.delete({ where: { postId_userId: { postId, userId: req.user!.id } } });
    await prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
    return res.json({ liked: false });
  }
  await prisma.like.create({ data: { postId, userId: req.user!.id } });
  await prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
  if (post.authorId !== req.user!.id) {
    await notify(post.authorId, `@${req.user!.username} liked your post`, {
      actorId: req.user!.id,
      kind: "like",
      entityType: "post",
      entityId: postId,
    });
  }
  res.json({ liked: true });
});

socialRouter.post("/posts/:id/repost", requireAuth, async (req: AuthedRequest, res) => {
  const orig = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
  if (!orig) return res.status(404).json({ error: "not_found" });
  const post = await prisma.post.create({
    data: { authorId: req.user!.id, kind: "text", body: "", repostOf: orig.id },
  });
  await prisma.post.update({ where: { id: orig.id }, data: { repostCount: { increment: 1 } } });
  res.json({ post: await serializePost(post.id, req.user!.id) });
});

socialRouter.post("/posts/:id/quote", requireAuth, async (req: AuthedRequest, res) => {
  const orig = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
  if (!orig) return res.status(404).json({ error: "not_found" });
  const post = await prisma.post.create({
    data: { authorId: req.user!.id, kind: "text", body: String(req.body.body || ""), quoteOf: orig.id },
  });
  await prisma.post.update({ where: { id: orig.id }, data: { quoteCount: { increment: 1 } } });
  res.json({ post: await serializePost(post.id, req.user!.id) });
});

socialRouter.post("/posts/:id/share", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.post.update({ where: { id: Number(req.params.id) }, data: { shareCount: { increment: 1 } } });
  res.json({ ok: true });
});

socialRouter.post("/posts/:id/comment", requireAuth, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id);
  const body = String(req.body.body || "").trim();
  if (!body) return res.status(400).json({ error: "empty" });
  const c = await prisma.comment.create({ data: { postId, authorId: req.user!.id, body } });
  await prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (post && post.authorId !== req.user!.id) {
    await notify(post.authorId, `@${req.user!.username} commented`, {
      actorId: req.user!.id,
      kind: "comment",
      entityType: "post",
      entityId: postId,
    });
  }
  res.json({ comment: c });
});

socialRouter.get("/posts/:id/comments", requireAuth, async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { postId: Number(req.params.id) },
    orderBy: { id: "asc" },
  });
  const authors = await prisma.user.findMany({ where: { id: { in: comments.map((c) => c.authorId) } } });
  const map = Object.fromEntries(authors.map((a) => [a.id, a]));
  res.json({
    comments: comments.map((c) => ({
      ...c,
      author: map[c.authorId]
        ? { username: map[c.authorId].username, displayName: map[c.authorId].displayName, avatarUrl: map[c.authorId].avatarUrl, verifiedBadge: map[c.authorId].verifiedBadge }
        : null,
    })),
  });
});

socialRouter.post("/comments/:id/like", requireAuth, async (req: AuthedRequest, res) => {
  const commentId = Number(req.params.id);
  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId: req.user!.id } },
  });
  if (existing) {
    await prisma.commentLike.delete({ where: { commentId_userId: { commentId, userId: req.user!.id } } });
    await prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } });
    return res.json({ liked: false });
  }
  await prisma.commentLike.create({ data: { commentId, userId: req.user!.id } });
  await prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
  res.json({ liked: true });
});

socialRouter.post("/posts/:id/vote", requireAuth, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id);
  const optionId = Number(req.body.optionId);
  const existing = await prisma.pollVote.findUnique({
    where: { postId_userId: { postId, userId: req.user!.id } },
  });
  if (existing) return res.status(400).json({ error: "already_voted" });
  await prisma.pollVote.create({ data: { postId, userId: req.user!.id, optionId } });
  await prisma.pollOption.update({ where: { id: optionId }, data: { votes: { increment: 1 } } });
  res.json({ ok: true });
});

socialRouter.post("/posts/:id/unlock", requireAuth, async (req: AuthedRequest, res) => {
  const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
  if (!post?.isExclusive) return res.status(400).json({ error: "not_exclusive" });
  const ok = await spendTokens(req.user!.id, post.unlockPrice);
  if (!ok) return res.status(400).json({ error: "insufficient_tokens" });
  await creditTokens(post.authorId, post.unlockPrice);
  await prisma.postUnlock.create({
    data: { userId: req.user!.id, postId: post.id, paid: post.unlockPrice },
  });
  res.json({ post: await serializePost(post.id, req.user!.id) });
});

socialRouter.post("/posts/:id/delete", requireAuth, async (req: AuthedRequest, res) => {
  const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
  if (!post) return res.status(404).json({ error: "not_found" });
  if (post.authorId !== req.user!.id && !req.user!.isAdmin) return res.status(403).json({ error: "forbidden" });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true });
});

socialRouter.post("/posts/:id/bookmark", requireAuth, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id);
  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId: req.user!.id, postId } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { userId_postId: { userId: req.user!.id, postId } } });
    return res.json({ bookmarked: false });
  }
  await prisma.bookmark.create({ data: { userId: req.user!.id, postId } });
  res.json({ bookmarked: true });
});

socialRouter.post("/report", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.report.create({
    data: {
      reporterId: req.user!.id,
      postId: req.body.postId ? Number(req.body.postId) : null,
      reportedUserId: req.body.userId ? Number(req.body.userId) : null,
      reason: String(req.body.reason || ""),
      weight: req.user!.verifiedBadge ? 2 : 1,
    },
  });
  res.json({ ok: true });
});
