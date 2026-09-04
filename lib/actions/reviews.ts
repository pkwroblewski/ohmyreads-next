"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache/tags";
import { requireUser } from "@/lib/auth/require-user";
import {
  createReviewSchema,
  updateReviewSchema,
  type CreateReviewInput,
  type UpdateReviewInput,
} from "@/lib/validation/review";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError, reportError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
/**
 * Revalidate the book detail route.
 *
 * This used to fetch the book purely to build `/books/<slug>`, costing an extra
 * round-trip on every write. It bought nothing: `/books/[slug]` reads cookies,
 * so it is a dynamic route with no full-route cache entry to bust, and the
 * client router-cache refresh a Server Action triggers is not path-specific.
 * Passing the route pattern with `type: "page"` covers every book page and
 * needs no query — and still does the right thing if the route later becomes
 * statically rendered.
 */
function revalidateBookPages() {
  revalidatePath("/books/[slug]", "page");
}

/**
 * Create a new review with structured fields
 */
export async function createReview(input: CreateReviewInput): Promise<ActionResult<{ reviewId: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to write a review" };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 reviews per minute per user
    const { allowed } = await checkRateLimit(`review:${user.id}`, 10, 60000);
    if (!allowed) {
      return { success: false, error: "Too many reviews. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = createReviewSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Check if user already reviewed this book
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", data.bookId)
      .single();

    if (existingReview) {
      return { success: false, error: "You have already reviewed this book" };
    }

    // Construct content from structured fields for backward compatibility
    const contentParts: string[] = [];
    if (data.summary) contentParts.push(data.summary);
    if (data.liked) contentParts.push(`What I liked: ${data.liked}`);
    if (data.disliked) contentParts.push(`What I didn't like: ${data.disliked}`);
    if (data.takeaway) contentParts.push(`Key takeaway: ${data.takeaway}`);
    const content = contentParts.join("\n\n");

    // Insert review
    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        book_id: data.bookId,
        content,
        summary: data.summary || null,
        liked: data.liked || null,
        disliked: data.disliked || null,
        takeaway: data.takeaway || null,
        vibe_tags: data.vibeTags || [],
        rating: data.rating ?? null,
        is_spoiler: data.isSpoiler,
      })
      .select()
      .single();

    if (error) {
      logError("Error creating review", error);
      return { success: false, error: "Failed to create review" };
    }

    // books.local_average_rating and reading_stats are both maintained by
    // triggers on reviews (migrations 063 and 057)

    // Revalidate pages. A new review changes the book's local rating, the
    // review lists, the trigger-written activity feed, and trending scores.
    invalidateTags(
      CACHE_TAGS.books,
      CACHE_TAGS.reviews,
      CACHE_TAGS.activity,
      CACHE_TAGS.trending
    );
    revalidateBookPages();
    revalidatePath("/dashboard");

    return { success: true, reviewId: review.id };
  } catch (error) {
    logError("Error in createReview", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update an existing review
 */
export async function updateReview(input: UpdateReviewInput): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Validate input
    const validationResult = updateReviewSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Verify ownership
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id, book_id, rating, summary, liked, disliked, takeaway, vibe_tags")
      .eq("id", data.reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return { success: false, error: "Not authorized to edit this review" };
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.rating !== undefined) updateData.rating = data.rating ?? null;
    if (data.summary !== undefined) updateData.summary = data.summary || null;
    if (data.liked !== undefined) updateData.liked = data.liked || null;
    if (data.disliked !== undefined) updateData.disliked = data.disliked || null;
    if (data.takeaway !== undefined) updateData.takeaway = data.takeaway || null;
    if (data.vibeTags !== undefined) updateData.vibe_tags = data.vibeTags;
    if (data.isSpoiler !== undefined) updateData.is_spoiler = data.isSpoiler;

    // Compute final state and validate business rule
    const finalRating = data.rating !== undefined ? (data.rating ?? null) : review.rating;
    const finalSummary = data.summary !== undefined ? data.summary : review.summary;
    const finalLiked = data.liked !== undefined ? data.liked : review.liked;
    const finalDisliked = data.disliked !== undefined ? data.disliked : review.disliked;
    const finalTakeaway = data.takeaway !== undefined ? data.takeaway : review.takeaway;

    const finalTextLength =
      (finalSummary?.length || 0) +
      (finalLiked?.length || 0) +
      (finalDisliked?.length || 0) +
      (finalTakeaway?.length || 0);

    // Must have at least a rating or 50+ chars of text
    if (finalRating == null && finalTextLength < 50) {
      return { success: false, error: "Add a star rating, or write at least 50 characters for a text-only review" };
    }

    const contentParts: string[] = [];
    if (finalSummary) contentParts.push(finalSummary);
    if (finalLiked) contentParts.push(`What I liked: ${finalLiked}`);
    if (finalDisliked) contentParts.push(`What I didn't like: ${finalDisliked}`);
    if (finalTakeaway) contentParts.push(`Key takeaway: ${finalTakeaway}`);
    updateData.content = contentParts.join("\n\n");

    const { error } = await supabase
      .from("reviews")
      .update(updateData)
      .eq("id", data.reviewId);

    if (error) {
      logError("Error updating review", error);
      return { success: false, error: "Failed to update review" };
    }

    // An edit does not add a feed row, but it can move the book's local rating,
    // which the trigger from migration 063 has already recalculated.
    invalidateTags(CACHE_TAGS.books, CACHE_TAGS.reviews);
    revalidateBookPages();

    return { success: true };
  } catch (error) {
    logError("Error in updateReview", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Get review to verify ownership and get book_id
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id, book_id")
      .eq("id", reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return { success: false, error: "Not authorized to delete this review" };
    }

    // Delete review
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      return { success: false, error: reportError("Error deleting review", error, { reviewId }) };
    }

    // books.local_average_rating and reading_stats are both maintained by
    // triggers on reviews (migrations 063 and 057)

    invalidateTags(
      CACHE_TAGS.books,
      CACHE_TAGS.reviews,
      CACHE_TAGS.activity,
      CACHE_TAGS.trending
    );
    revalidateBookPages();
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Error in deleteReview", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// REVIEW LIKES
// ============================================

/**
 * Like a review
 */
async function likeReview(reviewId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to like reviews" };
    }
    const { supabase, user } = auth;

    // Existence check only — revalidation no longer needs the book id.
    const { data: review } = await supabase
      .from("reviews")
      .select("id")
      .eq("id", reviewId)
      .single();

    if (!review) {
      return { success: false, error: "Review not found" };
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from("review_likes")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
      .single();

    if (existingLike) {
      return { success: false, error: "You have already liked this review" };
    }

    // Insert like
    const { error: likeError } = await supabase.from("review_likes").insert({
      review_id: reviewId,
      user_id: user.id,
    });

    if (likeError) {
      logError("Error liking review", likeError);
      return { success: false, error: "Failed to like review" };
    }

    // reviews.likes_count is updated by a trigger in the same transaction as
    // the insert above (migration 057), so it can no longer drift.

    // The cached review pages on /books/[slug] render likes_count, so a like
    // has to expire them or every other reader sees the old number for an hour.
    invalidateTags(CACHE_TAGS.reviews);
    revalidateBookPages();

    return { success: true };
  } catch (error) {
    logError("Error in likeReview", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Unlike a review
 */
async function unlikeReview(reviewId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Delete like
    const { error: deleteError } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", user.id);

    if (deleteError) {
      logError("Error unliking review", deleteError);
      return { success: false, error: "Failed to unlike review" };
    }

    // reviews.likes_count is updated by a trigger in the same transaction as
    // the delete above (migration 057), so it can no longer drift.

    invalidateTags(CACHE_TAGS.reviews);
    revalidateBookPages();

    return { success: true };
  } catch (error) {
    logError("Error in unlikeReview", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Toggle like on a review
 */
export async function toggleReviewLike(reviewId: string): Promise<ActionResult<{ liked: boolean }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to like reviews" };
    }
    const { supabase, user } = auth;

    // Check if already liked
    const { data: existingLike } = await supabase
      .from("review_likes")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
      .single();

    if (existingLike) {
      // Unlike
      const result = await unlikeReview(reviewId);
      return result.success ? { success: true, liked: false } : result;
    } else {
      // Like
      const result = await likeReview(reviewId);
      return result.success ? { success: true, liked: true } : result;
    }
  } catch (error) {
    logError("Error in toggleReviewLike", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Recalculating a book's local rating is no longer this file's job.
 *
 * Migration 063 split the column: `books.average_rating` is the Open Library
 * figure and `books.local_average_rating` is this site's own, maintained by a
 * statement-level trigger on `reviews`. The trigger covers every write path,
 * including the admin deletions and cascades that never called this helper, so
 * an explicit RPC call here would only duplicate work already done inside the
 * same transaction.
 */
