import { createClient } from "@/lib/supabase/server";

export interface HomeReadingActivity {
  goal: {
    target: number;
    progress: number;
    year: number;
  } | null;
  currentlyReading: Array<{
    id: string;
    book: {
      id: string;
      title: string;
      author: string;
      slug: string;
      cover_url: string | null;
    };
    started_at: string | null;
    progress?: number;
  }>;
}

export interface CommunityFeedItem {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  user: {
    id: string;
    username: string | null;
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

/**
 * Fetch reading activity for a user (goal + currently reading books)
 */
export async function getHomeReadingActivity(
  userId: string
): Promise<HomeReadingActivity> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  // Fetch reading goal (if table exists)
  let goal: HomeReadingActivity["goal"] = null;
  try {
    const { data: goalData } = await supabase
      .from("reading_goals")
      .select("target_books, year")
      .eq("user_id", userId)
      .eq("year", currentYear)
      .single();

    if (goalData) {
      // Count books finished this year
      const { count } = await supabase
        .from("user_books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "read")
        .gte("finished_at", `${currentYear}-01-01`);

      goal = {
        target: goalData.target_books,
        progress: count || 0,
        year: goalData.year,
      };
    }
  } catch {
    // Table might not exist yet, ignore
  }

  // Fetch currently reading books (up to 2)
  const { data: currentlyReadingData } = await supabase
    .from("user_books")
    .select(
      `
      id,
      started_at,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .eq("user_id", userId)
    .eq("status", "reading")
    .order("updated_at", { ascending: false })
    .limit(2);

  const currentlyReading =
    currentlyReadingData
      ?.filter((ub) => ub.book)
      .map((ub) => {
        // Supabase returns single relation as object, not array
        const bookData = ub.book as unknown as {
          id: string;
          title: string;
          author: string;
          slug: string;
          cover_url: string | null;
        };
        return {
          id: ub.id,
          book: bookData,
          started_at: ub.started_at,
        };
      }) || [];

  return { goal, currentlyReading };
}

/**
 * Fetch recent public reviews for the community feed
 */
export async function getCommunityFeed(
  limit: number = 5
): Promise<CommunityFeedItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      content,
      created_at,
      user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      book:books!reviews_book_id_fkey(id, title, author, slug, cover_url)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching community feed:", error);
    return [];
  }

  // Filter out items with missing user or book
  return (data || [])
    .filter((item) => item.user && item.book)
    .map((item) => {
      const userData = item.user as unknown as CommunityFeedItem["user"];
      const bookData = item.book as unknown as CommunityFeedItem["book"];
      return {
        id: item.id,
        rating: item.rating,
        content: item.content,
        created_at: item.created_at,
        user: userData,
        book: bookData,
      };
    });
}

