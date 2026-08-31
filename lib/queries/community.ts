import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { createPublicClient, createClient } from "@/lib/supabase/server";
import type { ActivityFeedItemWithRelations } from "@/types/database";
import { getFollowingIds } from "./follows";
import { logError } from "@/lib/utils/log";
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

// UUID regex for cursor validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO date regex (simplified: YYYY-MM-DDTHH:MM:SS with optional microseconds and Z)
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Validate and parse a cursor string.
 * Returns null if cursor is invalid (treated as first page).
 */
function parseCursor(cursor: string | null | undefined): { date: string; id: string } | null {
  if (!cursor) return null;
  
  const parts = cursor.split("|");
  if (parts.length !== 2) return null;
  
  const [cursorDate, cursorId] = parts;
  
  // Validate date format
  if (!cursorDate || !ISO_DATE_REGEX.test(cursorDate)) return null;
  
  // Validate UUID format
  if (!cursorId || !UUID_REGEX.test(cursorId)) return null;
  
  return { date: cursorDate, id: cursorId };
}

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

  try {
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
        place_id,
        checkin_id,
        created_at,
        user:profiles!activity_feed_user_id_profiles_fkey(id, username, display_name, avatar_url),
        book:books!activity_feed_book_id_fkey(id, title, author, slug, cover_url),
        review:reviews!activity_feed_review_id_fkey(id, rating, content, likes_count),
        place:places!activity_feed_place_id_fkey(id, name, place_type),
        checkin:place_checkins!activity_feed_checkin_id_fkey(id, note)
      `
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there's more

    // Apply cursor filter if provided and valid
    const parsedCursor = parseCursor(cursor);
    if (parsedCursor) {
      // Get items older than cursor
      query = query.or(
        `created_at.lt.${parsedCursor.date},and(created_at.eq.${parsedCursor.date},id.lt.${parsedCursor.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      logError("Error fetching community feed", error);
      return { items: [], nextCursor: null, hasMore: false };
    }

    if (!data || data.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const items = data
      // Filter requirements:
      // - All types need a user
      // - Reviews need book AND review data (prevents orphaned activity entries)
      // - started_reading needs book
      // - check-ins need place
      .filter((item) => {
        if (!item.user) return false;
        if (item.type === "review") return item.book && item.review;
        if (item.type === "checkin") return item.place;
        return item.book; // started_reading
      })
      .slice(0, limit) // Remove the extra item we fetched
      .map((item) => {
        const userData = item.user as ActivityFeedItemWithRelations["user"];
        const bookData = item.book as ActivityFeedItemWithRelations["book"];
        const reviewData = item.review as ActivityFeedItemWithRelations["review"];
        const placeData = item.place as ActivityFeedItemWithRelations["place"];
        const checkinData = item.checkin as ActivityFeedItemWithRelations["checkin"];

        return {
          id: item.id,
          type: item.type as "review" | "started_reading" | "checkin",
          user_id: item.user_id,
          book_id: item.book_id,
          review_id: item.review_id,
          place_id: item.place_id,
          checkin_id: item.checkin_id,
          created_at: item.created_at,
          user: userData,
          book: bookData || null,
          review: reviewData || null,
          place: placeData || null,
          checkin: checkinData || null,
        };
      });

    // Determine if there are more items
    const hasMore = data.length > limit;

    // Build next cursor from last item
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem
      ? `${lastItem.created_at}|${lastItem.id}`
      : null;

    return { items, nextCursor, hasMore };
  } catch (err) {
    logError("Unexpected error in getCommunityFeedPage", err);
    return { items: [], nextCursor: null, hasMore: false };
  }
}

// ============================================
// FOLLOWING FEED (filtered by who user follows)
// ============================================

/**
 * Fetch a page of activity from users the current user follows.
 * Uses cursor pagination for efficient "Load more".
 */
export async function getFollowingFeedPage(options: {
  userId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<CommunityFeedPage> {
  const { userId, limit = 10, cursor } = options;

  // Get IDs of users the current user follows
  const followingIds = await getFollowingIds(userId);

  // If not following anyone, return empty feed
  if (followingIds.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

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
      place_id,
      checkin_id,
      created_at,
      user:profiles!activity_feed_user_id_profiles_fkey(id, username, display_name, avatar_url),
      book:books!activity_feed_book_id_fkey(id, title, author, slug, cover_url),
      review:reviews!activity_feed_review_id_fkey(id, rating, content, likes_count),
      place:places!activity_feed_place_id_fkey(id, name, place_type),
      checkin:place_checkins!activity_feed_checkin_id_fkey(id, note)
    `
    )
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  // Apply cursor filter if provided and valid
  const parsedCursor = parseCursor(cursor);
  if (parsedCursor) {
    query = query.or(
      `created_at.lt.${parsedCursor.date},and(created_at.eq.${parsedCursor.date},id.lt.${parsedCursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching following feed", error);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const items = (data || [])
    // Filter requirements:
    // - All types need a user
    // - Reviews need book AND review data (prevents orphaned activity entries)
    // - started_reading needs book
    // - check-ins need place
    .filter((item) => {
      if (!item.user) return false;
      if (item.type === "review") return item.book && item.review;
      if (item.type === "checkin") return item.place;
      return item.book; // started_reading
    })
    .slice(0, limit)
    .map((item) => {
      const userData = item.user as ActivityFeedItemWithRelations["user"];
      const bookData = item.book as ActivityFeedItemWithRelations["book"];
      const reviewData = item.review as ActivityFeedItemWithRelations["review"];
      const placeData = item.place as ActivityFeedItemWithRelations["place"];
      const checkinData = item.checkin as ActivityFeedItemWithRelations["checkin"];

      return {
        id: item.id,
        type: item.type as "review" | "started_reading" | "checkin",
        user_id: item.user_id,
        book_id: item.book_id,
        review_id: item.review_id,
        place_id: item.place_id,
        checkin_id: item.checkin_id,
        created_at: item.created_at,
        user: userData,
        book: bookData || null,
        review: reviewData || null,
        place: placeData || null,
        checkin: checkinData || null,
      };
    });

  const hasMore = (data?.length || 0) > limit;
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
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(5);

    // Fetch active readers (users with most reviews) using SQL aggregation
    const { data: topReviewers } = await supabase.rpc("get_top_reviewers", {
      limit_count: 5,
    });

    type TopReviewer = {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      review_count: number;
    };

    const activeReaders: CommunitySidebarData["activeReaders"] = (
      (topReviewers || []) as TopReviewer[]
    ).map((r) => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      review_count: Number(r.review_count),
    }));

    return {
      popularBooks: popularBooks || [],
      activeReaders,
    };
  },
  ["community-sidebar"],
  // Popular books + top reviewers, so both a book change and a new review stale it.
  { revalidate: 120, tags: [CACHE_TAGS.books, CACHE_TAGS.reviews] } // 2 minutes
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
  { revalidate: 30, tags: [CACHE_TAGS.activity] } // 30 seconds
);

// ============================================
// USER LIKED REVIEWS
// ============================================

/**
 * Get the IDs of all reviews a user has liked.
 */
export async function getUserLikedReviewIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_likes")
    .select("review_id")
    .eq("user_id", userId);
  return (data || []).map(r => r.review_id);
}

