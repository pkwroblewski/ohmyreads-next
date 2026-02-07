"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";

// ============================================
// SEND MESSAGE
// ============================================

export async function sendMessage(
  receiverId: string,
  content: string
): Promise<{
  success: boolean;
  messageId: string | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, messageId: null, error: "Not authenticated" };
    }

    // Rate limit: 30 messages per minute per user
    const { allowed } = await checkRateLimit(`message:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, messageId: null, error: "Too many messages. Please wait a moment." };
    }

    if (user.id === receiverId) {
      return { success: false, messageId: null, error: "You cannot message yourself" };
    }

    // Trim and validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return { success: false, messageId: null, error: "Message cannot be empty" };
    }

    if (trimmedContent.length > 2000) {
      return { success: false, messageId: null, error: "Message is too long (max 2000 characters)" };
    }

    // Verify friendship (RLS will also check but we provide better error message)
    const { data: friendship } = await supabase
      .from("friend_requests")
      .select("id")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
      .eq("status", "accepted")
      .single();

    if (!friendship) {
      return { success: false, messageId: null, error: "You can only message friends" };
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content: trimmedContent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return { success: false, messageId: null, error: "Failed to send message" };
    }

    return { success: true, messageId: message.id, error: null };
  } catch (error) {
    console.error("Unexpected error in sendMessage:", error);
    return { success: false, messageId: null, error: "An unexpected error occurred" };
  }
}

// ============================================
// MARK MESSAGES AS READ
// ============================================

export async function markMessagesAsRead(friendId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Mark all unread messages from this friend as read
    const { error } = await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", friendId)
      .eq("receiver_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Error marking messages as read:", error);
      return { success: false, error: "Failed to mark messages as read" };
    }

    // Recalculate unread count
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .is("read_at", null);

    // Update profile's unread count
    await supabase
      .from("profiles")
      .update({ unread_messages_count: count || 0 })
      .eq("id", user.id);

    revalidatePath("/");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in markMessagesAsRead:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// DELETE MESSAGE
// ============================================

export async function deleteMessage(messageId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Delete message (RLS ensures only sender can delete)
    const { error } = await supabase
      .from("direct_messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", user.id);

    if (error) {
      console.error("Error deleting message:", error);
      return { success: false, error: "Failed to delete message" };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in deleteMessage:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
