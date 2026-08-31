import { createClient } from "@/lib/supabase/server";
import type { BookSubmission, BookSubmissionWithSubmitter } from "@/types/database";
import { logError } from "@/lib/utils/log";

/**
 * Get a submission by ID
 */
export async function getSubmissionById(
  submissionId: string
): Promise<BookSubmissionWithSubmitter | null> {
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
      .eq("id", submissionId)
      .single();

    if (error) {
      logError("Error fetching submission", error);
      return null;
    }

    return data as BookSubmissionWithSubmitter;
  } catch (error) {
    logError("Error in getSubmissionById", error);
    return null;
  }
}

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
 * Get all submissions with optional filters (admin)
 */
export async function getAllSubmissions(options?: {
  status?: "pending" | "approved" | "rejected";
  page?: number;
  limit?: number;
}): Promise<{ submissions: BookSubmissionWithSubmitter[]; total: number }> {
  try {
    const supabase = await createClient();
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

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
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logError("Error fetching submissions", error);
      return { submissions: [], total: 0 };
    }

    return {
      submissions: (data as BookSubmissionWithSubmitter[]) || [],
      total: count || 0,
    };
  } catch (error) {
    logError("Error in getAllSubmissions", error);
    return { submissions: [], total: 0 };
  }
}

/**
 * Get submission statistics
 */
export async function getSubmissionStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  try {
    const supabase = await createClient();

    const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
      supabase
        .from("book_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("book_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("book_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);

    return {
      pending: pendingResult.count || 0,
      approved: approvedResult.count || 0,
      rejected: rejectedResult.count || 0,
      total:
        (pendingResult.count || 0) +
        (approvedResult.count || 0) +
        (rejectedResult.count || 0),
    };
  } catch (error) {
    logError("Error in getSubmissionStats", error);
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }
}

/**
 * Check if a book with similar title and author already exists
 */
export async function checkDuplicateBook(
  title: string,
  author: string
): Promise<{
  exists: boolean;
  existingBook?: { id: string; slug: string } | null;
  existingSubmission?: { id: string; status: string } | null;
}> {
  try {
    const supabase = await createClient();

    // Check in books table
    const { data: book } = await supabase
      .from("books")
      .select("id, slug")
      .ilike("title", title)
      .ilike("author", author)
      .single();

    if (book) {
      return { exists: true, existingBook: book };
    }

    // Check in pending submissions
    const { data: submission } = await supabase
      .from("book_submissions")
      .select("id, status")
      .ilike("title", title)
      .ilike("author", author)
      .eq("status", "pending")
      .single();

    if (submission) {
      return {
        exists: true,
        // status can't be null here — the query filters on status = "pending"
        existingSubmission: { id: submission.id, status: submission.status ?? "pending" },
      };
    }

    return { exists: false };
  } catch (error) {
    logError("Error in checkDuplicateBook", error);
    return { exists: false };
  }
}

/**
 * Get recently approved submissions
 */
export async function getRecentlyApprovedSubmissions(
  limit = 10
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
      .eq("status", "approved")
      .order("moderated_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError("Error fetching approved submissions", error);
      return [];
    }

    return data as BookSubmissionWithSubmitter[];
  } catch (error) {
    logError("Error in getRecentlyApprovedSubmissions", error);
    return [];
  }
}

