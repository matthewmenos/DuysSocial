/**
 * In-memory TTL cache for the public feed endpoint.
 * Avoids hammering Neon PostgreSQL on every /api/feed request.
 * TTL: 20 seconds (within the 15–30s range requested).
 */
import type { User, Post, Story, Follow, Block } from "@prisma/client";

interface CachedFeed {
  posts: (Post & { author: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "verifiedBadge" | "isBanned"> })[];
  myStory: Story[];
  otherStories: (Story & { author: Pick<User, "id" | "username" | "displayName" | "avatarUrl"> | null })[];
  suggestions: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "verifiedBadge">[];
}

interface CacheEntry {
  data: CachedFeed;
  expiresAt: number;
}

const feedCache = new Map<string, CacheEntry>();
const FEED_TTL_MS = 20_000; // 20 seconds

/**
 * Get a cached feed response for a given user + scope.
 * Returns null if cache is stale or missing.
 */
export function getFeedCache(userId: number, scope: string): CachedFeed | null {
  const key = `${userId}:${scope}`;
  const entry = feedCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    feedCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a feed response in the cache.
 */
export function setFeedCache(userId: number, scope: string, data: CachedFeed): void {
  const key = `${userId}:${scope}`;
  feedCache.set(key, {
    data,
    expiresAt: Date.now() + FEED_TTL_MS,
  });
  // Cap cache size to prevent memory leaks
  if (feedCache.size > 200) {
    const oldestKey = feedCache.keys().next().value;
    if (oldestKey) feedCache.delete(oldestKey);
  }
}

/**
 * Invalidate feed cache for a user (called when a new post is created).
 */
export function invalidateFeedCache(userId: number): void {
  // Invalidate all scopes for this user
  for (const key of feedCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      feedCache.delete(key);
    }
  }
}

/**
 * Clear all feed cache entries (useful on admin actions or periodic cleanup).
 */
export function clearFeedCache(): void {
  feedCache.clear();
}

/**
 * Background TTL cleanup — runs every 10s to purge expired entries.
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCacheCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of feedCache.entries()) {
      if (entry.expiresAt < now) feedCache.delete(key);
    }
  }, 10_000);
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
