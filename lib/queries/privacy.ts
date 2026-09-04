// The caller's own privacy and email settings.
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { createClient, getUser } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

export async function getDiscoveryVisibility(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

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
  } = await getUser();

  if (!user) {
    return { digestEnabled: true }; // column default (017)
  }

  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();

  if (error) {
    logError("Error fetching email preferences", error);
  }

  return { digestEnabled: data?.email_digest_enabled ?? true };
}
