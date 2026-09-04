"use server";

import { revalidatePath } from "next/cache";
import { BOOK_CATALOG_TAGS, invalidateTags } from "@/lib/cache/tags";
import { requireUser } from "@/lib/auth/require-user";
import { checkAdmin } from "@/lib/auth/require-admin";
import {
  createBookSubmissionSchema,
  moderateBookSubmissionSchema,
  type CreateBookSubmissionInput,
  type ModerateBookSubmissionInput,
} from "@/lib/validation/book-submission";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createAuditLog } from "@/lib/utils/audit-log";
import { generateSlug } from "@/lib/utils/slug";
import { logError, logger } from "@/lib/utils/log";
import type { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/app";

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
export async function submitBook(input: CreateBookSubmissionInput): Promise<ActionResult<{ submissionId: string; message: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to submit a book" };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 submissions per minute per user
    const { allowed } = await checkRateLimit(
      `submission:create:${user.id}`,
      10,
      60000
    );
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = createBookSubmissionSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
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
        success: false,
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
      logError("Error submitting book", error);
      return { success: false, error: "Failed to submit book. Please try again." };
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
    logError("Error in submitBook", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Moderate a book submission (approve/reject) - admin only
 */
export async function moderateSubmission(input: ModerateBookSubmissionInput): Promise<ActionResult<{ action: "approved" | "rejected"; bookId?: string }>> {
  try {
    const admin = await checkAdmin();

    if (!admin.ok) {
      // This one keeps its own wording for the authorization case.
      return {
        success: false,
        error:
          admin.reason === "unauthorized"
            ? "Not authorized to moderate submissions"
            : admin.error,
      };
    }

    const { supabase, user } = admin;

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input
    const validationResult = moderateBookSubmissionSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
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
      return { success: false, error: "Submission not found" };
    }

    if (submission.status !== "pending") {
      return { success: false, error: "Submission has already been moderated" };
    }

    if (action === "reject") {
      // Reject the submission. RLS can turn an update into a silent no-op, so
      // count the rows before claiming success or writing an audit row.
      const { data: rejected, error } = await supabase
        .from("book_submissions")
        .update({
          status: "rejected",
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq("id", submissionId)
        .select("id");

      if (error) {
        logError("Error rejecting submission", error);
        return { success: false, error: "Failed to reject submission" };
      }
      if (!rejected || rejected.length === 0) {
        logger.error("Submission reject changed no rows", { submissionId });
        return { success: false, error: "Nothing was changed" };
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
      logError("Error approving submission", approveError);
      return { success: false, error: "Failed to approve submission" };
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

    // A new book row now exists, so the catalog / genre / author caches are stale.
    invalidateTags(...BOOK_CATALOG_TAGS);
    revalidatePath("/admin/submissions");
    revalidatePath("/books");
    if (book?.slug) {
      revalidatePath(`/books/${book.slug}`);
    }

    return { success: true, action: "approved", bookId: bookId };
  } catch (error) {
    logError("Error in moderateSubmission", error);
    return { success: false, error: "An unexpected error occurred" };
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

