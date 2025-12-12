import { createClient } from "@/lib/supabase/server";
import type { CommentWithUser } from "@/types/database";

/**
 * Get comments for a specific review
 */
export async function getReviewComments(
  reviewId: string
): Promise<CommentWithUser[]> {
  const supabase = await createClient();

  const { data: comments, error } = await supabase
    .from("comments")
    .select(`
      id,
      review_id,
      user_id,
      content,
      parent_id,
      created_at,
      updated_at
    `)
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  if (!comments || comments.length === 0) {
    return [];
  }

  // Fetch profiles for all comment authors
  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  return comments.map((comment) => ({
    ...comment,
    user: profileMap.get(comment.user_id) || null,
  })) as unknown as CommentWithUser[];
}

/**
 * Get comments for multiple reviews (batch fetch)
 */
export async function getCommentsForReviews(
  reviewIds: string[]
): Promise<Map<string, CommentWithUser[]>> {
  if (reviewIds.length === 0) return new Map();

  const supabase = await createClient();

  const { data: comments, error } = await supabase
    .from("comments")
    .select(`
      id,
      review_id,
      user_id,
      content,
      parent_id,
      created_at,
      updated_at
    `)
    .in("review_id", reviewIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return new Map();
  }

  if (!comments || comments.length === 0) {
    return new Map();
  }

  // Fetch profiles for all comment authors
  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  // Group comments by review_id with user data
  const commentMap = new Map<string, CommentWithUser[]>();

  for (const comment of comments) {
    const commentWithUser = {
      ...comment,
      user: profileMap.get(comment.user_id) || null,
    } as unknown as CommentWithUser;
    
    const existing = commentMap.get(comment.review_id) || [];
    existing.push(commentWithUser);
    commentMap.set(comment.review_id, existing);
  }

  return commentMap;
}

/**
 * Get comment count for a review
 */
export async function getCommentCount(reviewId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);

  if (error) {
    console.error("Error fetching comment count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get comment counts for multiple reviews
 */
export async function getCommentCounts(
  reviewIds: string[]
): Promise<Map<string, number>> {
  if (reviewIds.length === 0) return new Map();

  const supabase = await createClient();

  // Fetch all comment review_ids and count client-side
  const { data, error } = await supabase
    .from("comments")
    .select("review_id")
    .in("review_id", reviewIds);

  if (error) {
    console.error("Error fetching comment counts:", error);
    return new Map();
  }

  // Count occurrences
  const counts = new Map<string, number>();
  for (const { review_id } of data || []) {
    counts.set(review_id, (counts.get(review_id) || 0) + 1);
  }

  return counts;
}

/**
 * Organize comments into threaded structure
 */
export function organizeCommentsIntoThreads(comments: CommentWithUser[]): {
  topLevel: CommentWithUser[];
  replies: Map<string, CommentWithUser[]>;
} {
  const topLevel: CommentWithUser[] = [];
  const replies = new Map<string, CommentWithUser[]>();

  for (const comment of comments) {
    if (!comment.parent_id) {
      topLevel.push(comment);
    } else {
      const existing = replies.get(comment.parent_id) || [];
      existing.push(comment);
      replies.set(comment.parent_id, existing);
    }
  }

  return { topLevel, replies };
}
