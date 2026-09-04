"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { targetUserIdSchema } from "@/lib/validation/social";
import { logError, reportError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
async function followUser(targetUserId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 30 follow actions per minute per user
    const { allowed } = await checkRateLimit(`follow:${user.id}`, 30, 60000);
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
      return { success: false, error: "You cannot follow yourself" };
    }

    // Check if already following
    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .single();

    if (existing) {
      return { success: false, error: "Already following this user" };
    }

    // Create follow
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

    if (error) {
      return { success: false, error: reportError("Error following user", error) };
    }

    // Revalidate relevant pages
    revalidatePath("/community");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in followUser", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

async function unfollowUser(targetUserId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 30 follow actions per minute per user
    const { allowed } = await checkRateLimit(`follow:${user.id}`, 30, 60000);
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

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);

    if (error) {
      return { success: false, error: reportError("Error unfollowing user", error) };
    }

    // Revalidate relevant pages
    revalidatePath("/community");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in unfollowUser", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function toggleFollow(targetUserId: string): Promise<ActionResult<{ isFollowing: boolean }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Validate input with Zod (rate limiting happens in the delegated
    // followUser/unfollowUser call — checking here too would double-count)
    const validationResult = targetUserIdSchema.safeParse(targetUserId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    if (user.id === targetUserId) {
      return { success: false, error: "You cannot follow yourself" };
    }

    // Check if already following
    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .single();

    if (existing) {
      // Unfollow
      const result = await unfollowUser(targetUserId);
      return result.success ? { success: true, isFollowing: false } : result;
    } else {
      // Follow
      const result = await followUser(targetUserId);
      return result.success ? { success: true, isFollowing: true } : result;
    }
  } catch (error) {
    logError("Unexpected error in toggleFollow", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
