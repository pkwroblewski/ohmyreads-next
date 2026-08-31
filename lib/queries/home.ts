import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

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
  rating: number | null;
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
    currentlyReadingData?.flatMap((ub) =>
      ub.book
        ? [
            {
              id: ub.id,
              book: ub.book,
              started_at: ub.started_at,
            },
          ]
        : []
    ) || [];

  return { goal, currentlyReading };
}

/**
 * Fetch recent public reviews for the community feed
 */
export async function getCommunityFeed(
  limit: number = 5
): Promise<CommunityFeedItem[]> {
  const supabase = await createClient();

  // First, fetch reviews with books (this FK exists: reviews.book_id -> books.id)
  const { data: reviewsData, error: reviewsError } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      content,
      created_at,
      user_id,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (reviewsError) {
    logError("Error fetching community feed", reviewsError);
    return [];
  }

  if (!reviewsData || reviewsData.length === 0) {
    return [];
  }

  // Get unique user IDs from reviews
  const userIds = [...new Set(reviewsData.map((r) => r.user_id))];

  // Fetch profiles for these users (profiles.id = auth.users.id = reviews.user_id)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  // Create a map for quick lookup
  const profilesMap = new Map(
    (profilesData || []).map((p) => [p.id, p])
  );

  // Combine reviews with profiles
  return reviewsData
    .filter((item) => item.book && profilesMap.has(item.user_id))
    .map((item) => {
      const bookData = item.book as CommunityFeedItem["book"];
      const userData = profilesMap.get(item.user_id)!;
      return {
        id: item.id,
        rating: item.rating,
        content: item.content,
        created_at: item.created_at,
        user: {
          id: userData.id,
          username: userData.username,
          display_name: userData.display_name,
          avatar_url: userData.avatar_url,
        },
        book: bookData,
      };
    });
}

