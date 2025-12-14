import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { ActivityFeedItemWithRelations } from "@/types/database";

// ============================================
// TYPES
// ============================================

export interface CommunityFeedPage {
  items: ActivityFeedItemWithRelations[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CommunitySidebarData {
  popularBooks: Array<{
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
    average_rating: number | null;
  }>;
  activeReaders: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    review_count: number;
  }>;
}

// ============================================
// FEED QUERY (cursor pagination)
// ============================================

/**
 * Fetch a page of the community activity feed.
 * Uses cursor pagination for efficient "Load more".
 * Cursor format: "created_at|id"
 */
export async function getCommunityFeedPage(options: {
  limit?: number;
  cursor?: string | null;
}): Promise<CommunityFeedPage> {
  const { limit = 10, cursor } = options;
  const supabase = createPublicClient();

  let query = supabase
    .from("activity_feed")
    .select(
      `
      id,
      type,
      user_id,
      book_id,
      review_id,
      created_at,
      user:profiles!activity_feed_user_id_fkey(id, username, display_name, avatar_url),
      book:books!activity_feed_book_id_fkey(id, title, author, slug, cover_url),
      review:reviews!activity_feed_review_id_fkey(id, rating, content, likes_count)
    `
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there's more

  // Apply cursor filter if provided
  if (cursor) {
    const [cursorDate, cursorId] = cursor.split("|");
    if (cursorDate && cursorId) {
      // Get items older than cursor
      query = query.or(
        `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching community feed:", error);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const items = (data || [])
    .filter((item) => item.user && item.book)
    .slice(0, limit) // Remove the extra item we fetched
    .map((item) => {
      const userData = item.user as unknown as ActivityFeedItemWithRelations["user"];
      const bookData = item.book as unknown as ActivityFeedItemWithRelations["book"];
      const reviewData = item.review as unknown as ActivityFeedItemWithRelations["review"];

      return {
        id: item.id,
        type: item.type as "review" | "started_reading",
        user_id: item.user_id,
        book_id: item.book_id,
        review_id: item.review_id,
        created_at: item.created_at,
        user: userData,
        book: bookData,
        review: reviewData || null,
      };
    });

  // Determine if there are more items
  const hasMore = (data?.length || 0) > limit;

  // Build next cursor from last item
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem 
    ? `${lastItem.created_at}|${lastItem.id}` 
    : null;

  return { items, nextCursor, hasMore };
}

// ============================================
// CACHED SIDEBAR DATA
// ============================================

/**
 * Fetch sidebar data for community page.
 * Cached for 2 minutes.
 */
export const getCommunitySidebar = unstable_cache(
  async (): Promise<CommunitySidebarData> => {
    const supabase = createPublicClient();

    // Fetch popular books (by ratings_count, last 7 days of activity not tracked yet, so use all-time)
    const { data: popularBooks } = await supabase
      .from("books")
      .select("id, title, author, slug, cover_url, average_rating")
      .order("ratings_count", { ascending: false })
      .limit(5);

    // Fetch active readers (users with most reviews)
    // We'll count reviews per user from reviews table
    const { data: reviewCounts } = await supabase
      .from("reviews")
      .select("user_id")
      .order("created_at", { ascending: false })
      .limit(100); // Sample recent reviews

    // Count reviews per user
    const userReviewCounts = new Map<string, number>();
    (reviewCounts || []).forEach((r) => {
      userReviewCounts.set(r.user_id, (userReviewCounts.get(r.user_id) || 0) + 1);
    });

    // Get top 5 users by review count
    const topUserIds = Array.from(userReviewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => userId);

    // Fetch profiles for top users
    let activeReaders: CommunitySidebarData["activeReaders"] = [];
    if (topUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", topUserIds);

      activeReaders = (profiles || []).map((p) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        review_count: userReviewCounts.get(p.id) || 0,
      }));

      // Sort by review count
      activeReaders.sort((a, b) => b.review_count - a.review_count);
    }

    return {
      popularBooks: popularBooks || [],
      activeReaders,
    };
  },
  ["community-sidebar"],
  { revalidate: 120 } // 2 minutes
);

// ============================================
// INITIAL FEED (cached for first page)
// ============================================

/**
 * Fetch initial feed page (cached for fast first load).
 * Cached for 30 seconds.
 */
export const getInitialCommunityFeed = unstable_cache(
  async (): Promise<CommunityFeedPage> => {
    return getCommunityFeedPage({ limit: 10 });
  },
  ["community-feed-initial"],
  { revalidate: 30 } // 30 seconds
);

