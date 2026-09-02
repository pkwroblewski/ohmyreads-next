// @vitest-environment node
/**
 * Tests for the shared constant-time secret comparison (Phase 2, Task 5).
 * The cron, webhook and seed routes all authenticate through this.
 */

import { describe, it, expect } from "vitest";
import { safeCompare } from "@/lib/utils/secrets";

describe("safeCompare", () => {
  it("is true only for identical strings", () => {
    expect(safeCompare("Bearer abc123", "Bearer abc123")).toBe(true);
    expect(safeCompare("Bearer abc123", "Bearer abc124")).toBe(false);
    expect(safeCompare("Bearer abc123", "Bearer abc12")).toBe(false);
  });

  it("is false when either side is missing, without throwing", () => {
    expect(safeCompare(null, "x")).toBe(false);
    expect(safeCompare("x", null)).toBe(false);
    expect(safeCompare(undefined, undefined)).toBe(false);
    expect(safeCompare("", "")).toBe(false);
  });

  it("handles multi-byte strings whose char and byte lengths differ", () => {
    // timingSafeEqual throws on unequal buffer lengths; the byte-length guard
    // must use bytes, not characters, or "é" vs "ee" would blow up.
    expect(safeCompare("é", "ee")).toBe(false);
    expect(safeCompare("é", "é")).toBe(true);
  });
});
