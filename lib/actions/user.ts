"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(data: {
  display_name?: string;
  username?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate username if provided
    if (data.username) {
      // Check format: lowercase, alphanumeric, underscores only
      if (!/^[a-z0-9_]+$/.test(data.username)) {
        return {
          error:
            "Username can only contain lowercase letters, numbers, and underscores",
        };
      }
      if (data.username.length < 3 || data.username.length > 30) {
        return { error: "Username must be 3-30 characters" };
      }

      // Check if username is taken (by someone else)
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

    // Validate bio length
    if (data.bio && data.bio.length > 500) {
      return { error: "Bio must be less than 500 characters" };
    }

    // Validate website URL
    if (data.website && data.website.length > 0) {
      try {
        new URL(data.website);
      } catch {
        return { error: "Invalid website URL" };
      }
    }

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      return { error: error.message };
    }

    revalidatePath("/profile");
    if (data.username) {
      revalidatePath(`/users/${data.username}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function updateSocialLinks(
  links: {
    platform: string;
    url: string;
    display_order: number;
  }[]
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate URLs
    for (const link of links) {
      if (link.url) {
        try {
          new URL(link.url);
        } catch {
          return { error: `Invalid URL for ${link.platform}` };
        }
      }
    }

    // Delete existing links
    await supabase.from("social_links").delete().eq("user_id", user.id);

    // Insert new links (filter out empty URLs)
    const validLinks = links.filter((l) => l.url && l.url.trim());

    if (validLinks.length > 0) {
      const { error } = await supabase.from("social_links").insert(
        validLinks.map((link) => ({
          user_id: user.id,
          platform: link.platform,
          url: link.url,
          display_order: link.display_order,
        }))
      );

      if (error) {
        console.error("Error updating social links:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("Error in updateSocialLinks:", error);
    return { error: "An unexpected error occurred" };
  }
}

