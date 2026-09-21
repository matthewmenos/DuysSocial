import { prisma, getSetting } from "../prisma.js";
import { config } from "../config.js";

export async function serializePost(postId: number, viewerId?: number) {
  const p = await prisma.post.findUnique({ where: { id: postId } });
  if (!p) return null;
  if (p.scheduledAt && p.scheduledAt > new Date() && p.authorId !== viewerId) return null;
  const author = await prisma.user.findUnique({ where: { id: p.authorId } });
  if (!author || author.isBanned) return null;
  const media = await prisma.media.findMany({ where: { postId: p.id } });
  const poll = await prisma.pollOption.findMany({ where: { postId: p.id } });
  const preview = await prisma.linkPreview.findUnique({ where: { postId: p.id } });
  let liked = false;
  let votedOption: number | null = null;
  let unlocked = !p.isExclusive || p.authorId === viewerId;
  let bookmarked = false;
  if (viewerId) {
    liked = Boolean(await prisma.like.findUnique({ where: { postId_userId: { postId: p.id, userId: viewerId } } }));
    const vote = await prisma.pollVote.findUnique({ where: { postId_userId: { postId: p.id, userId: viewerId } } });
    votedOption = vote?.optionId ?? null;
    if (p.isExclusive) {
      unlocked = Boolean(
        await prisma.postUnlock.findUnique({ where: { userId_postId: { userId: viewerId, postId: p.id } } }),
      ) || p.authorId === viewerId;
    }
    bookmarked = Boolean(
      await prisma.bookmark.findUnique({ where: { userId_postId: { userId: viewerId, postId: p.id } } }),
    );
  }
  let quote: unknown = null;
  if (p.quoteOf) quote = await serializePost(p.quoteOf, viewerId);
  let repostOf: unknown = null;
  if (p.repostOf) repostOf = await serializePost(p.repostOf, viewerId);
  return {
    id: p.id,
    kind: p.kind,
    body: unlocked ? p.body : "",
    title: p.title,
    authorId: p.authorId,
    viewCount: p.viewCount,
    isSponsored: p.isSponsored,
    cta: p.cta,
    landingUrl: p.landingUrl,
    isExclusive: p.isExclusive,
    unlockPrice: p.unlockPrice,
    unlocked,
    scheduledAt: p.scheduledAt,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    repostCount: p.repostCount,
    quoteCount: p.quoteCount,
    shareCount: p.shareCount,
    createdAt: p.createdAt,
    liked,
    votedOption,
    bookmarked,
    media,
    poll,
    preview,
    quote,
    repostOf,
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      verifiedBadge: author.verifiedBadge,
    },
  };
}

export async function feed(viewerId: number, scope = "for_you", beforeId?: number) {
  const now = new Date();
  const where: Record<string, unknown> = {
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
  };
  if (beforeId) where.id = { lt: beforeId };
  if (scope === "following") {
    const follows = await prisma.follow.findMany({ where: { followerId: viewerId } });
    where.authorId = { in: follows.map((f) => f.followeeId).concat(viewerId) };
    where.channelId = null;
  } else if (scope === "channels") {
    const subs = await prisma.channelSubscription.findMany({ where: { userId: viewerId } });
    where.channelId = { in: subs.map((s) => s.channelId) };
  } else {
    where.channelId = null;
  }
  const rows = await prisma.post.findMany({
    where,
    orderBy: [{ isSponsored: "desc" }, { id: "desc" }],
    take: 20,
  });
  const out = [];
  for (const r of rows) {
    const s = await serializePost(r.id, viewerId);
    if (s) out.push(s);
  }
  return out;
}

export async function charLimit(verified: boolean) {
  return verified
    ? Number(await getSetting("post_char_limit_verified", config.postCharLimitVerified))
    : Number(await getSetting("post_char_limit", config.postCharLimit));
}

/** Storage keys of a post's media, so deleting the post can free the objects too. */
export async function postAssetKeys(postId: number) {
  const rows = await prisma.media.findMany({ where: { postId }, select: { key: true } });
  return rows.map((r) => r.key);
}
