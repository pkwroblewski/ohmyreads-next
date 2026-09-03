"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createCommentSchema } from "@/lib/validation/comment";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logger, reportError } from "@/lib/utils/log";

/**
 * Revalidate the book detail route.
 *
 * This used to join review -> book purely to build `/books/<slug>`, costing an
 * extra round-trip on every comment write. It bought nothing: `/books/[slug]`
 * reads cookies, so it is a dynamic route with no full-route cache entry to
 * bust, and the client router-cache refresh a Server Action triggers is not
 * path-specific. No cache tag applies either — nothing in `lib/cache/tags.ts`
 * covers comments, because no `unstable_cache` entry reads them.
 */
function revalidateBookPages() {
  revalidatePath("/books/[slug]", "page");
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
    } = await getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit
    const { allowed } = await checkRateLimit(`comment:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many comments. Please wait a moment." };
    }

    // If replying, verify the parent exists ON THIS REVIEW and check nesting.
    // Scoping by review_id stops a reply from being threaded under a comment
    // that belongs to a different review.
    if (data.parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("comments")
        .select("id, parent_id")
        .eq("id", data.parentId)
        .eq("review_id", data.reviewId)
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

    revalidateBookPages();

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
    } = await getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Verify ownership
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("user_id")
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

    revalidateBookPages();

    return { success: true };
  } catch (error) {
    logger.error("Unexpected error in deleteComment", { error });
    return { error: "An unexpected error occurred" };
  }
}
