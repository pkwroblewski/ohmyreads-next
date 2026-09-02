import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison of two secrets (bearer tokens, webhook secrets).
 *
 * `a !== b` short-circuits at the first differing byte, which leaks how much
 * of a guess was right. Returns false for a missing side or a length mismatch
 * (length is not secret) without ever throwing. Node runtime only.
 */
export function safeCompare(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  if (Buffer.byteLength(a) !== Buffer.byteLength(b)) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
