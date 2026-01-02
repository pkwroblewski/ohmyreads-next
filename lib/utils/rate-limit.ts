/**
 * Distributed rate limiter using Vercel KV
 * Falls back to in-memory storage for local development or when KV is unavailable
 */

import { kv } from "@vercel/kv";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory fallback for local development
const rateLimitMap = new Map<string, RateLimitEntry>();

// Check if KV is configured
const isKVConfigured = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

// Clean up old entries periodically (for in-memory fallback)
const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Check if a request should be rate limited (in-memory fallback)
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
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetIn: windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  entry.count++;
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
    console.error("KV rate limit error, falling back to memory:", error);
    // Fall back to in-memory on KV errors
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
      console.error("KV reset error:", error);
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
      console.error("KV status error:", error);
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
