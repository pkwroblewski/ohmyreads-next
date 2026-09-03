import { unstable_cache } from "next/cache";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache/tags";
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

  // The goal row, the finished-this-year count and the current shelf are three
  // independent reads; the count is only *used* when a goal exists.
  const [goalResult, finishedResult, { data: currentlyReadingData }] =
    await Promise.all([
      supabase
        .from("reading_goals")
        .select("target_books, year")
        .eq("user_id", userId)
        .eq("year", currentYear)
        .maybeSingle(),
      supabase
        .from("user_books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "read")
        .gte("finished_at", `${currentYear}-01-01`),
      // Currently reading books (up to 2)
      supabase
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
        .limit(2),
    ]);

  const goalData = goalResult.data;
  const goal: HomeReadingActivity["goal"] = goalData
    ? {
        target: goalData.target_books,
        progress: finishedResult.count || 0,
        year: goalData.year,
      }
    : null;

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

async function fetchCommunityFeed(limit: number): Promise<CommunityFeedItem[]> {
  const supabase = createPublicClient();

  // One query: reviews with their book and author through the two FKs
  // (reviews.book_id -> books.id, reviews.user_id -> profiles.id).
  const { data: reviewsData, error: reviewsError } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      content,
      created_at,
      user_id,
      book:books(id, title, author, slug, cover_url),
      profile:profiles!reviews_user_profile_fkey(id, username, display_name, avatar_url)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (reviewsError) {
    logError("Error fetching community feed", reviewsError);
    return [];
  }

  return (reviewsData ?? []).flatMap((item) => {
    const book = item.book as CommunityFeedItem["book"] | null;
    const profile = item.profile as CommunityFeedItem["user"] | null;
    if (!book || !profile) return [];
    return [
      {
        id: item.id,
        rating: item.rating,
        content: item.content,
        created_at: item.created_at,
        user: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        },
        book,
      },
    ];
  });
}

/**
 * Recent public reviews for the homepage community feed. Identical for every
 * visitor, so it is served from the cache and expired by the review actions.
 */
export const getCommunityFeed = unstable_cache(
  fetchCommunityFeed,
  ["home-community-feed"],
  { revalidate: 600, tags: [CACHE_TAGS.reviews, CACHE_TAGS.books] } // 10 minutes
);

export interface HomeCounts {
  readers: number;
  reviews: number;
}

async function fetchHomeCounts(): Promise<HomeCounts> {
  const supabase = createPublicClient();

  const [readers, reviews] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
  ]);

  return { readers: readers.count ?? 0, reviews: reviews.count ?? 0 };
}

/**
 * The two social-proof numbers in the hero. Two full-table counts on every
 * homepage hit bought nothing: the hero rounds them to the nearest hundred.
 */
export const getHomeCounts = unstable_cache(
  fetchHomeCounts,
  ["home-counts"],
  { revalidate: 600, tags: [CACHE_TAGS.reviews] } // 10 minutes, or until a review is written
);

