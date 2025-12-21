import { createClient } from "@/lib/supabase/server";

export interface FollowerProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followed_at: string;
}

// Check if current user follows a specific user
export async function isFollowing(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (currentUserId === targetUserId) return false;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId)
    .single();

  if (error) return false;
  return !!data;
}

// Get followers of a user
export async function getFollowers(
  userId: string,
  limit = 50
): Promise<FollowerProfile[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follows")
    .select(
      `
      created_at,
      follower:profiles!follows_follower_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        bio
      )
    `
    )
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching followers:", error);
    return [];
  }

  return (data || []).map((row) => {
    const follower = Array.isArray(row.follower)
      ? row.follower[0]
      : row.follower;
    return {
      id: follower?.id || "",
      username: follower?.username || "",
      display_name: follower?.display_name || null,
      avatar_url: follower?.avatar_url || null,
      bio: follower?.bio || null,
      followed_at: row.created_at,
    };
  });
}

// Get users that a user is following
export async function getFollowing(
  userId: string,
  limit = 50
): Promise<FollowerProfile[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follows")
    .select(
      `
      created_at,
      following:profiles!follows_following_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        bio
      )
    `
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching following:", error);
    return [];
  }

  return (data || []).map((row) => {
    const following = Array.isArray(row.following)
      ? row.following[0]
      : row.following;
    return {
      id: following?.id || "",
      username: following?.username || "",
      display_name: following?.display_name || null,
      avatar_url: following?.avatar_url || null,
      bio: following?.bio || null,
      followed_at: row.created_at,
    };
  });
}

// Get follow counts for a user
export async function getFollowCounts(
  userId: string
): Promise<{ followers: number; following: number }> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("followers_count, following_count")
    .eq("id", userId)
    .single();

  return {
    followers: profile?.followers_count || 0,
    following: profile?.following_count || 0,
  };
}

// Get IDs of users that a user is following (for filtering)
export async function getFollowingIds(userId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) {
    console.error("Error fetching following IDs:", error);
    return [];
  }

  return (data || []).map((row) => row.following_id);
}

// Suggested follow profile with shared books count
export interface SuggestedFollow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  shared_books: number;
}

/**
 * Get suggested users to follow based on shared reading interests.
 * Finds users who have read similar books, excluding already-followed users.
 */
export async function getSuggestedFollows(
  userId: string,
  limit = 5
): Promise<SuggestedFollow[]> {
  const supabase = await createClient();

  // Get books the current user has read or is reading
  const { data: userBooks } = await supabase
    .from("user_books")
    .select("book_id")
    .eq("user_id", userId);

  if (!userBooks || userBooks.length === 0) {
    // User has no books, can't suggest based on reading interests
    // Fall back to most active users
    return getActiveReaderSuggestions(userId, limit);
  }

  const userBookIds = userBooks.map((b) => b.book_id);

  // Get IDs of users already followed
  const followingIds = await getFollowingIds(userId);

  // Find users who have read similar books
  const { data: sharedBooksData, error } = await supabase
    .from("user_books")
    .select("user_id, book_id")
    .in("book_id", userBookIds)
    .neq("user_id", userId);

  if (error || !sharedBooksData) {
    console.error("Error finding shared books:", error);
    return [];
  }

  // Count shared books per user
  const userSharedBooks = new Map<string, number>();
  for (const row of sharedBooksData) {
    // Skip users already followed
    if (followingIds.includes(row.user_id)) continue;

    const count = userSharedBooks.get(row.user_id) || 0;
    userSharedBooks.set(row.user_id, count + 1);
  }

  // Get top users by shared books count
  const topUserIds = Array.from(userSharedBooks.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topUserIds.length === 0) {
    // No users with shared books found
    return getActiveReaderSuggestions(userId, limit);
  }

  // Fetch profiles for suggested users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", topUserIds);

  if (!profiles) return [];

  // Map and sort by shared books count
  return profiles
    .map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      shared_books: userSharedBooks.get(p.id) || 0,
    }))
    .sort((a, b) => b.shared_books - a.shared_books);
}

/**
 * Fallback: suggest active readers when no shared books found.
 */
async function getActiveReaderSuggestions(
  userId: string,
  limit: number
): Promise<SuggestedFollow[]> {
  const supabase = await createClient();

  // Get IDs of users already followed
  const followingIds = await getFollowingIds(userId);

  // Get users with most reviews, excluding self and followed
  const { data: reviews } = await supabase
    .from("reviews")
    .select("user_id")
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!reviews) return [];

  // Count reviews per user
  const userReviewCounts = new Map<string, number>();
  for (const r of reviews) {
    if (followingIds.includes(r.user_id)) continue;
    const count = userReviewCounts.get(r.user_id) || 0;
    userReviewCounts.set(r.user_id, count + 1);
  }

  // Get top users
  const topUserIds = Array.from(userReviewCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topUserIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", topUserIds);

  if (!profiles) return [];

  return profiles.map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    shared_books: 0, // Using reviews fallback, not shared books
  }));
}
