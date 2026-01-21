import { createClient } from "@/lib/supabase/server";
import type { DirectMessage, ConversationPreview } from "@/types/database";

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

  // Get accepted friend IDs first (to filter conversations)
  const { data: friendships } = await supabase
    .from("friend_requests")
    .select("sender_id, receiver_id")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq("status", "accepted");

  // Extract friend IDs (the other person in each friendship)
  const friendIds = new Set(
    friendships?.map((f) => (f.sender_id === user.id ? f.receiver_id : f.sender_id)) || []
  );

  // If no friends, no conversations to show
  if (friendIds.size === 0) return [];

  // Get all messages involving current user
  const { data: messages, error } = await supabase
    .from("direct_messages")
    .select(`
      id,
      sender_id,
      receiver_id,
      content,
      read_at,
      created_at
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error || !messages) {
    console.error("Error fetching conversations:", error);
    return [];
  }

  // Group by conversation partner and get most recent message
  // Only include conversations with accepted friends
  const conversationMap = new Map<string, {
    lastMessage: typeof messages[0];
    unreadCount: number;
  }>();

  for (const msg of messages) {
    const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;

    // Skip if not a current friend
    if (!friendIds.has(otherUserId)) continue;

    if (!conversationMap.has(otherUserId)) {
      conversationMap.set(otherUserId, {
        lastMessage: msg,
        unreadCount: 0,
      });
    }

    // Count unread messages (where I'm receiver and not read)
    if (msg.receiver_id === user.id && !msg.read_at) {
      const conv = conversationMap.get(otherUserId)!;
      conv.unreadCount++;
    }
  }

  // Get friend profiles for conversations we have messages with
  const conversationFriendIds = Array.from(conversationMap.keys());
  if (conversationFriendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", conversationFriendIds);

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Build conversation previews
  const conversations: ConversationPreview[] = [];

  for (const [friendId, data] of conversationMap) {
    const profile = profileMap.get(friendId);
    if (!profile) continue;

    conversations.push({
      friend_id: friendId,
      friend_username: profile.username || "",
      friend_display_name: profile.display_name,
      friend_avatar_url: profile.avatar_url,
      last_message: data.lastMessage.content,
      last_message_at: data.lastMessage.created_at,
      unread_count: data.unreadCount,
    });
  }

  // Sort by most recent message
  return conversations.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
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
    console.error("Error fetching messages:", error);
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
    console.error("Error fetching unread count:", error);
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
