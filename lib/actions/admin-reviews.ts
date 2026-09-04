"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache/tags";
import { createAuditLog } from "@/lib/utils/audit-log";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError, logger } from "@/lib/utils/log";
import {
  adminDeleteReviewSchema,
} from "@/lib/validation/admin";
import type { ActionResult } from "@/types/app";

// Delete review
export async function adminDeleteReview(reviewId: string, reason?: string): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminDeleteReviewSchema.safeParse({
      reviewId,
      reason,
    });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Get review info for audit log
    const { data: review } = await supabase
      .from("reviews")
      .select(`
        id,
        user_id,
        profiles!reviews_user_profile_fkey(username),
        books!reviews_book_id_fkey(title)
      `)
      .eq("id", reviewId)
      .single();

    if (!review) {
      return { success: false, error: "Review not found" };
    }

    const profile = Array.isArray(review.profiles)
      ? review.profiles[0]
      : review.profiles;
    const book = Array.isArray(review.books)
      ? review.books[0]
      : review.books;

    // Delete review. RLS can turn a delete into a silent no-op, so count the
    // rows before claiming success or writing an audit row.
    const { data: deleted, error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .select("id");

    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      logger.error("Admin review delete changed no rows", { reviewId });
      return { success: false, error: "Nothing was changed" };
    }

    // Audit log
    await createAuditLog({
      action: "admin.review.delete",
      targetType: "review",
      targetId: reviewId,
      userId: user.id,
      metadata: {
        reviewUserId: review.user_id,
        reviewUsername: profile?.username,
        bookTitle: book?.title,
        reason: reason || "No reason provided",
      },
    });

    // The review is gone and the book's local rating moved with it; the
    // cached book page and review lists must not keep serving it.
    invalidateTags(CACHE_TAGS.books, CACHE_TAGS.reviews);
    revalidatePath("/admin/reviews");

    return {
      success: true,
      message: "Review deleted successfully",
    };
  } catch (error) {
    logError("Error deleting review", error);
    return { success: false, error: "Failed to delete review" };
  }
}
