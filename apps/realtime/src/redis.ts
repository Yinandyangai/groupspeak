import Redis from "ioredis";
import { logger } from "./logger.js";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

/**
 * Single shared Redis connection for ordinary commands. We use Redis for:
 *
 *   • queue:bucket:{intent}:{mode}:{groupSize}          — sorted set, score = enqueueTs (ms)
 *   • queue:user:{userId}                                — hash with full enqueue payload
 *   • queue:locks:{userId}                               — string SETNX, prevents double-pair
 *   • match:recent:{userId}                              — set of recent peer userIds (TTL)
 *   • session:{sessionId}                                — hash with session metadata
 *   • session:{sessionId}:peers                          — set of userIds in session
 *   • ratelimit:chat:{userId}                            — string INCR with TTL
 */
export const redis = new Redis(url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("error", (err) => logger.error({ err }, "redis error"));
redis.on("connect", () => logger.info("redis connected"));

// Separate connection for pubsub / blocking ops if you scale to multiple nodes.
export const redisSub = redis.duplicate();
export const redisPub = redis.duplicate();

// ─── Key helpers ───────────────────────────────────────────────────

export const k = {
  bucket: (intent: string, mode: string, groupSize: number, shadow = false) =>
    `queue:bucket:${shadow ? "shadow:" : ""}${intent}:${mode}:${groupSize}`,
  userQueue: (userId: string) => `queue:user:${userId}`,
  recentMatches: (userId: string) => `match:recent:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  sessionPeers: (sessionId: string) => `session:${sessionId}:peers`,
  rateLimitChat: (userId: string) => `ratelimit:chat:${userId}`,
  /** Distributed lock used by the matchmaker tick to be safe across replicas. */
  matchmakerLock: () => "lock:matchmaker:tick",
};
