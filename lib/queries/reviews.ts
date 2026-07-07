import { createClient } from "@/lib/supabase/server";
import type { ReviewWithUser } from "@/types/database";

export interface ReviewWithUserAndLikeStatus extends ReviewWithUser {
  hasLiked?: boolean;
}

/**
 * Get reviews for a book with pagination, sorting, and like status
 */
export async function getBookReviewsWithDetails(
  bookId: string,
  options?: {
    page?: number;
    limit?: number;
    sortBy?: "recent" | "helpful" | "rating_high" | "rating_low";
    userId?: string; // to check if user has liked
  }
): Promise<{ reviews: ReviewWithUserAndLikeStatus[]; total: number }> {
  try {
    const supabase = await createClient();
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const offset = (page - 1) * limit;
    const sortBy = options?.sortBy || "recent";

    // Build query
    let query = supabase
      .from("reviews")
      .select(
        `
        *,
        profile:profiles(id, username, display_name, avatar_url, is_admin)
      `,
        { count: "exact" }
      )
      .eq("book_id", bookId);

    // Apply sorting
    switch (sortBy) {
      case "helpful":
        query = query.order("likes_count", { ascending: false });
        break;
      case "rating_high":
        query = query.order("rating", { ascending: false });
        break;
      case "rating_low":
        query = query.order("rating", { ascending: true });
        break;
      case "recent":
      default:
        query = query.order("created_at", { ascending: false });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching reviews:", error);
      return { reviews: [], total: 0 };
    }

    let reviews = (data || []) as ReviewWithUserAndLikeStatus[];

    // If userId provided, check which reviews the user has liked
    if (options?.userId && reviews.length > 0) {
      const reviewIds = reviews.map((r) => r.id);
      const { data: likes } = await supabase
        .from("review_likes")
        .select("review_id")
        .eq("user_id", options.userId)
        .in("review_id", reviewIds);

      const likedIds = new Set((likes || []).map((l) => l.review_id));
      reviews = reviews.map((r) => ({
        ...r,
        hasLiked: likedIds.has(r.id),
      }));
    }

    return { reviews, total: count || 0 };
  } catch (error) {
    console.error("Error in getBookReviewsWithDetails:", error);
    return { reviews: [], total: 0 };
  }
}

/**
 * Get a single review by ID with full details
 */
export async function getReviewById(
  reviewId: string,
  userId?: string
): Promise<ReviewWithUserAndLikeStatus | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profile:profiles(id, username, display_name, avatar_url, is_admin)
      `
      )
      .eq("id", reviewId)
      .single();

    if (error) {
      console.error("Error fetching review:", error);
      return null;
    }

    let review = data as ReviewWithUserAndLikeStatus;

    // Check if user has liked this review
    if (userId) {
      const { data: like } = await supabase
        .from("review_likes")
        .select("id")
        .eq("review_id", reviewId)
        .eq("user_id", userId)
        .single();

      review = { ...review, hasLiked: !!like };
    }

    return review;
  } catch (error) {
    console.error("Error in getReviewById:", error);
    return null;
  }
}

/**
 * Get recent reviews across all books
 */
export async function getRecentReviews(
  limit = 10
): Promise<
  (ReviewWithUser & { book: { id: string; title: string; slug: string; cover_url: string | null } | null })[]
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profile:profiles(id, username, display_name, avatar_url),
        book:books(id, title, slug, cover_url)
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent reviews:", error);
      return [];
    }

    // Cast: profile is a 4-field subset of Profile (declared type predates the select)
    return (data as unknown as (ReviewWithUser & { book: { id: string; title: string; slug: string; cover_url: string | null } | null })[]) || [];
  } catch (error) {
    console.error("Error in getRecentReviews:", error);
    return [];
  }
}

/**
 * Get most helpful reviews across all books
 */
export async function getMostHelpfulReviews(
  limit = 10
): Promise<
  (ReviewWithUser & { book: { id: string; title: string; slug: string; cover_url: string | null } | null })[]
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profile:profiles(id, username, display_name, avatar_url),
        book:books(id, title, slug, cover_url)
      `
      )
      .gt("likes_count", 0)
      .order("likes_count", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching helpful reviews:", error);
      return [];
    }

    // Cast: profile is a 4-field subset of Profile (declared type predates the select)
    return (data as unknown as (ReviewWithUser & { book: { id: string; title: string; slug: string; cover_url: string | null } | null })[]) || [];
  } catch (error) {
    console.error("Error in getMostHelpfulReviews:", error);
    return [];
  }
}

/**
 * Check if user has already reviewed a book
 */
export async function hasUserReviewedBook(
  userId: string,
  bookId: string
): Promise<{ hasReviewed: boolean; review: ReviewWithUser | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select(`
        *,
        profile:profiles!user_id(id, username, display_name, avatar_url)
      `)
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking review:", error);
    }

    if (!data) {
      return { hasReviewed: false, review: null };
    }

    // Transform profile (handle array case from Supabase)
    const reviewWithProfile = {
      ...data,
      profile: Array.isArray(data.profile) ? data.profile[0] : data.profile,
    };

    return {
      hasReviewed: true,
      review: reviewWithProfile as unknown as ReviewWithUser,
    };
  } catch (error) {
    console.error("Error in hasUserReviewedBook:", error);
    return { hasReviewed: false, review: null };
  }
}

/**
 * Get review statistics for a book
 */
export async function getBookReviewStats(bookId: string): Promise<{
  totalReviews: number;
  averageRating: number | null;
  ratingDistribution: Record<number, number>;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select("rating")
      .eq("book_id", bookId);

    if (error) {
      console.error("Error fetching review stats:", error);
      return { totalReviews: 0, averageRating: null, ratingDistribution: {} };
    }

    const reviews = data || [];
    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return { totalReviews: 0, averageRating: null, ratingDistribution: {} };
    }

    // Calculate average (exclude null ratings)
    const ratedReviews = reviews.filter((r) => r.rating != null);
    const sum = ratedReviews.reduce((acc, r) => acc + r.rating!, 0);
    const averageRating = ratedReviews.length > 0
      ? Math.round((sum / ratedReviews.length) * 10) / 10
      : null;

    // Calculate distribution (only count non-null ratings)
    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const review of ratedReviews) {
      ratingDistribution[review.rating!] = (ratingDistribution[review.rating!] || 0) + 1;
    }

    return { totalReviews, averageRating, ratingDistribution };
  } catch (error) {
    console.error("Error in getBookReviewStats:", error);
    return { totalReviews: 0, averageRating: null, ratingDistribution: {} };
  }
}

