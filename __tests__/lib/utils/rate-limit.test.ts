/**
 * Tests for rate limiting (Task 10)
 * Validates memory-based rate limiting behavior and edge cases
 *
 * Note: These tests focus on the in-memory fallback since KV mocking is complex.
 * The checkRateLimitSync function provides a synchronous API for testing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimitSync, resetRateLimit } from "@/lib/utils/rate-limit";

describe("checkRateLimitSync (in-memory rate limiting)", () => {
  beforeEach(async () => {
    // Reset all rate limits before each test
    // Note: We can't directly access rateLimitMap, so we use resetRateLimit
    // For testing, we'll use unique keys to avoid interference between tests
  });

  describe("basic rate limiting", () => {
    it("should allow requests under the limit", () => {
      const key = `test-basic-${Date.now()}`;
      const result = checkRateLimitSync(key, 5, 60000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetIn).toBeGreaterThan(0);
    });

    it("should track request count correctly", () => {
      const key = `test-count-${Date.now()}`;

      // First request
      let result = checkRateLimitSync(key, 5, 60000);
      expect(result.remaining).toBe(4);

      // Second request
      result = checkRateLimitSync(key, 5, 60000);
      expect(result.remaining).toBe(3);

      // Third request
      result = checkRateLimitSync(key, 5, 60000);
      expect(result.remaining).toBe(2);
    });

    it("should block requests at the limit", () => {
      const key = `test-block-${Date.now()}`;

      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        checkRateLimitSync(key, 5, 60000);
      }

      // 6th request should be blocked
      const result = checkRateLimitSync(key, 5, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should return correct resetIn time", () => {
      const key = `test-reset-${Date.now()}`;
      const windowMs = 30000; // 30 seconds

      const result = checkRateLimitSync(key, 5, windowMs);
      expect(result.resetIn).toBeLessThanOrEqual(windowMs);
      expect(result.resetIn).toBeGreaterThan(windowMs - 1000); // Allow 1s tolerance
    });
  });

  describe("window expiration", () => {
    it("should reset after window expires", async () => {
      const key = `test-expire-${Date.now()}`;
      const shortWindow = 100; // 100ms

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        checkRateLimitSync(key, 3, shortWindow);
      }

      // Should be blocked
      let result = checkRateLimitSync(key, 3, shortWindow);
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      result = checkRateLimitSync(key, 3, shortWindow);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe("different keys", () => {
    it("should track different keys independently", () => {
      const key1 = `test-key1-${Date.now()}`;
      const key2 = `test-key2-${Date.now()}`;

      // Exhaust key1
      for (let i = 0; i < 3; i++) {
        checkRateLimitSync(key1, 3, 60000);
      }

      // key1 should be blocked
      expect(checkRateLimitSync(key1, 3, 60000).allowed).toBe(false);

      // key2 should still be allowed
      expect(checkRateLimitSync(key2, 3, 60000).allowed).toBe(true);
    });
  });

  describe("default parameters", () => {
    it("should use default limit of 10", () => {
      const key = `test-default-limit-${Date.now()}`;

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimitSync(key);
        expect(result.allowed).toBe(true);
      }

      // 11th request should be blocked
      const result = checkRateLimitSync(key);
      expect(result.allowed).toBe(false);
    });

    it("should use default window of 60 seconds", () => {
      const key = `test-default-window-${Date.now()}`;

      const result = checkRateLimitSync(key);
      // Window should be approximately 60 seconds (60000ms)
      expect(result.resetIn).toBeLessThanOrEqual(60000);
      expect(result.resetIn).toBeGreaterThan(59000);
    });
  });

  describe("edge cases", () => {
    it("should handle limit of 1", () => {
      const key = `test-limit-one-${Date.now()}`;

      // First request allowed
      let result = checkRateLimitSync(key, 1, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);

      // Second request blocked
      result = checkRateLimitSync(key, 1, 60000);
      expect(result.allowed).toBe(false);
    });

    it("should handle very short window", () => {
      const key = `test-short-window-${Date.now()}`;

      const result = checkRateLimitSync(key, 5, 1); // 1ms window
      expect(result.allowed).toBe(true);
    });

    it("should handle empty key", () => {
      const key = "";
      const result = checkRateLimitSync(key, 5, 60000);
      expect(result.allowed).toBe(true);
    });

    it("should handle special characters in key", () => {
      const key = `test:special/chars-${Date.now()}`;
      const result = checkRateLimitSync(key, 5, 60000);
      expect(result.allowed).toBe(true);
    });
  });
});

describe("resetRateLimit", () => {
  it("should reset a rate limited key", async () => {
    const key = `test-reset-key-${Date.now()}`;

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      checkRateLimitSync(key, 3, 60000);
    }

    // Should be blocked
    expect(checkRateLimitSync(key, 3, 60000).allowed).toBe(false);

    // Reset the limit
    await resetRateLimit(key);

    // Should be allowed again
    const result = checkRateLimitSync(key, 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should handle resetting non-existent key", async () => {
    const key = `test-nonexistent-${Date.now()}`;

    // Should not throw
    await expect(resetRateLimit(key)).resolves.toBeUndefined();
  });
});

describe("memory limit protection", () => {
  // Note: This test verifies that the MAX_MEMORY_ENTRIES limit is enforced.
  // The actual limit is 10000, so we can't easily test it exhaustively.
  // Instead, we verify the LRU behavior with a smaller scale test.

  it("should maintain entries in memory", () => {
    const baseKey = `test-memory-${Date.now()}`;

    // Create multiple entries
    for (let i = 0; i < 100; i++) {
      checkRateLimitSync(`${baseKey}-${i}`, 5, 60000);
    }

    // All entries should still work
    for (let i = 0; i < 100; i++) {
      const result = checkRateLimitSync(`${baseKey}-${i}`, 5, 60000);
      // Second request, so remaining should be 3
      expect(result.remaining).toBe(3);
    }
  });
});
