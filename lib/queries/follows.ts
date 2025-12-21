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
