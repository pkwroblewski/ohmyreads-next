import { createClient } from "@/lib/supabase/server";
import type { Book } from "@/types/database";

/**
 * Get curated books for a user based on their reading history
 * Falls back to highly-rated books if no user or no history
 */
export async function getCuratedBooks(
  userId?: string,
  limit = 10
): Promise<Book[]> {
  try {
    const supabase = await createClient();

    if (userId) {
      // Get user's read books to find preferred genres
      const { data: userBooks } = await supabase
        .from("user_books")
        .select("book:books(genres)")
        .eq("user_id", userId)
        .eq("status", "read")
        .limit(20);

      // Extract genres from user's books
      const genres =
        userBooks?.flatMap((ub) => {
          const book = ub.book as unknown as { genres: string[] } | null;
          return book?.genres || [];
        }) || [];
      const uniqueGenres = [...new Set(genres)].slice(0, 3);

      if (uniqueGenres.length > 0) {
        // Get books matching user's preferred genres
        const { data } = await supabase
          .from("books")
          .select("*")
          .overlaps("genres", uniqueGenres)
          .order("average_rating", { ascending: false, nullsFirst: false })
          .limit(limit);

        return (data as Book[]) || [];
      }
    }

    // Fallback: highly rated books
    const { data } = await supabase
      .from("books")
      .select("*")
      .not("average_rating", "is", null)
      .order("average_rating", { ascending: false })
      .limit(limit);

    return (data as Book[]) || [];
  } catch (error) {
    console.error("Error in getCuratedBooks:", error);
    return [];
  }
}

/**
 * Get trending books on the platform based on recent shelf activity
 */
export async function getTrendingOnPlatform(limit = 10): Promise<Book[]> {
  try {
    const supabase = await createClient();

    // Get books with most shelf additions in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentActivity } = await supabase
      .from("user_books")
      .select("book_id")
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (recentActivity && recentActivity.length > 0) {
      // Count occurrences of each book
      const bookCounts = recentActivity.reduce(
        (acc, { book_id }) => {
          acc[book_id] = (acc[book_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Sort by count and get top book IDs
      const topBookIds = Object.entries(bookCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      if (topBookIds.length > 0) {
        const { data } = await supabase
          .from("books")
          .select("*")
          .in("id", topBookIds);

        // Sort by the original trending order
        const sorted = topBookIds
          .map((id) => data?.find((b) => b.id === id))
          .filter(Boolean) as Book[];

        return sorted;
      }
    }

    // Fallback: most reviewed books
    const { data } = await supabase
      .from("books")
      .select("*")
      .order("ratings_count", { ascending: false })
      .limit(limit);

    return (data as Book[]) || [];
  } catch (error) {
    console.error("Error in getTrendingOnPlatform:", error);
    return [];
  }
}

/**
 * Get globally trending books by ratings count
 */
export async function getTrendingGlobally(limit = 10): Promise<Book[]> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("books")
      .select("*")
      .order("ratings_count", { ascending: false })
      .order("average_rating", { ascending: false, nullsFirst: false })
      .limit(limit);

    return (data as Book[]) || [];
  } catch (error) {
    console.error("Error in getTrendingGlobally:", error);
    return [];
  }
}

