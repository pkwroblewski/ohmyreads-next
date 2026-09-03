// @vitest-environment node
/**
 * Tests for `adminDeleteReview` (Phase 2, Task 6).
 *
 * Same defect class as the admin book actions: the delete goes through the
 * caller's session client, RLS can quietly match zero rows, and the action
 * used to answer "Review deleted successfully" and write an audit row anyway.
 * A zero-row delete must now fail and must never reach `createAuditLog`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const requireAdmin = vi.fn();
const checkRateLimit = vi.fn();
const createAuditLog = vi.fn();

const reviewSingle = vi.fn();
const deleteSelect = vi.fn();
const from = vi.fn();

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: () => requireAdmin(),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/utils/audit-log", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

import { adminDeleteReview } from "@/lib/actions/admin-reviews";

const ADMIN = { id: "11111111-1111-4111-8111-111111111111" };
const AUTHOR = "22222222-2222-4222-8222-222222222222";
const REVIEW = "550e8400-e29b-41d4-a716-446655440000";

function arrange(rows: Array<{ id: string }>) {
  reviewSingle.mockResolvedValue({
    data: {
      id: REVIEW,
      user_id: AUTHOR,
      profiles: { username: "ada" },
      books: { title: "Dune" },
    },
    error: null,
  });
  deleteSelect.mockResolvedValue({ data: rows, error: null });

  from.mockImplementation((table: string) => {
    if (table !== "reviews") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({ eq: () => ({ single: reviewSingle }) }),
      delete: () => ({ eq: () => ({ select: deleteSelect }) }),
    };
  });

  requireAdmin.mockResolvedValue({ supabase: { from }, user: ADMIN });
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60000 });
  createAuditLog.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminDeleteReview", () => {
  it("fails, and writes no audit row, when the delete touched no row", async () => {
    arrange([]);

    const result = await adminDeleteReview(REVIEW, "spam");

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("succeeds and records who and what was removed when a row was deleted", async () => {
    arrange([{ id: REVIEW }]);

    const result = await adminDeleteReview(REVIEW, "spam");

    expect(result).toEqual({
      success: true,
      message: "Review deleted successfully",
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.review.delete",
        targetId: REVIEW,
        userId: ADMIN.id,
        metadata: expect.objectContaining({
          reviewUserId: AUTHOR,
          reviewUsername: "ada",
          bookTitle: "Dune",
          reason: "spam",
        }),
      })
    );
  });

  it("reports a missing review before attempting the delete", async () => {
    arrange([]);
    reviewSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const result = await adminDeleteReview(REVIEW);

    expect(result).toEqual({ success: false, error: "Review not found" });
    expect(deleteSelect).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
