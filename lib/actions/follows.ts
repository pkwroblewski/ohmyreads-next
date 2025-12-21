"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function followUser(targetUserId: string): Promise<{
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
      console.error("Error following user:", error);
      return { success: false, error: error.message };
    }

    // Revalidate relevant pages
    revalidatePath("/community");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in followUser:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function unfollowUser(targetUserId: string): Promise<{
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

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);

    if (error) {
      console.error("Error unfollowing user:", error);
      return { success: false, error: error.message };
    }

    // Revalidate relevant pages
    revalidatePath("/community");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error in unfollowUser:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function toggleFollow(targetUserId: string): Promise<{
  success: boolean;
  isFollowing: boolean;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, isFollowing: false, error: "Not authenticated" };
    }

    if (user.id === targetUserId) {
      return { success: false, isFollowing: false, error: "You cannot follow yourself" };
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
      return { ...result, isFollowing: false };
    } else {
      // Follow
      const result = await followUser(targetUserId);
      return { ...result, isFollowing: result.success };
    }
  } catch (error) {
    console.error("Unexpected error in toggleFollow:", error);
    return { success: false, isFollowing: false, error: "An unexpected error occurred" };
  }
}
