/**
 * Simple in-memory rate limiter for server actions
 * Note: This is process-local and won't work across multiple server instances
 * For production, consider using Redis or a similar distributed store
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
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
 * Check if a request should be rate limited
 *
 * @param key - Unique identifier (e.g., `action:userId`)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 * @returns Object with `allowed` boolean and `remaining` count
 *
 * @example
 * ```ts
 * const { allowed, remaining } = checkRateLimit(`review:${userId}`, 5, 60000);
 * if (!allowed) {
 *   return { error: 'Too many requests. Please wait a moment.' };
 * }
 * ```
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  cleanup();

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // No existing entry or window expired - start fresh
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

  // Check if limit exceeded
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Reset rate limit for a specific key
 * Useful for testing or when you want to clear a user's limit
 */
export function resetRateLimit(key: string): void {
  rateLimitMap.delete(key);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  key: string,
  limit: number = 10
): { count: number; remaining: number; resetIn: number } | null {
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

