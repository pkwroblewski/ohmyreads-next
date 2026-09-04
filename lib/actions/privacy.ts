"use server";

import { requireUser } from "@/lib/auth/require-user";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  discoveryVisibilitySchema,
  emailPreferencesSchema,
  type EmailPreferencesInput,
} from "@/lib/validation/privacy";
import { logError, logger } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";

export async function updateDiscoveryVisibility(visible: boolean): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase, user } = auth;

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

/**
 * Update the caller's own email preferences. The write goes through the
 * session client: 065 revoked SELECT on the email columns for the API roles
 * but left UPDATE alone, and the owner RLS policy scopes it to `id = auth.uid()`.
 */
export async function updateEmailPreferences(
  input: EmailPreferencesInput
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase, user } = auth;

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
