/**
 * Tests for comment server action auth guards (Task 14)
 * Validates that unauthenticated requests are rejected by comment actions
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

// Mock logger
vi.mock("@/lib/utils/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Supabase mock builder
function createMockSupabase(user: { id: string } | null) {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
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
const { createComment, deleteComment } = await import("@/lib/actions/comments");

describe("Comment actions - auth guards", () => {
  describe("when user is NOT authenticated", () => {
    beforeEach(() => {
      mockSupabase = createMockSupabase(null);
    });

    it("createComment should reject unauthenticated user", async () => {
      const result = await createComment({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        content: "This is a test comment with enough length",
      });

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).not.toHaveProperty("success");
    });

    it("deleteComment should reject unauthenticated user", async () => {
      const result = await deleteComment("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).not.toHaveProperty("success");
    });
  });

  describe("when user IS authenticated", () => {
    const userId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    beforeEach(() => {
      mockSupabase = createMockSupabase({ id: userId });
    });

    it("createComment should pass auth check with valid input", async () => {
      // Mock successful insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "new-comment-id" },
        error: null,
      });
      // Mock revalidation review lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { book_id: "book-1", books: { slug: "test-book" } },
        error: null,
      });

      const result = await createComment({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        content: "This is a test comment",
      });

      // Should NOT get an auth error
      if (result.error) {
        expect(result.error).not.toMatch(/authenticated/i);
      }
    });

    it("deleteComment should check ownership after auth", async () => {
      // Return a comment owned by a DIFFERENT user
      mockSupabase.single.mockResolvedValueOnce({
        data: { user_id: "different-user", review_id: "review-1" },
        error: null,
      });

      const result = await deleteComment("550e8400-e29b-41d4-a716-446655440000");

      // Should get an authorization error, NOT an auth error
      expect(result.error).toMatch(/not authorized/i);
    });
  });
});

describe("Comment actions - input validation", () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase({ id: "user-1" });
  });

  it("createComment should reject empty content", async () => {
    const result = await createComment({
      reviewId: "550e8400-e29b-41d4-a716-446655440000",
      content: "",
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/empty|required|min/i);
  });

  it("createComment should reject invalid reviewId", async () => {
    const result = await createComment({
      reviewId: "not-a-uuid",
      content: "Valid content here",
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/invalid|uuid/i);
  });

  it("createComment should reject content over 1000 characters", async () => {
    const result = await createComment({
      reviewId: "550e8400-e29b-41d4-a716-446655440000",
      content: "a".repeat(1001),
    });

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/1000|too long|characters/i);
  });
});
