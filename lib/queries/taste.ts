// The caller's taste profile (optional personalisation data).
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { createClient, getUser } from "@/lib/supabase/server";
import type { UserTasteProfile } from "@/types/database";
import { logger } from "@/lib/utils/log";

/**
 * Get current user's taste profile
 * Note: This is non-critical - if it fails, we just return null
 * and the app continues to work without personalization
 */
export async function getTasteProfile() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await getUser();

    if (authError || !user) {
      return { profile: null };
    }

    const { data: profile, error } = await supabase
      .from("user_taste_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Any error (table doesn't exist, no rows, etc.) - just return null
    // This is non-critical functionality
    if (error) {
      // Only log in development for debugging, and only for unexpected errors
      if (process.env.NODE_ENV === "development") {
        // Common expected errors - don't log these
        const isExpectedError = 
          error.code === "PGRST116" || // No rows found
          error.code === "42P01" ||    // Table doesn't exist
          String(error.message || "").includes("does not exist") ||
          String(error.code || "").includes("PGRST");
        
        if (!isExpectedError) {
          logger.debug("Non-critical error in getTasteProfile", {
            errorCode: error.code,
            errorMessage: error.message,
          });
        }
      }
      return { profile: null };
    }

    // DB stores pace/length as plain text; narrow to the app unions at the boundary
    return { profile: (profile as UserTasteProfile) || null };
  } catch {
    // Silently fail - taste profile is optional
    return { profile: null };
  }
}
