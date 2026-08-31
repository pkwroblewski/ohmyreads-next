"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logError } from "@/lib/utils/log";

export interface OverviewStats {
  users: { total: number; thisMonth: number; lastMonth: number };
  books: { total: number; thisMonth: number };
  reviews: { total: number; thisMonth: number; avgRating: number };
  places: { total: number; approved: number; pending: number };
}

export interface GrowthData {
  date: string;
  users: number;
  reviews: number;
  books: number;
}

export interface TopBook {
  id: string;
  title: string;
  author: string;
  slug: string;
  cover_url: string | null;
  reviews_count: number;
  average_rating: number | null;
}

export interface TopUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  reviews_count: number;
  books_count: number;
}

export interface GenreDistribution {
  genre: string;
  count: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

// Get overview statistics
export async function adminGetOverviewStats(): Promise<{ success: boolean; stats?: OverviewStats; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    const [
      totalUsers,
      usersThisMonth,
      usersLastMonth,
      totalBooks,
      booksThisMonth,
      totalReviews,
      reviewsThisMonth,
      avgRating,
      totalPlaces,
      approvedPlaces,
      pendingPlaces,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thisMonthStart),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", lastMonthStart).lt("created_at", lastMonthEnd),
      supabase.from("books").select("id", { count: "exact", head: true }),
      supabase.from("books").select("id", { count: "exact", head: true }).gte("created_at", thisMonthStart),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }).gte("created_at", thisMonthStart),
      supabase.rpc("admin_rating_distribution"),
      supabase.from("places").select("id", { count: "exact", head: true }),
      supabase.from("places").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("places").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    // Derived from the SQL rating distribution (migration 058) rather than
    // pulling every review row, which truncated at 1000 and skewed the mean.
    // Ratings are integers, so the weighted mean is exact.
    const dist = avgRating.data || [];
    const totalRatings = dist.reduce((sum, r) => sum + Number(r.rating_count), 0);
    const avgRatingValue = totalRatings > 0
      ? dist.reduce((sum, r) => sum + r.rating_value * Number(r.rating_count), 0) / totalRatings
      : 0;

    return {
      success: true,
      stats: {
        users: {
          total: totalUsers.count || 0,
          thisMonth: usersThisMonth.count || 0,
          lastMonth: usersLastMonth.count || 0,
        },
        books: {
          total: totalBooks.count || 0,
          thisMonth: booksThisMonth.count || 0,
        },
        reviews: {
          total: totalReviews.count || 0,
          thisMonth: reviewsThisMonth.count || 0,
          avgRating: Math.round(avgRatingValue * 10) / 10,
        },
        places: {
          total: totalPlaces.count || 0,
          approved: approvedPlaces.count || 0,
          pending: pendingPlaces.count || 0,
        },
      },
    };
  } catch (error) {
    logError("Error fetching overview stats", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}

// Get growth data for the last 30 days
export async function adminGetGrowthData(): Promise<{ success: boolean; data?: GrowthData[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Bucketed by UTC date in SQL (migration 058); the previous version pulled
    // every profile and review row in the window and grouped them in JS.
    const { data: daily } = await supabase.rpc("admin_growth_daily", {
      p_since: thirtyDaysAgo.toISOString(),
    });

    // Group by date
    const dateMap = new Map<string, { users: number; reviews: number; books: number }>();

    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dateMap.set(dateStr, { users: 0, reviews: 0, books: 0 });
    }

    for (const row of daily || []) {
      const bucket = dateMap.get(row.day);
      if (bucket) {
        bucket.users = Number(row.user_count);
        bucket.reviews = Number(row.review_count);
      }
    }

    // Convert to array and sort
    const data: GrowthData[] = Array.from(dateMap.entries())
      .map(([date, counts]) => ({
        date,
        users: counts.users,
        reviews: counts.reviews,
        books: counts.books,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data };
  } catch (error) {
    logError("Error fetching growth data", error);
    return { success: false, error: "Failed to fetch growth data" };
  }
}

// Get top reviewed books
export async function adminGetTopBooks(limit = 10): Promise<{ success: boolean; books?: TopBook[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, slug, cover_url, average_rating, ratings_count")
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw error;

    const books: TopBook[] = (data || []).map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      slug: b.slug,
      cover_url: b.cover_url,
      reviews_count: b.ratings_count || 0,
      average_rating: b.average_rating,
    }));

    return { success: true, books };
  } catch (error) {
    logError("Error fetching top books", error);
    return { success: false, error: "Failed to fetch top books" };
  }
}

// Get most active users
export async function adminGetTopUsers(limit = 10): Promise<{ success: boolean; users?: TopUser[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        user_books(count),
        reviews(count)
      `)
      .limit(100); // Get more to sort properly

    if (error) throw error;

    const users: TopUser[] = (data || [])
      .map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        reviews_count: Array.isArray(u.reviews) ? u.reviews[0]?.count || 0 : 0,
        books_count: Array.isArray(u.user_books) ? u.user_books[0]?.count || 0 : 0,
      }))
      .sort((a, b) => (b.reviews_count + b.books_count) - (a.reviews_count + a.books_count))
      .slice(0, limit);

    return { success: true, users };
  } catch (error) {
    logError("Error fetching top users", error);
    return { success: false, error: "Failed to fetch top users" };
  }
}

// Get genre distribution
export async function adminGetGenreDistribution(): Promise<{ success: boolean; genres?: GenreDistribution[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase.rpc("admin_genre_distribution", {
      p_limit: 15,
    });

    if (error) throw error;

    // Aggregated and top-15'd in SQL (migration 058); this used to select the
    // genres array of every book and count them in JS.
    const genres: GenreDistribution[] = (data || []).map((row) => ({
      genre: row.genre,
      count: Number(row.genre_count),
    }));

    return { success: true, genres };
  } catch (error) {
    logError("Error fetching genre distribution", error);
    return { success: false, error: "Failed to fetch genre distribution" };
  }
}

// Get rating distribution
export async function adminGetRatingDistribution(): Promise<{ success: boolean; ratings?: RatingDistribution[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    // Counted in SQL (migration 058); this used to select the rating of every
    // review, truncating at 1000 and under-reporting every bucket.
    const { data, error } = await supabase.rpc("admin_rating_distribution");

    if (error) throw error;

    const ratingCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of data || []) {
      if (row.rating_value >= 1 && row.rating_value <= 5) {
        ratingCount[row.rating_value] = Number(row.rating_count);
      }
    }

    const ratings: RatingDistribution[] = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: ratingCount[rating],
    }));

    return { success: true, ratings };
  } catch (error) {
    logError("Error fetching rating distribution", error);
    return { success: false, error: "Failed to fetch rating distribution" };
  }
}
