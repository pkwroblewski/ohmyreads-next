/**
 * Tests for review server action auth guards (Task 14)
 * Validates that unauthenticated requests are rejected by all review actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache before importing actions
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock rate limiting to always allow
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

// Supabase mock builder
function createMockSupabase(user: { id: string } | null) {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue(
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "Not authenticated" } }
      ),
    },
  };
  return mockChain;
}

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Import actions after mocks
const { createReview, updateReview, deleteReview, likeReview, unlikeReview, toggleReviewLike } =
  await import("@/lib/actions/reviews");

describe("Review actions - auth guards", () => {
  describe("when user is NOT authenticated", () => {
    beforeEach(() => {
      mockSupabase = createMockSupabase(null);
    });

    it("createReview should reject unauthenticated user", async () => {
      const result = await createReview({
        bookId: "550e8400-e29b-41d4-a716-446655440000",
        rating: 4,
        vibeTags: [],
        isSpoiler: false,
      });

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/logged in|authenticated/i);
      expect(result).not.toHaveProperty("success");
    });

    it("updateReview should reject unauthenticated user", async () => {
      const result = await updateReview({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        rating: 5,
      });

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).not.toHaveProperty("success");
    });

    it("deleteReview should reject unauthenticated user", async () => {
      const result = await deleteReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).not.toHaveProperty("success");
    });

    it("likeReview should reject unauthenticated user", async () => {
      const result = await likeReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/logged in|authenticated/i);
      expect(result).not.toHaveProperty("success");
    });

    it("unlikeReview should reject unauthenticated user", async () => {
      const result = await unlikeReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).not.toHaveProperty("success");
    });

    it("toggleReviewLike should reject unauthenticated user", async () => {
      const result = await toggleReviewLike("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/logged in|authenticated/i);
    });
  });

  describe("when user IS authenticated", () => {
    const userId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    beforeEach(() => {
      mockSupabase = createMockSupabase({ id: userId });
    });

    it("createReview should pass auth check (may fail on subsequent logic)", async () => {
      // With auth passing, createReview should get past the auth guard.
      // It will proceed to validation, so we give valid input.
      // The "already reviewed" check returns null (no existing review),
      // and insert returns a review.
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // existing review check
        .mockResolvedValueOnce({ data: { id: "new-review-id" }, error: null }) // insert
        .mockResolvedValueOnce({ data: { slug: "test-book" }, error: null }); // revalidateBookPage

      const result = await createReview({
        bookId: "550e8400-e29b-41d4-a716-446655440000",
        rating: 4,
        vibeTags: [],
        isSpoiler: false,
      });

      // Should NOT get an auth error
      if (result.error) {
        expect(result.error).not.toMatch(/logged in|authenticated/i);
      }
    });

    it("deleteReview should pass auth check and check ownership", async () => {
      // Return a review owned by a DIFFERENT user
      mockSupabase.single.mockResolvedValueOnce({
        data: { user_id: "different-user", book_id: "book-1" },
        error: null,
      });

      const result = await deleteReview("550e8400-e29b-41d4-a716-446655440000");

      // Should get an authorization error, NOT an auth error
      expect(result.error).toMatch(/not authorized/i);
    });
  });
});
