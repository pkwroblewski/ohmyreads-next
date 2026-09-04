/**
 * Tests for comment server action auth guards (Task 14)
 * Validates that unauthenticated requests are rejected by comment actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

// Mock next/cache before importing actions
vi.mock("next/cache", () => ({ revalidatePath }));

// Mock rate limiting to always allow
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

// Mock logger
vi.mock("@/lib/utils/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

let mockSupabase: MockSupabase;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
  getUser: () => mockSupabase.auth.getUser(),
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
      expect(result).toHaveProperty("success", false);
    });

    it("deleteComment should reject unauthenticated user", async () => {
      const result = await deleteComment("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/authenticated/i);
      expect(result).toHaveProperty("success", false);
    });
  });

  describe("when user IS authenticated", () => {
    const userId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    beforeEach(() => {
      mockSupabase = createMockSupabase({ id: userId });
    });

    it("createComment inserts the comment and revalidates the book page", async () => {
      vi.clearAllMocks();
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "new-comment-id" },
        error: null,
      });

      const result = await createComment({
        reviewId: "550e8400-e29b-41d4-a716-446655440000",
        content: "This is a test comment",
      });

      expect(result).toMatchObject({ success: true });
      expect(result).not.toHaveProperty("error");
      expect(mockSupabase.from).toHaveBeenCalledWith("comments");
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          review_id: "550e8400-e29b-41d4-a716-446655440000",
          user_id: userId,
          content: "This is a test comment",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/books/[slug]", "page");
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

describe("Comment actions - reply parent scoping (Phase 2, Task 5)", () => {
  const userId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  const reviewId = "550e8400-e29b-41d4-a716-446655440000";
  const parentId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

  beforeEach(() => {
    mockSupabase = createMockSupabase({ id: userId });
  });

  it("looks the parent up on the SAME review, not just by id", async () => {
    // The parent lookup is the only thing that stops a reply from being
    // threaded under a comment that belongs to another review. Scoping it by
    // review_id makes a foreign parent look like "not found".
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

    const result = await createComment({
      reviewId,
      content: "Replying here",
      parentId,
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("comments");
    expect(mockSupabase.eq).toHaveBeenCalledWith("id", parentId);
    expect(mockSupabase.eq).toHaveBeenCalledWith("review_id", reviewId);
    expect(result.error).toBe("Parent comment not found");
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  it("still refuses a reply to a reply", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: parentId, parent_id: "some-other-id" },
      error: null,
    });

    const result = await createComment({
      reviewId,
      content: "Replying here",
      parentId,
    });

    expect(result.error).toMatch(/cannot reply to a reply/i);
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });
});
