import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/auth/require-admin";
import type { BookSubmission, BookSubmissionWithSubmitter } from "@/types/database";
import { logError } from "@/lib/utils/log";

/**
 * Get submissions by user ID
 */
export async function getUserSubmissions(
  userId: string,
  status?: "pending" | "approved" | "rejected"
): Promise<BookSubmission[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("book_submissions")
      .select("*")
      .eq("submitted_by", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      logError("Error fetching user submissions", error);
      return [];
    }

    // DB stores status/cover_source as plain text; narrow to the app unions at the boundary
    return (data as BookSubmission[]) || [];
  } catch (error) {
    logError("Error in getUserSubmissions", error);
    return [];
  }
}

/**
 * Get all pending submissions (for admin moderation)
 */
export async function getPendingSubmissions(
  limit = 50
): Promise<BookSubmissionWithSubmitter[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("book_submissions")
      .select(
        `
        *,
        submitter:profiles!book_submissions_submitted_by_profiles_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      logError("Error fetching pending submissions", error);
      return [];
    }

    return data as BookSubmissionWithSubmitter[];
  } catch (error) {
    logError("Error in getPendingSubmissions", error);
    return [];
  }
}

/**
 * Get submission history (approved and rejected)
 */
export async function getSubmissionHistory(
  limit = 20
): Promise<BookSubmissionWithSubmitter[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("book_submissions")
      .select(
        `
        *,
        submitter:profiles!book_submissions_submitted_by_profiles_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .in("status", ["approved", "rejected"])
      .order("moderated_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError("Error fetching submission history", error);
      return [];
    }

    return data as BookSubmissionWithSubmitter[];
  } catch (error) {
    logError("Error in getSubmissionHistory", error);
    return [];
  }
}

/**
 * Get all submissions with filters (admin only; moved from lib/actions in Task 22)
 */
export async function getAllSubmissions(
  status?: "pending" | "approved" | "rejected"
) {
  try {
    const admin = await checkAdmin();

    if (!admin.ok) {
      return { error: admin.error, submissions: [] };
    }

    const { supabase } = admin;

    let query = supabase
      .from("book_submissions")
      .select(
        `
        *,
        submitter:profiles!book_submissions_submitted_by_profiles_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: submissions, error } = await query;

    if (error) {
      logError("Error fetching submissions", error);
      return { error: "Failed to fetch submissions", submissions: [] };
    }

    // DB stores status/cover_source as plain text; narrow to the app unions at the boundary
    return { submissions: (submissions as BookSubmissionWithSubmitter[]) || [] };
  } catch (error) {
    logError("Error in getAllSubmissions", error);
    return { error: "An unexpected error occurred", submissions: [] };
  }
}
