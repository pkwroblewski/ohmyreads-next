import { createClient } from "@/lib/supabase/server";
import type { ReviewWithUser } from "@/types/database";
import { logError } from "@/lib/utils/log";

export interface ReviewWithUserAndLikeStatus extends ReviewWithUser {
  hasLiked?: boolean;
}

/**
 * Check if user has already reviewed a book
 */
export async function hasUserReviewedBook(
  userId: string,
  bookId: string
): Promise<{ hasReviewed: boolean; review: ReviewWithUser | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select(`
        *,
        profile:profiles!user_id(id, username, display_name, avatar_url)
      `)
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .single()
      // The declared type predates the select: profile is a 4-column subset
      .overrideTypes<ReviewWithUser, { merge: false }>();

    if (error && error.code !== "PGRST116") {
      logError("Error checking review", error);
    }

    if (!data) {
      return { hasReviewed: false, review: null };
    }

    return { hasReviewed: true, review: data };
  } catch (error) {
    logError("Error in hasUserReviewedBook", error);
    return { hasReviewed: false, review: null };
  }
}

