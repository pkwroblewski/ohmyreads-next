"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createComment({
  reviewId,
  content,
  parentId = null,
}: {
  reviewId: string;
  content: string;
  parentId?: string | null;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate content
    if (content.length < 1) {
      return { error: "Comment cannot be empty" };
    }
    if (content.length > 1000) {
      return { error: "Comment must be less than 1000 characters" };
    }

    // If replying, verify parent exists and limit nesting to 2 levels
    if (parentId) {
      const { data: parent } = await supabase
        .from("comments")
        .select("id, parent_id")
        .eq("id", parentId)
        .single();

      if (!parent) {
        return { error: "Parent comment not found" };
      }

      // Don't allow replies to replies (max 2 levels)
      if (parent.parent_id) {
        return { error: "Cannot reply to a reply" };
      }
    }

    // Insert comment
    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        content,
        parent_id: parentId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating comment:", error);
      return { error: error.message };
    }

    revalidatePath(`/books/[slug]`, "page");

    return { success: true, commentId: comment.id };
  } catch (error) {
    console.error("Error in createComment:", error);
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

    // Verify ownership
    const { data: comment } = await supabase
      .from("comments")
      .select("user_id")
      .eq("id", commentId)
      .single();

    if (!comment || comment.user_id !== user.id) {
      return { error: "Not authorized to delete this comment" };
    }

    // Delete comment (and its replies via cascade if set up in DB)
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/books/[slug]`, "page");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteComment:", error);
    return { error: "An unexpected error occurred" };
  }
}

