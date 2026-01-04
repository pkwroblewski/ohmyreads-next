"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDiscoveryVisibility(visible: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ discovery_visible: visible })
    .eq("id", user.id);

  if (error) {
    console.error("Error updating discovery visibility:", error);
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
