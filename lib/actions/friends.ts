"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  targetUserIdSchema,
  friendRequestIdSchema,
} from "@/lib/validation/social";

// ============================================
// SEND FRIEND REQUEST
// ============================================

export async function sendFriendRequest(targetUserId: string): Promise<{
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

    // Rate limit: 30 friend actions per minute per user
    const { allowed } = await checkRateLimit(`friend:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = targetUserIdSchema.safeParse(targetUserId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    if (user.id === targetUserId) {
      return { success: false, error: "You cannot send a friend request to yourself" };
    }

    // Check if request already exists in either direction
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("id, status, sender_id")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
      .single();

    if (existing) {
      if (existing.status === "accepted") {
        return { success: false, error: "You are already friends" };
      }
      if (existing.status === "pending") {
        if (existing.sender_id === user.id) {
          return { success: false, error: "Friend request already sent" };
        }
        // They sent us a request - accept it instead
        return { success: false, error: "This user has already sent you a friend request" };
      }
      // Status is rejected - allow resending
    }

    // Create friend request
    const { error } = await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: targetUserId,
      status: "pending",
    });

    if (error) {
      console.error("Error sending friend request:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/friends");
    revalidatePath(`/users`);

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in sendFriendRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// ACCEPT FRIEND REQUEST
// ============================================

export async function acceptFriendRequest(requestId: string): Promise<{
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

    // Rate limit: 30 friend actions per minute per user
    const { allowed } = await checkRateLimit(`friend:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = friendRequestIdSchema.safeParse(requestId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Verify this is a pending request to the current user
    const { data: request } = await supabase
      .from("friend_requests")
      .select("id, receiver_id, status")
      .eq("id", requestId)
      .single();

    if (!request) {
      return { success: false, error: "Friend request not found" };
    }

    if (request.receiver_id !== user.id) {
      return { success: false, error: "You can only accept requests sent to you" };
    }

    if (request.status !== "pending") {
      return { success: false, error: "This request has already been responded to" };
    }

    // Accept the request
    const { error } = await supabase
      .from("friend_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      console.error("Error accepting friend request:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/friends");
    revalidatePath("/dashboard");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in acceptFriendRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// REJECT FRIEND REQUEST
// ============================================

export async function rejectFriendRequest(requestId: string): Promise<{
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

    // Rate limit: 30 friend actions per minute per user
    const { allowed } = await checkRateLimit(`friend:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = friendRequestIdSchema.safeParse(requestId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Verify this is a pending request to the current user
    const { data: request } = await supabase
      .from("friend_requests")
      .select("id, receiver_id, status")
      .eq("id", requestId)
      .single();

    if (!request) {
      return { success: false, error: "Friend request not found" };
    }

    if (request.receiver_id !== user.id) {
      return { success: false, error: "You can only reject requests sent to you" };
    }

    if (request.status !== "pending") {
      return { success: false, error: "This request has already been responded to" };
    }

    // Reject the request
    const { error } = await supabase
      .from("friend_requests")
      .update({
        status: "rejected",
        responded_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      console.error("Error rejecting friend request:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/friends");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in rejectFriendRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// CANCEL FRIEND REQUEST (sent by current user)
// ============================================

export async function cancelFriendRequest(requestId: string): Promise<{
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

    // Rate limit: 30 friend actions per minute per user
    const { allowed } = await checkRateLimit(`friend:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = friendRequestIdSchema.safeParse(requestId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Verify this is a pending request from the current user
    const { data: request } = await supabase
      .from("friend_requests")
      .select("id, sender_id, status")
      .eq("id", requestId)
      .single();

    if (!request) {
      return { success: false, error: "Friend request not found" };
    }

    if (request.sender_id !== user.id) {
      return { success: false, error: "You can only cancel requests you sent" };
    }

    if (request.status !== "pending") {
      return { success: false, error: "Can only cancel pending requests" };
    }

    // Delete the request
    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", requestId);

    if (error) {
      console.error("Error canceling friend request:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/friends");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in cancelFriendRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// REMOVE FRIEND (unfriend)
// ============================================

export async function removeFriend(targetUserId: string): Promise<{
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

    // Rate limit: 30 friend actions per minute per user
    const { allowed } = await checkRateLimit(`friend:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = targetUserIdSchema.safeParse(targetUserId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Find the accepted friendship
    const { data: friendship } = await supabase
      .from("friend_requests")
      .select("id, status")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
      .eq("status", "accepted")
      .single();

    if (!friendship) {
      return { success: false, error: "Friendship not found" };
    }

    // Delete the friendship
    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", friendship.id);

    if (error) {
      console.error("Error removing friend:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/friends");
    revalidatePath(`/users`);

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in removeFriend:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
