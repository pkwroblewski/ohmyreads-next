"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createBookSubmissionSchema,
  updateBookSubmissionSchema,
  moderateBookSubmissionSchema,
  type CreateBookSubmissionInput,
  type UpdateBookSubmissionInput,
  type ModerateBookSubmissionInput,
} from "@/lib/validation/book-submission";
import { createAuditLog } from "@/lib/utils/audit-log";
import { generateSlug } from "@/lib/utils/slug";

// Helper function to ensure unique slug
async function ensureUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    let query = supabase
      .from("book_submissions")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      // Also check books table
      const { data: bookData } = await supabase
        .from("books")
        .select("id")
        .eq("slug", slug)
        .limit(1);

      if (!bookData || bookData.length === 0) {
        return slug;
      }
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      // Safety valve
      slug = `${baseSlug}-${Date.now()}`;
      return slug;
    }
  }
}

/**
 * Submit a new book for review/moderation
 */
export async function submitBook(input: CreateBookSubmissionInput) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to submit a book" };
    }

    // Validate input with Zod
    const validationResult = createBookSubmissionSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Generate unique slug
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(supabase, baseSlug);

    // Check for duplicate submissions by same user (same title and author)
    const { data: existingSubmission } = await supabase
      .from("book_submissions")
      .select("id")
      .eq("submitted_by", user.id)
      .eq("title", data.title)
      .eq("author", data.author)
      .eq("status", "pending")
      .single();

    if (existingSubmission) {
      return {
        error: "You already have a pending submission for this book",
      };
    }

    // Insert submission
    const { data: submission, error } = await supabase
      .from("book_submissions")
      .insert({
        submitted_by: user.id,
        title: data.title,
        author: data.author,
        isbn: data.isbn || null,
        slug,
        description: data.description || null,
        cover_url: data.coverUrl || null,
        genres: data.genres,
        published_date: data.publishedDate || null,
        page_count: data.pageCount || null,
        status: "pending",
        // External IDs for better cover resolution
        google_books_id: data.googleBooksId || null,
        open_library_id: data.openLibraryId || null,
        open_library_cover_id: data.openLibraryCoverId || null,
        cover_source: data.coverSource || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting book:", error);
      return { error: "Failed to submit book. Please try again." };
    }

    // Revalidate relevant paths
    revalidatePath("/submit-book");
    revalidatePath("/dashboard");

    return {
      success: true,
      submissionId: submission.id,
      message: "Book submitted successfully! It will be reviewed by our team.",
    };
  } catch (error) {
    console.error("Error in submitBook:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Update a pending book submission (only by submitter)
 */
export async function updateBookSubmission(
  submissionId: string,
  input: UpdateBookSubmissionInput
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

    // Validate input
    const validationResult = updateBookSubmissionSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Verify ownership and status
    const { data: submission } = await supabase
      .from("book_submissions")
      .select("submitted_by, status, slug")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return { error: "Submission not found" };
    }

    if (submission.submitted_by !== user.id) {
      return { error: "Not authorized to edit this submission" };
    }

    if (submission.status !== "pending") {
      return { error: "Cannot edit a submission that is no longer pending" };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) {
      updateData.title = data.title;
      // Update slug if title changed
      const baseSlug = generateSlug(data.title);
      updateData.slug = await ensureUniqueSlug(supabase, baseSlug, submissionId);
    }
    if (data.author !== undefined) updateData.author = data.author;
    if (data.isbn !== undefined) updateData.isbn = data.isbn || null;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.coverUrl !== undefined)
      updateData.cover_url = data.coverUrl || null;
    if (data.genres !== undefined) updateData.genres = data.genres;
    if (data.publishedDate !== undefined)
      updateData.published_date = data.publishedDate || null;
    if (data.pageCount !== undefined)
      updateData.page_count = data.pageCount || null;

    const { error } = await supabase
      .from("book_submissions")
      .update(updateData)
      .eq("id", submissionId);

    if (error) {
      console.error("Error updating submission:", error);
      return { error: "Failed to update submission" };
    }

    revalidatePath("/submit-book");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error in updateBookSubmission:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Delete a pending book submission (only by submitter)
 */
export async function deleteBookSubmission(submissionId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Verify ownership and status
    const { data: submission } = await supabase
      .from("book_submissions")
      .select("submitted_by, status")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return { error: "Submission not found" };
    }

    if (submission.submitted_by !== user.id) {
      return { error: "Not authorized to delete this submission" };
    }

    if (submission.status !== "pending") {
      return { error: "Cannot delete a submission that is no longer pending" };
    }

    const { error } = await supabase
      .from("book_submissions")
      .delete()
      .eq("id", submissionId);

    if (error) {
      console.error("Error deleting submission:", error);
      return { error: "Failed to delete submission" };
    }

    revalidatePath("/submit-book");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteBookSubmission:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Get user's book submissions
 */
export async function getUserSubmissions() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated", submissions: [] };
    }

    const { data: submissions, error } = await supabase
      .from("book_submissions")
      .select("*")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      return { error: "Failed to fetch submissions", submissions: [] };
    }

    return { submissions: submissions || [] };
  } catch (error) {
    console.error("Error in getUserSubmissions:", error);
    return { error: "An unexpected error occurred", submissions: [] };
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Check if current user is an admin
 */
async function isAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  return profile?.is_admin === true;
}

/**
 * Get pending submissions (admin only)
 */
export async function getPendingSubmissions() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated", submissions: [] };
    }

    // Check admin status
    if (!(await isAdmin(supabase, user.id))) {
      return { error: "Not authorized", submissions: [] };
    }

    const { data: submissions, error } = await supabase
      .from("book_submissions")
      .select(
        `
        *,
        submitter:profiles!book_submissions_submitted_by_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching pending submissions:", error);
      return { error: "Failed to fetch submissions", submissions: [] };
    }

    return { submissions: submissions || [] };
  } catch (error) {
    console.error("Error in getPendingSubmissions:", error);
    return { error: "An unexpected error occurred", submissions: [] };
  }
}

/**
 * Moderate a book submission (approve/reject) - admin only
 */
export async function moderateSubmission(input: ModerateBookSubmissionInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Check admin status
    if (!(await isAdmin(supabase, user.id))) {
      return { error: "Not authorized to moderate submissions" };
    }

    // Validate input
    const validationResult = moderateBookSubmissionSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { submissionId, action, rejectionReason } = validationResult.data;

    // Get the submission
    const { data: submission } = await supabase
      .from("book_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return { error: "Submission not found" };
    }

    if (submission.status !== "pending") {
      return { error: "Submission has already been moderated" };
    }

    if (action === "reject") {
      // Reject the submission
      const { error } = await supabase
        .from("book_submissions")
        .update({
          status: "rejected",
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq("id", submissionId);

      if (error) {
        console.error("Error rejecting submission:", error);
        return { error: "Failed to reject submission" };
      }

      // Audit log
      await createAuditLog({
        action: "moderation.book.reject",
        targetType: "book_submission",
        targetId: submissionId,
        userId: user.id,
        metadata: {
          bookTitle: submission.title,
          bookAuthor: submission.author,
          rejectionReason: rejectionReason || null,
          submittedBy: submission.submitted_by,
        },
      });

      revalidatePath("/admin/submissions");

      return { success: true, action: "rejected" };
    }

    // Approve: Create the book and update submission atomically via RPC
    const { data: bookId, error: approveError } = await supabase.rpc(
      "approve_book_submission",
      {
        p_submission_id: submissionId,
        p_moderator_id: user.id,
      }
    );

    if (approveError) {
      console.error("Error approving submission:", approveError);
      return { error: "Failed to approve submission" };
    }

    // Get the created book's slug for revalidation
    const { data: book } = await supabase
      .from("books")
      .select("slug")
      .eq("id", bookId)
      .single();

    // Audit log
    await createAuditLog({
      action: "moderation.book.approve",
      targetType: "book_submission",
      targetId: submissionId,
      userId: user.id,
      metadata: {
        bookTitle: submission.title,
        bookAuthor: submission.author,
        bookId: bookId,
        bookSlug: book?.slug,
        submittedBy: submission.submitted_by,
      },
    });

    revalidatePath("/admin/submissions");
    revalidatePath("/books");
    if (book?.slug) {
      revalidatePath(`/books/${book.slug}`);
    }

    return { success: true, action: "approved", bookId: bookId };
  } catch (error) {
    console.error("Error in moderateSubmission:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Approve a book submission (admin only) - wrapper around moderateSubmission
 */
export async function approveBookSubmission(submissionId: string) {
  return moderateSubmission({
    submissionId,
    action: "approve",
  });
}

/**
 * Reject a book submission (admin only) - wrapper around moderateSubmission
 */
export async function rejectBookSubmission(
  submissionId: string,
  rejectionReason?: string
) {
  return moderateSubmission({
    submissionId,
    action: "reject",
    rejectionReason,
  });
}

/**
 * Get all submissions with filters (admin only)
 */
export async function getAllSubmissions(
  status?: "pending" | "approved" | "rejected"
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated", submissions: [] };
    }

    // Check admin status
    if (!(await isAdmin(supabase, user.id))) {
      return { error: "Not authorized", submissions: [] };
    }

    let query = supabase
      .from("book_submissions")
      .select(
        `
        *,
        submitter:profiles!book_submissions_submitted_by_fkey(
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
      console.error("Error fetching submissions:", error);
      return { error: "Failed to fetch submissions", submissions: [] };
    }

    return { submissions: submissions || [] };
  } catch (error) {
    console.error("Error in getAllSubmissions:", error);
    return { error: "An unexpected error occurred", submissions: [] };
  }
}

