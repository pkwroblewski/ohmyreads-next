// Admin review reads (filtered list + stats).
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { requireAdmin } from "@/lib/auth/require-admin";
import { logError } from "@/lib/utils/log";

// Review filters
export interface ReviewFilters {
  search?: string;
  rating?: number;
  isSpoiler?: boolean;
  sortBy?: "created_at" | "rating" | "likes_count";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// Review with user and book info
export interface ReviewWithDetails {
  id: string;
  content: string;
  summary: string | null;
  rating: number | null;
  likes_count: number;
  is_spoiler: boolean;
  vibe_tags: string[];
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  };
}

// Get reviews with filters
export async function adminGetReviews(filters: ReviewFilters = {}) {
  try {
    const { supabase } = await requireAdmin();

    const {
      search = "",
      rating,
      isSpoiler,
      sortBy = "created_at",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = filters;

    let query = supabase
      .from("reviews")
      .select(`
        id,
        content,
        summary,
        rating,
        likes_count,
        is_spoiler,
        vibe_tags,
        created_at,
        profiles!reviews_user_profile_fkey(id, username, display_name, avatar_url),
        books!reviews_book_id_fkey(id, title, author, slug, cover_url)
      `, { count: "exact" });

    // Rating filter
    if (rating !== undefined) {
      query = query.eq("rating", rating);
    }

    // Spoiler filter
    if (isSpoiler !== undefined) {
      query = query.eq("is_spoiler", isSpoiler);
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data
    const reviews: ReviewWithDetails[] = (data || []).map((review) => {
      const profile = Array.isArray(review.profiles)
        ? review.profiles[0]
        : review.profiles;
      const book = Array.isArray(review.books)
        ? review.books[0]
        : review.books;

      return {
        id: review.id,
        content: review.content,
        summary: review.summary,
        rating: review.rating,
        likes_count: review.likes_count ?? 0,
        is_spoiler: review.is_spoiler ?? false,
        vibe_tags: review.vibe_tags || [],
        created_at: review.created_at,
        user: profile || { id: "", username: "Unknown", display_name: null, avatar_url: null },
        book: book || { id: "", title: "Unknown", author: "Unknown", slug: "", cover_url: null },
      };
    });

    // Filter by search (post-query since we need to search in related tables)
    const filteredReviews = search
      ? reviews.filter((r) =>
          r.content.toLowerCase().includes(search.toLowerCase()) ||
          r.book.title.toLowerCase().includes(search.toLowerCase()) ||
          r.user.username.toLowerCase().includes(search.toLowerCase())
        )
      : reviews;

    return {
      success: true,
      reviews: filteredReviews,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logError("Error fetching reviews", error);
    return { success: false, error: "Failed to fetch reviews" };
  }
}

// Get review stats
export async function adminGetReviewStats() {
  try {
    const { supabase } = await requireAdmin();

    const [totalReviews, spoilerReviews, todayReviews] = await Promise.all([
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("is_spoiler", true),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date().toISOString().split("T")[0]),
    ]);

    // Get rating distribution
    const { data: ratingData } = await supabase
      .from("reviews")
      .select("rating");

    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (ratingData || []).forEach((r) => {
      if (r.rating != null && r.rating >= 1 && r.rating <= 5) {
        ratingDist[r.rating]++;
      }
    });

    return {
      success: true,
      stats: {
        total: totalReviews.count || 0,
        spoilers: spoilerReviews.count || 0,
        today: todayReviews.count || 0,
        ratingDistribution: ratingDist,
      },
    };
  } catch (error) {
    logError("Error fetching review stats", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}
