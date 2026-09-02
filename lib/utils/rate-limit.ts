/**
 * Extract client IP from request headers.
 * Prefers Vercel's `x-real-ip` (platform-set, not user-controllable),
 * falls back to the last value in `x-forwarded-for` (platform-appended).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown"
  );
}

/**
 * Distributed rate limiter using Vercel KV
 * Falls back to in-memory storage for local development only.
 * In production, fails closed (returns 429) when KV errors at request time, to
 * prevent distributed callers from multiplying their allowance across server
 * instances. When KV was never configured, production logs an error once per
 * instance and uses the in-memory map — a tracked to-do in the phase-2 plan
 * (Out of Scope: "Provision Upstash Redis") switches that to fail-closed once
 * a store exists.
 */

import { kv } from "@vercel/kv";
import { logger } from "@/lib/utils/log";

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number; // For LRU eviction
}

// In-memory fallback for local development only
const rateLimitMap = new Map<string, RateLimitEntry>();

// Maximum entries in memory fallback to prevent memory exhaustion
const MAX_MEMORY_ENTRIES = 10000;

// Check if KV is configured
const isKVConfigured = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

// Check if we're in production
const isProduction = process.env.NODE_ENV === "production";

// Log the missing-KV condition once per instance, not once per request
let warnedMissingKv = false;

// Clean up old entries periodically (for in-memory fallback)
const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;

  // Remove expired entries
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  // If still over limit after cleanup, evict oldest entries (LRU)
  if (rateLimitMap.size > MAX_MEMORY_ENTRIES) {
    const entries = Array.from(rateLimitMap.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toEvict = rateLimitMap.size - MAX_MEMORY_ENTRIES;
    for (let i = 0; i < toEvict; i++) {
      rateLimitMap.delete(entries[i][0]);
    }
  }
}

/**
 * Enforce size limit on memory map - evict oldest if necessary
 */
function enforceMemoryLimit() {
  if (rateLimitMap.size < MAX_MEMORY_ENTRIES) return;

  // Find and remove the oldest entry (lowest lastAccess)
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    rateLimitMap.delete(oldestKey);
  }
}

/**
 * Check if a request should be rate limited (in-memory fallback)
 * Only used in development - production should fail-closed on KV errors
 */
function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  cleanupMemory();

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // Enforce size limit before adding new entry
    enforceMemoryLimit();

    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
      lastAccess: now,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetIn: windowMs,
    };
  }

  if (entry.count >= limit) {
    entry.lastAccess = now; // Update access time even on rejection
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  entry.count++;
  entry.lastAccess = now;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Check if a request should be rate limited (Vercel KV)
 */
async function checkRateLimitKV(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const kvKey = `ratelimit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    // Use Redis MULTI for atomic operations
    const pipeline = kv.pipeline();
    pipeline.incr(kvKey);
    pipeline.ttl(kvKey);
    const results = await pipeline.exec<[number, number]>();

    const count = results[0];
    let ttl = results[1];

    // If TTL is -1, key exists but has no expiry - set it
    // If TTL is -2, key didn't exist before incr created it - set expiry
    if (ttl < 0) {
      await kv.expire(kvKey, windowSeconds);
      ttl = windowSeconds;
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetIn = ttl * 1000;

    return { allowed, remaining, resetIn };
  } catch (error) {
    logger.error("KV rate limit error", { error, key });

    // In production: fail-closed to prevent distributed attack bypass
    // In development: fall back to in-memory for local testing convenience
    if (isProduction) {
      logger.warn("Rate limit fail-closed in production due to KV error", {
        key,
      });
      return { allowed: false, remaining: 0, resetIn: 60000 };
    }

    return checkRateLimitMemory(key, limit, windowMs);
  }
}

/**
 * Check if a request should be rate limited
 *
 * @param key - Unique identifier (e.g., `action:userId`)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 * @returns Promise with `allowed` boolean and `remaining` count
 *
 * @example
 * ```ts
 * const { allowed, remaining } = await checkRateLimit(`review:${userId}`, 5, 60000);
 * if (!allowed) {
 *   return { error: 'Too many requests. Please wait a moment.' };
 * }
 * ```
 */
export async function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (isKVConfigured) {
    return checkRateLimitKV(key, limit, windowMs);
  }
  if (isProduction && !warnedMissingKv) {
    // The in-memory map is per instance, so on serverless it is barely a
    // limit. Failing closed here is deferred until a Redis store exists in
    // Vercel (phase-2 plan, Out of Scope: "Provision Upstash Redis"); until
    // then say so once per instance so the gap is visible in Sentry.
    warnedMissingKv = true;
    logger.error(
      "Rate limiting is per-instance only: KV_REST_API_URL / KV_REST_API_TOKEN are not set in production"
    );
  }
  return checkRateLimitMemory(key, limit, windowMs);
}

/**
 * Synchronous version for backwards compatibility (uses in-memory only)
 * @deprecated Use the async checkRateLimit instead
 */
export function checkRateLimitSync(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  return checkRateLimitMemory(key, limit, windowMs);
}

/**
 * Reset rate limit for a specific key
 */
export async function resetRateLimit(key: string): Promise<void> {
  if (isKVConfigured) {
    try {
      await kv.del(`ratelimit:${key}`);
    } catch (error) {
      logger.error("KV reset error", { error, key });
    }
  }
  rateLimitMap.delete(key);
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  key: string,
  limit: number = 10
): Promise<{ count: number; remaining: number; resetIn: number } | null> {
  if (isKVConfigured) {
    try {
      const kvKey = `ratelimit:${key}`;
      const pipeline = kv.pipeline();
      pipeline.get<number>(kvKey);
      pipeline.ttl(kvKey);
      const results = await pipeline.exec<[number | null, number]>();

      const count = results[0];
      const ttl = results[1];

      if (count === null || ttl < 0) {
        return null;
      }

      return {
        count,
        remaining: Math.max(0, limit - count),
        resetIn: ttl * 1000,
      };
    } catch (error) {
      logger.error("KV status error", { error, key });
    }
  }

  const entry = rateLimitMap.get(key);
  const now = Date.now();

  if (!entry || now > entry.resetTime) {
    return null;
  }

  return {
    count: entry.count,
    remaining: Math.max(0, limit - entry.count),
    resetIn: entry.resetTime - now,
  };
}
