/**
 * Tests for review server action auth guards (Task 14)
 * Validates that unauthenticated requests are rejected by all review actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { revalidatePath, invalidateTags } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  invalidateTags: vi.fn(),
}));

// Mock next/cache before importing actions
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/cache/tags", () => ({
  invalidateTags,
  CACHE_TAGS: { books: "books", reviews: "reviews", activity: "activity-feed", trending: "trending" },
}));

// Mock rate limiting to always allow
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

let mockSupabase: MockSupabase;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
  getUser: () => mockSupabase.auth.getUser(),
}));

// Import actions after mocks
const { createReview, updateReview, deleteReview, toggleReviewLike } =
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
      expect(result).toHaveProperty("success", false);
    });

    it("updateReview should reject unauthenticated user", async () => {
      const result = await updateReview({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        rating: 5,
      });

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).toHaveProperty("success", false);
    });

    it("deleteReview should reject unauthenticated user", async () => {
      const result = await deleteReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).toHaveProperty("success", false);
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

    it("createReview creates the row and invalidates what it made stale", async () => {
      vi.clearAllMocks();
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // no existing review
        .mockResolvedValueOnce({ data: { id: "new-review-id" }, error: null }); // insert

      const result = await createReview({
        bookId: "550e8400-e29b-41d4-a716-446655440000",
        rating: 4,
        vibeTags: [],
        isSpoiler: false,
      });

      expect(result).toEqual({ success: true, reviewId: "new-review-id" });
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          book_id: "550e8400-e29b-41d4-a716-446655440000",
          rating: 4,
        })
      );
      // Book page, reviews list, activity feed and trending all read reviews.
      expect(invalidateTags).toHaveBeenCalledWith("books", "reviews", "activity-feed", "trending");
      expect(revalidatePath).toHaveBeenCalledWith("/books/[slug]", "page");
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    });

    it("createReview refuses a second review of the same book without inserting", async () => {
      vi.clearAllMocks();
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "existing" }, error: null });

      const result = await createReview({
        bookId: "550e8400-e29b-41d4-a716-446655440000",
        rating: 4,
        vibeTags: [],
        isSpoiler: false,
      });

      expect(result).toEqual({ success: false, error: "You have already reviewed this book" });
      expect(mockSupabase.insert).not.toHaveBeenCalled();
      expect(invalidateTags).not.toHaveBeenCalled();
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
