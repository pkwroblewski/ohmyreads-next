"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCommentSchema } from "@/lib/validation/comment";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logger, reportError } from "@/lib/utils/log";

/**
 * Helper to revalidate book page via review ID
 */
async function revalidateBookPageFromReview(reviewId: string) {
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("reviews")
    .select("book_id, books(slug)")
    .eq("id", reviewId)
    .single();

  if (review?.books && !Array.isArray(review.books)) {
    const book = review.books as { slug: string };
    if (book.slug) {
      revalidatePath(`/books/${book.slug}`);
    }
  }
}

export async function createComment(input: {
  reviewId: string;
  content: string;
  parentId?: string | null;
}) {
  try {
    // Validate input
    const validationResult = createCommentSchema.safeParse(input);
    if (!validationResult.success) {
      return { error: validationResult.error.issues[0]?.message || "Invalid input" };
    }

    const data = validationResult.data;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit
    const { allowed } = await checkRateLimit(`comment:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many comments. Please wait a moment." };
    }

    // If replying, verify parent exists and check nesting level
    if (data.parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("comments")
        .select("id, parent_id")
        .eq("id", data.parentId)
        .single();

      if (parentError || !parent) {
        return { error: "Parent comment not found" };
      }

      // Don't allow replies to replies (max 2 levels)
      if (parent.parent_id) {
        return { error: "Cannot reply to a reply. Maximum nesting is 2 levels." };
      }
    }

    // Insert comment
    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        review_id: data.reviewId,
        user_id: user.id,
        content: data.content.trim(),
        parent_id: data.parentId || null,
      })
      .select()
      .single();

    if (error) {
      return {
        error: reportError("Error creating comment", error, {
          userId: user.id,
        }),
      };
    }

    await revalidateBookPageFromReview(data.reviewId);

    return { success: true, commentId: comment.id };
  } catch (error) {
    logger.error("Unexpected error in createComment", { error });
    return { error: "An unexpected error occurred" };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Verify ownership and get review_id for revalidation
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("user_id, review_id")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      return { error: "Comment not found" };
    }

    if (comment.user_id !== user.id) {
      return { error: "Not authorized to delete this comment" };
    }

    // Delete comment (and its replies via cascade if set up)
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return {
        error: reportError("Error deleting comment", error, { commentId }),
      };
    }

    await revalidateBookPageFromReview(comment.review_id);

    return { success: true };
  } catch (error) {
    logger.error("Unexpected error in deleteComment", { error });
    return { error: "An unexpected error occurred" };
  }
}
