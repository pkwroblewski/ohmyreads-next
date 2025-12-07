"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createReview({
  bookId,
  content,
  rating,
  isSpoiler = false,
}: {
  bookId: string;
  content: string;
  rating: number;
  isSpoiler?: boolean;
}) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate input
    if (content.length < 10) {
      return { error: "Review must be at least 10 characters" };
    }
    if (content.length > 5000) {
      return { error: "Review must be less than 5000 characters" };
    }
    if (rating < 1 || rating > 5) {
      return { error: "Rating must be between 1 and 5" };
    }

    // Check if user already reviewed this book
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .single();

    if (existingReview) {
      return { error: "You have already reviewed this book" };
    }

    // Insert review
    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        book_id: bookId,
        content,
        rating,
        is_spoiler: isSpoiler,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating review:", error);
      return { error: error.message };
    }

    // Update book's average rating and count
    await updateBookRating(bookId);

    // Revalidate pages
    revalidatePath(`/books/[slug]`, "page");
    revalidatePath("/dashboard");

    return { success: true, reviewId: review.id };
  } catch (error) {
    console.error("Error in createReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function updateReview(
  reviewId: string,
  {
    content,
    rating,
    isSpoiler,
  }: {
    content?: string;
    rating?: number;
    isSpoiler?: boolean;
  }
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

    // Verify ownership
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id, book_id")
      .eq("id", reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return { error: "Not authorized to edit this review" };
    }

    // Validate if provided
    if (content !== undefined && content.length < 10) {
      return { error: "Review must be at least 10 characters" };
    }
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return { error: "Rating must be between 1 and 5" };
    }

    // Update review
    const updateData: Record<string, string | number | boolean> = {
      updated_at: new Date().toISOString(),
    };
    if (content !== undefined) updateData.content = content;
    if (rating !== undefined) updateData.rating = rating;
    if (isSpoiler !== undefined) updateData.is_spoiler = isSpoiler;

    const { error } = await supabase
      .from("reviews")
      .update(updateData)
      .eq("id", reviewId);

    if (error) {
      return { error: error.message };
    }

    // Update book rating if rating changed
    if (rating !== undefined) {
      await updateBookRating(review.book_id);
    }

    revalidatePath(`/books/[slug]`, "page");

    return { success: true };
  } catch (error) {
    console.error("Error in updateReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function deleteReview(reviewId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Get review to verify ownership and get book_id
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id, book_id")
      .eq("id", reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return { error: "Not authorized to delete this review" };
    }

    // Delete review
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      return { error: error.message };
    }

    // Update book rating
    await updateBookRating(review.book_id);

    revalidatePath(`/books/[slug]`, "page");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteReview:", error);
    return { error: "An unexpected error occurred" };
  }
}

// Helper function to recalculate book's average rating
async function updateBookRating(bookId: string) {
  const supabase = await createClient();

  // Get all ratings for this book
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("book_id", bookId);

  if (!reviews || reviews.length === 0) {
    // No reviews, reset rating
    await supabase
      .from("books")
      .update({ average_rating: null, ratings_count: 0 })
      .eq("id", bookId);
    return;
  }

  // Calculate average
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = Math.round((sum / reviews.length) * 10) / 10;

  // Update book
  await supabase
    .from("books")
    .update({
      average_rating: average,
      ratings_count: reviews.length,
    })
    .eq("id", bookId);
}

