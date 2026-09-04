// Place submission reads for the admin moderation queue.
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { checkAdmin } from "@/lib/auth/require-admin";
import { logError } from "@/lib/utils/log";

/**
 * Get all pending place submissions (admin only)
 */
export async function getPendingPlaceSubmissions() {
  try {
    const admin = await checkAdmin();

    if (!admin.ok) {
      return { submissions: [], error: admin.error };
    }

    const { supabase } = admin;

    const { data, error } = await supabase
      .from("place_submissions")
      .select(`
        *,
        submitter:profiles!place_submissions_submitted_by_fkey(username, display_name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      logError("Error fetching pending submissions", error);
      return { submissions: [], error: "Failed to fetch submissions" };
    }

    return { submissions: data || [] };
  } catch (error) {
    logError("Error in getPendingPlaceSubmissions", error);
    return { submissions: [], error: "An unexpected error occurred" };
  }
}
