"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  updateProfileSchema,
  updateSocialLinksSchema,
  type UpdateProfileInput,
  type SocialLinkInput,
} from "@/lib/validation/profile";

/**
 * Update user profile
 */
export async function updateProfile(input: UpdateProfileInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate input with Zod
    const validationResult = updateProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Check if username is taken (by someone else)
    if (data.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .neq("id", user.id)
        .single();

      if (existing) {
        return { error: "Username is already taken" };
      }
    }

    // Map camelCase to snake_case for database
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.displayName !== undefined)
      updateData.display_name = data.displayName || null;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.bio !== undefined) updateData.bio = data.bio || null;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (data.avatarUrl !== undefined)
      updateData.avatar_url = data.avatarUrl || null;

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      return { error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/settings");
    if (data.username) {
      revalidatePath(`/users/${data.username}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Update social links for user profile
 */
export async function updateSocialLinks(links: SocialLinkInput[]) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate input with Zod
    const validationResult = updateSocialLinksSchema.safeParse(links);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const validatedLinks = validationResult.data;

    // Delete existing links
    await supabase.from("social_links").delete().eq("user_id", user.id);

    // Insert new links (filter out empty URLs)
    const validLinks = validatedLinks.filter((l) => l.url && l.url.trim());

    if (validLinks.length > 0) {
      const { error } = await supabase.from("social_links").insert(
        validLinks.map((link) => ({
          user_id: user.id,
          platform: link.platform,
          url: link.url,
          display_order: link.displayOrder,
        }))
      );

      if (error) {
        console.error("Error updating social links:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/profile");
    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("Error in updateSocialLinks:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { profile: null };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return { profile: null };
    }

    return { profile };
  } catch (error) {
    console.error("Error in getCurrentUserProfile:", error);
    return { profile: null };
  }
}

/**
 * Check if a username is available
 */
export async function checkUsernameAvailable(username: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .limit(1);

    // Exclude current user if logged in
    if (user) {
      query = query.neq("id", user.id);
    }

    const { data } = await query;

    return { available: !data || data.length === 0 };
  } catch (error) {
    console.error("Error in checkUsernameAvailable:", error);
    return { available: false };
  }
}
