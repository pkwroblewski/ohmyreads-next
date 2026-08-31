"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { discoveryVisibilitySchema } from "@/lib/validation/privacy";
import { logError } from "@/lib/utils/log";

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
