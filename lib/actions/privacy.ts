"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  discoveryVisibilitySchema,
  emailPreferencesSchema,
  type EmailPreferencesInput,
} from "@/lib/validation/privacy";
import { logError, logger } from "@/lib/utils/log";

export async function updateDiscoveryVisibility(visible: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 10 privacy updates per minute per user
  const { allowed } = await checkRateLimit(`privacy:${user.id}`, 10, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = discoveryVisibilitySchema.safeParse(visible);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ discovery_visible: visible })
    .eq("id", user.id);

  if (error) {
    logError("Error updating discovery visibility", error);
    return { success: false, error: "Failed to update privacy settings" };
  }

  revalidatePath("/settings");
  revalidatePath("/discover");

  return { success: true };
}

export async function getDiscoveryVisibility(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return true; // Default to visible
  }

  const { data } = await supabase
    .from("profiles")
    .select("discovery_visible")
    .eq("id", user.id)
    .single();

  return data?.discovery_visible ?? true;
}

export interface EmailPreferences {
  digestEnabled: boolean;
}

/**
 * The caller's own email preferences. The email_* columns are not readable
 * through a plain select since 065; the owner RPC returns the full row.
 */
export async function getEmailPreferences(): Promise<EmailPreferences> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { digestEnabled: true }; // column default (017)
  }

  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();

  if (error) {
    logError("Error fetching email preferences", error);
  }

  return { digestEnabled: data?.email_digest_enabled ?? true };
}

/**
 * Update the caller's own email preferences. The write goes through the
 * session client: 065 revoked SELECT on the email columns for the API roles
 * but left UPDATE alone, and the owner RLS policy scopes it to `id = auth.uid()`.
 */
export async function updateEmailPreferences(
  input: EmailPreferencesInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: shared with the other privacy toggles
  const { allowed } = await checkRateLimit(`privacy:${user.id}`, 10, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  const validationResult = emailPreferencesSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  const updates: { email_digest_enabled?: boolean } = {};
  if (validationResult.data.digestEnabled !== undefined) {
    updates.email_digest_enabled = validationResult.data.digestEnabled;
  }

  const { data: rows, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id");

  if (error) {
    logError("Error updating email preferences", error);
    return { success: false, error: "Failed to update email preferences" };
  }
  if (!rows || rows.length === 0) {
    logger.error("Email preferences update changed no rows", { userId: user.id });
    return { success: false, error: "Nothing was changed" };
  }

  revalidatePath("/settings");

  return { success: true };
}
