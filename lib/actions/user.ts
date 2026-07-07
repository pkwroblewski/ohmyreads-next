"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  updateProfileSchema,
  updateSocialLinksSchema,
  type UpdateProfileInput,
  type SocialLinkInput,
} from "@/lib/validation/profile";
import { sendWelcomeEmail } from "@/lib/actions/email";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import type { Database, Profile } from "@/types/database";

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

    // Rate limit: 20 profile updates per minute per user
    const { allowed } = await checkRateLimit(`profile:${user.id}`, 20, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
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

    // Rate limit: 20 profile updates per minute per user
    const { allowed } = await checkRateLimit(`profile:${user.id}`, 20, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
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

/**
 * Ensure user has a profile - creates one if missing
 * Fixes users who have auth accounts but no profile row
 */
export async function ensureUserProfile(): Promise<{
  profile: Profile | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { profile: null, error: "Not authenticated" };
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      return { profile: existingProfile as Profile };
    }

    // Rate limit the creation path only — the existing-profile early return
    // above must never be blocked (this runs on routine page loads)
    const { allowed } = await checkRateLimit(
      `profile-create:${user.id}`,
      5,
      60000
    );
    if (!allowed) {
      return { profile: null, error: "Too many requests. Please wait a moment." };
    }

    // Create profile - same logic as callback/route.ts
    const metadata = user.user_metadata || {};

    let username =
      metadata.preferred_username ||
      metadata.user_name ||
      user.email?.split("@")[0] ||
      `user_${user.id.slice(0, 8)}`;

    const displayName =
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      null;

    const avatarUrl =
      metadata.picture ||
      metadata.avatar_url ||
      null;

    // Check if user should be admin based on ADMIN_EMAILS env var
    // This is ONLY for initial provisioning of new users
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = user.email
      ? adminEmails.includes(user.email.toLowerCase())
      : false;

    // Prepare profile data
    const profileData: Database["public"]["Tables"]["profiles"]["Insert"] = {
      id: user.id,
      username: username,
      display_name: displayName,
      avatar_url: avatarUrl,
      is_admin: isAdmin,
    };

    // If granting admin, record when it was granted
    if (isAdmin) {
      profileData.admin_granted_at = new Date().toISOString();
      // admin_granted_by is NULL for env var provisioning
    }

    // Insert profile
    const { error: insertError } = await supabase.from("profiles").insert(profileData);

    // If username taken, retry with suffix
    if (insertError?.code === "23505") {
      username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
      profileData.username = username;
      const { error: retryError } = await supabase.from("profiles").insert(profileData);
      if (retryError) {
        console.error("Profile insert retry error:", retryError);
        return { profile: null, error: "Failed to create profile" };
      }
    } else if (insertError) {
      console.error("Profile insert error:", insertError);
      return { profile: null, error: "Failed to create profile" };
    }

    // Log admin role grant in audit table (if admin was granted)
    if (isAdmin) {
      try {
        await supabase.from("admin_role_changes").insert({
          user_id: user.id,
          changed_by: null, // System/env var provisioning
          action: "granted",
          source: "env_initial",
          reason: "Initial admin provisioning from ADMIN_EMAILS environment variable",
        });
      } catch (auditError) {
        console.error("Admin audit log error:", auditError);
        // Non-fatal, continue
      }
    }

    // Create reading_stats
    await supabase
      .from("reading_stats")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

    // Fetch the created profile
    const { data: newProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Send welcome email (non-blocking)
    if (user.email) {
      sendWelcomeEmail({
        email: user.email,
        username: username,
        displayName: displayName || undefined,
      }).catch(console.error);
    }

    return { profile: newProfile as Profile };
  } catch (error) {
    console.error("Error in ensureUserProfile:", error);
    return { profile: null, error: "An unexpected error occurred" };
  }
}
