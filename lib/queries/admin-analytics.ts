"use server";

import { createClient } from "@/lib/supabase/server";

// Check if current user is admin
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Not authorized");
  }

  return { supabase, user };
}

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
      supabase.from("reviews").select("rating"),
      supabase.from("places").select("id", { count: "exact", head: true }),
      supabase.from("places").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("places").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    // Calculate average rating
    const ratings = avgRating.data || [];
    const avgRatingValue = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
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
    console.error("Error fetching overview stats:", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}

// Get growth data for the last 30 days
export async function adminGetGrowthData(): Promise<{ success: boolean; data?: GrowthData[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [usersData, reviewsData] = await Promise.all([
      supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at"),
      supabase
        .from("reviews")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at"),
    ]);

    // Group by date
    const dateMap = new Map<string, { users: number; reviews: number; books: number }>();

    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dateMap.set(dateStr, { users: 0, reviews: 0, books: 0 });
    }

    // Count users
    (usersData.data || []).forEach((u) => {
      const dateStr = new Date(u.created_at).toISOString().split("T")[0];
      if (dateMap.has(dateStr)) {
        dateMap.get(dateStr)!.users++;
      }
    });

    // Count reviews
    (reviewsData.data || []).forEach((r) => {
      const dateStr = new Date(r.created_at).toISOString().split("T")[0];
      if (dateMap.has(dateStr)) {
        dateMap.get(dateStr)!.reviews++;
      }
    });

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
    console.error("Error fetching growth data:", error);
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
      .order("ratings_count", { ascending: false })
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
    console.error("Error fetching top books:", error);
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
    console.error("Error fetching top users:", error);
    return { success: false, error: "Failed to fetch top users" };
  }
}

// Get genre distribution
export async function adminGetGenreDistribution(): Promise<{ success: boolean; genres?: GenreDistribution[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase
      .from("books")
      .select("genres");

    if (error) throw error;

    // Count genres
    const genreCount = new Map<string, number>();
    (data || []).forEach((book) => {
      (book.genres || []).forEach((genre: string) => {
        genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
      });
    });

    // Convert to array and sort
    const genres: GenreDistribution[] = Array.from(genreCount.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15); // Top 15 genres

    return { success: true, genres };
  } catch (error) {
    console.error("Error fetching genre distribution:", error);
    return { success: false, error: "Failed to fetch genre distribution" };
  }
}

// Get rating distribution
export async function adminGetRatingDistribution(): Promise<{ success: boolean; ratings?: RatingDistribution[]; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase
      .from("reviews")
      .select("rating");

    if (error) throw error;

    // Count ratings
    const ratingCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (data || []).forEach((review) => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingCount[review.rating]++;
      }
    });

    const ratings: RatingDistribution[] = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: ratingCount[rating],
    }));

    return { success: true, ratings };
  } catch (error) {
    console.error("Error fetching rating distribution:", error);
    return { success: false, error: "Failed to fetch rating distribution" };
  }
}
