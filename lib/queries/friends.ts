import { createClient } from "@/lib/supabase/server";
import type { FriendshipStatus, FriendRequestWithSender, FriendRequestWithReceiver } from "@/types/database";

export interface FriendProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  friends_since: string;
}

// ============================================
// GET FRIENDS LIST
// ============================================

/**
 * Get all friends of a user (accepted friend requests in either direction)
 */
export async function getFriends(
  userId: string,
  limit = 50
): Promise<FriendProfile[]> {
  const supabase = await createClient();

  // Get accepted requests where user is sender
  const { data: sentAccepted } = await supabase
    .from("friend_requests")
    .select(`
      responded_at,
      receiver:profiles!friend_requests_receiver_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        bio
      )
    `)
    .eq("sender_id", userId)
    .eq("status", "accepted")
    .order("responded_at", { ascending: false })
    .limit(limit);

  // Get accepted requests where user is receiver
  const { data: receivedAccepted } = await supabase
    .from("friend_requests")
    .select(`
      responded_at,
      sender:profiles!friend_requests_sender_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        bio
      )
    `)
    .eq("receiver_id", userId)
    .eq("status", "accepted")
    .order("responded_at", { ascending: false })
    .limit(limit);

  // Combine and map results
  const friends: FriendProfile[] = [];

  for (const row of sentAccepted || []) {
    const receiver = Array.isArray(row.receiver) ? row.receiver[0] : row.receiver;
    if (receiver) {
      friends.push({
        id: receiver.id,
        username: receiver.username || "",
        display_name: receiver.display_name,
        avatar_url: receiver.avatar_url,
        bio: receiver.bio,
        friends_since: row.responded_at || "",
      });
    }
  }

  for (const row of receivedAccepted || []) {
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    if (sender) {
      friends.push({
        id: sender.id,
        username: sender.username || "",
        display_name: sender.display_name,
        avatar_url: sender.avatar_url,
        bio: sender.bio,
        friends_since: row.responded_at || "",
      });
    }
  }

  // Sort by friends_since and limit
  return friends
    .sort((a, b) => new Date(b.friends_since).getTime() - new Date(a.friends_since).getTime())
    .slice(0, limit);
}

// ============================================
// GET PENDING REQUESTS (incoming)
// ============================================

/**
 * Get pending friend requests sent to the current user
 */
export async function getPendingRequests(): Promise<FriendRequestWithSender[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      *,
      sender:profiles!friend_requests_sender_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending requests:", error.message, error.code, error.details);
    return [];
  }

  return (data || []).map((row) => {
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    return {
      ...row,
      sender: {
        id: sender?.id || "",
        username: sender?.username || "",
        display_name: sender?.display_name || null,
        avatar_url: sender?.avatar_url || null,
      },
    };
  });
}

// ============================================
// GET SENT REQUESTS (outgoing)
// ============================================

/**
 * Get pending friend requests sent by the current user
 */
export async function getSentRequests(): Promise<FriendRequestWithReceiver[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      *,
      receiver:profiles!friend_requests_receiver_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("sender_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sent requests:", error);
    return [];
  }

  return (data || []).map((row) => {
    const receiver = Array.isArray(row.receiver) ? row.receiver[0] : row.receiver;
    return {
      ...row,
      receiver: {
        id: receiver?.id || "",
        username: receiver?.username || "",
        display_name: receiver?.display_name || null,
        avatar_url: receiver?.avatar_url || null,
      },
    };
  });
}

// ============================================
// GET FRIENDSHIP STATUS
// ============================================

/**
 * Get the friendship status between current user and target user
 */
export async function getFriendshipStatus(
  targetUserId: string
): Promise<{ status: FriendshipStatus; requestId: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "none", requestId: null };
  }

  if (user.id === targetUserId) {
    return { status: "none", requestId: null };
  }

  // Check for any request in either direction
  const { data: request } = await supabase
    .from("friend_requests")
    .select("id, sender_id, status")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
    .single();

  if (!request) {
    return { status: "none", requestId: null };
  }

  if (request.status === "accepted") {
    return { status: "friends", requestId: request.id };
  }

  if (request.status === "pending") {
    if (request.sender_id === user.id) {
      return { status: "pending_sent", requestId: request.id };
    }
    return { status: "pending_received", requestId: request.id };
  }

  // Status is 'rejected' - treat as no relationship (allow resend)
  return { status: "none", requestId: null };
}

// ============================================
// ARE FRIENDS (boolean check)
// ============================================

/**
 * Check if current user is friends with target user
 */
export async function areFriends(targetUserId: string): Promise<boolean> {
  const { status } = await getFriendshipStatus(targetUserId);
  return status === "friends";
}

// ============================================
// GET PENDING REQUESTS COUNT
// ============================================

/**
 * Get count of pending incoming friend requests (for notification badge)
 */
export async function getPendingRequestsCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from("friend_requests")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching pending count:", error);
    return 0;
  }

  return count || 0;
}

// ============================================
// GET FRIEND IDS (for filtering)
// ============================================

/**
 * Get IDs of all friends (for filtering queries)
 */
export async function getFriendIds(userId: string): Promise<string[]> {
  const supabase = await createClient();

  // Get accepted requests where user is sender
  const { data: sent } = await supabase
    .from("friend_requests")
    .select("receiver_id")
    .eq("sender_id", userId)
    .eq("status", "accepted");

  // Get accepted requests where user is receiver
  const { data: received } = await supabase
    .from("friend_requests")
    .select("sender_id")
    .eq("receiver_id", userId)
    .eq("status", "accepted");

  const friendIds = new Set<string>();

  for (const row of sent || []) {
    friendIds.add(row.receiver_id);
  }

  for (const row of received || []) {
    friendIds.add(row.sender_id);
  }

  return Array.from(friendIds);
}
