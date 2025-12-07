import { createClient } from "@/lib/supabase/server";

export interface CommentUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CommentWithUser {
  id: string;
  review_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user?: CommentUser | null;
}

export async function getReviewComments(
  reviewId: string
): Promise<CommentWithUser[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        user:profiles(id, username, display_name, avatar_url)
      `
      )
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getReviewComments:", error);
    return [];
  }
}

