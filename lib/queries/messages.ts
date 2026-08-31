import { createClient } from "@/lib/supabase/server";
import type { DirectMessage, ConversationPreview } from "@/types/database";
import { logError } from "@/lib/utils/log";

// ============================================
// GET CONVERSATIONS
// ============================================

/**
 * Get all conversations (with last message preview) for current user
 * Returns list of friends they've messaged, sorted by most recent
 * Only shows conversations with accepted friends (consistent with messaging rules)
 */
export async function getConversations(): Promise<ConversationPreview[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Grouped in SQL (migration 058). This used to fetch every message the user
  // had ever sent or received and group them in JS, so past PostgREST's
  // 1000-row cap older conversations vanished and unread counts were wrong.
  const { data, error } = await supabase.rpc("get_conversations");

  if (error) {
    logError("Error fetching conversations", error);
    return [];
  }

  return (data || []).map((row) => ({
    friend_id: row.friend_id,
    friend_username: row.friend_username,
    friend_display_name: row.friend_display_name,
    friend_avatar_url: row.friend_avatar_url,
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    unread_count: Number(row.unread_count),
  }));
}

// ============================================
// GET MESSAGES
// ============================================

export interface GetMessagesResult {
  messages: DirectMessage[];
  hasMore: boolean;
}

/**
 * Get messages between current user and a friend
 * Returns messages in reverse chronological order (newest first)
 */
export async function getMessages(
  friendId: string,
  limit = 50,
  beforeId?: string
): Promise<GetMessagesResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { messages: [], hasMore: false };

  let query = supabase
    .from("direct_messages")
    .select("*")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there are more

  if (beforeId) {
    // Get cursor message's created_at
    const { data: cursorMsg } = await supabase
      .from("direct_messages")
      .select("created_at")
      .eq("id", beforeId)
      .single();

    if (cursorMsg) {
      query = query.lt("created_at", cursorMsg.created_at);
    }
  }

  const { data: messages, error } = await query;

  if (error) {
    logError("Error fetching messages", error);
    return { messages: [], hasMore: false };
  }

  const hasMore = (messages?.length || 0) > limit;
  const resultMessages = messages?.slice(0, limit) || [];

  // Reverse to show oldest first in conversation view
  return {
    messages: resultMessages.reverse(),
    hasMore,
  };
}

// ============================================
// GET UNREAD COUNT
// ============================================

/**
 * Get total unread message count for current user
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from("direct_messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .is("read_at", null);

  if (error) {
    logError("Error fetching unread count", error);
    return 0;
  }

  return count || 0;
}

// ============================================
// GET CONVERSATION WITH FRIEND
// ============================================

/**
 * Get a specific conversation's info (for chat header)
 */
export async function getConversationFriend(friendId: string): Promise<{
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Verify they are friends
  const { data: friendship } = await supabase
    .from("friend_requests")
    .select("id")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
    .eq("status", "accepted")
    .single();

  if (!friendship) return null;

  // Get friend profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", friendId)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username || "",
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
  };
}
