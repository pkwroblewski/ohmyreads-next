"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createReviewSchema,
  updateReviewSchema,
  type CreateReviewInput,
  type UpdateReviewInput,
} from "@/lib/validation/review";

/**
 * Helper to revalidate book page by ID (fetches slug to build correct path)
 */
async function revalidateBookPage(bookId: string) {
  const supabase = await createClient();
  const { data: book } = await supabase
    .from("books")
    .select("slug")
    .eq("id", bookId)
    .single();

  if (book?.slug) {
    revalidatePath(`/books/${book.slug}`);
  }
}

/**
 * Create a new review with structured fields
 */
export async function createReview(input: CreateReviewInput) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to write a review" };
    }

    // Validate input with Zod
    const validationResult = createReviewSchema.safeParse(input);
    if (!validationResult.success) {
      return {
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
      return { error: "You have already reviewed this book" };
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
        rating: data.rating,
        is_spoiler: data.isSpoiler,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating review:", error);
      return { error: error.message };
    }

    // Update book's average rating and count
    await updateBookRating(data.bookId);

    // Revalidate pages
    await revalidateBookPage(data.bookId);
    revalidatePath("/dashboard");

    return { success: true, reviewId: review.id };
  } catch (error) {
    console.error("Error in createReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Update an existing review
 */
export async function updateReview(input: UpdateReviewInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate input
    const validationResult = updateReviewSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Verify ownership
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id, book_id, summary, liked, disliked, takeaway, vibe_tags")
      .eq("id", data.reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return { error: "Not authorized to edit this review" };
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.summary !== undefined) updateData.summary = data.summary || null;
    if (data.liked !== undefined) updateData.liked = data.liked || null;
    if (data.disliked !== undefined) updateData.disliked = data.disliked || null;
    if (data.takeaway !== undefined) updateData.takeaway = data.takeaway || null;
    if (data.vibeTags !== undefined) updateData.vibe_tags = data.vibeTags;
    if (data.isSpoiler !== undefined) updateData.is_spoiler = data.isSpoiler;

    // Rebuild content from structured fields
    const finalSummary = data.summary !== undefined ? data.summary : review.summary;
    const finalLiked = data.liked !== undefined ? data.liked : review.liked;
    const finalDisliked = data.disliked !== undefined ? data.disliked : review.disliked;
    const finalTakeaway = data.takeaway !== undefined ? data.takeaway : review.takeaway;

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
      return { error: error.message };
    }

    // Update book rating if rating changed
    if (data.rating !== undefined) {
      await updateBookRating(review.book_id);
    }

    await revalidateBookPage(review.book_id);

    return { success: true };
  } catch (error) {
    console.error("Error in updateReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Get review to verify ownership and get book_id
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id, book_id")
      .eq("id", reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return { error: "Not authorized to delete this review" };
    }

    // Delete review
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      return { error: error.message };
    }

    // Update book rating
    await updateBookRating(review.book_id);

    await revalidateBookPage(review.book_id);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// REVIEW LIKES
// ============================================

/**
 * Like a review
 */
export async function likeReview(reviewId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to like reviews" };
    }

    // Get review to check existence and get book_id for revalidation
    const { data: review } = await supabase
      .from("reviews")
      .select("book_id")
      .eq("id", reviewId)
      .single();

    if (!review) {
      return { error: "Review not found" };
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from("review_likes")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
      .single();

    if (existingLike) {
      return { error: "You have already liked this review" };
    }

    // Insert like
    const { error: likeError } = await supabase.from("review_likes").insert({
      review_id: reviewId,
      user_id: user.id,
    });

    if (likeError) {
      console.error("Error liking review:", likeError);
      return { error: "Failed to like review" };
    }

    // Increment likes count using database function
    const { error: rpcError } = await supabase.rpc("increment_review_likes", {
      review_id: reviewId,
    });

    if (rpcError) {
      console.error("Error incrementing likes:", rpcError);
      // Like was added but count wasn't updated - still consider success
    }

    await revalidateBookPage(review.book_id);

    return { success: true };
  } catch (error) {
    console.error("Error in likeReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Unlike a review
 */
export async function unlikeReview(reviewId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Get review to get book_id for revalidation
    const { data: review } = await supabase
      .from("reviews")
      .select("book_id")
      .eq("id", reviewId)
      .single();

    // Delete like
    const { error: deleteError } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error unliking review:", deleteError);
      return { error: "Failed to unlike review" };
    }

    // Decrement likes count using database function
    const { error: rpcError } = await supabase.rpc("decrement_review_likes", {
      review_id: reviewId,
    });

    if (rpcError) {
      console.error("Error decrementing likes:", rpcError);
    }

    if (review?.book_id) {
      await revalidateBookPage(review.book_id);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in unlikeReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Toggle like on a review
 */
export async function toggleReviewLike(reviewId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to like reviews", liked: false };
    }

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
      return { ...result, liked: false };
    } else {
      // Like
      const result = await likeReview(reviewId);
      return { ...result, liked: true };
    }
  } catch (error) {
    console.error("Error in toggleReviewLike:", error);
    return { error: "An unexpected error occurred", liked: false };
  }
}

/**
 * Check if current user has liked a review
 */
export async function hasLikedReview(reviewId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { liked: false };
    }

    const { data: like } = await supabase
      .from("review_likes")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
      .single();

    return { liked: !!like };
  } catch (error) {
    console.error("Error in hasLikedReview:", error);
    return { liked: false };
  }
}

/**
 * Get likes for multiple reviews (for batch checking)
 */
export async function getUserLikesForReviews(reviewIds: string[]) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { likes: {} };
    }

    const { data: likes } = await supabase
      .from("review_likes")
      .select("review_id")
      .eq("user_id", user.id)
      .in("review_id", reviewIds);

    const likesMap: Record<string, boolean> = {};
    for (const reviewId of reviewIds) {
      likesMap[reviewId] = false;
    }
    for (const like of likes || []) {
      likesMap[like.review_id] = true;
    }

    return { likes: likesMap };
  } catch (error) {
    console.error("Error in getUserLikesForReviews:", error);
    return { likes: {} };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Recalculate book's average rating using SQL function (more efficient)
 */
async function updateBookRating(bookId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("recalculate_book_rating", {
    p_book_id: bookId,
  });

  if (error) {
    console.error("Error recalculating book rating:", error);
  }
}
