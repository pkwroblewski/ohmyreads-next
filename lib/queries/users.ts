import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { BOOK_CARD_COLUMNS, PROFILE_PUBLIC_COLUMNS } from "./columns";
import type { Profile, ReviewWithUser, UserBookWithBook } from "@/types/database";
import { logError } from "@/lib/utils/log";

/**
 * Get profile by username
 */
export const getProfileByUsername = cache(async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  // Memoised per request: `generateMetadata` and the page both resolve the
  // same username. Not cached across requests — profile edits carry no tag.
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("username", username)
    // A disabled account's public page 404s (Task 7); its content is hidden
    // by RLS (066), so the profile would otherwise be an empty shell.
    .is("disabled_at", null)
    .single();

  if (error) {
    logError("Error fetching profile", error);
    return null;
  }

  // Public projection only: the private columns are absent, not null (065).
  return data as Profile;
});

/**
 * Get profile by user ID
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("id", userId)
    .single();

  if (error) {
    logError("Error fetching profile", error);
    return null;
  }

  // Public projection only: the private columns are absent, not null (065).
  return data as Profile;
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string) {
  const supabase = await createClient();

  // Fetch counts in parallel
  const [shelf, reviewsResult] = await Promise.all([
    getShelfCounts(userId),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    booksRead: shelf.read,
    booksReading: shelf.reading,
    booksWantToRead: shelf.want_to_read,
    totalBooks: shelf.all,
    reviewsCount: reviewsResult.count || 0,
  };
}

export interface ShelfCounts {
  all: number;
  reading: number;
  read: number;
  want_to_read: number;
}

const SHELF_STATUSES = ["reading", "read", "want_to_read"] as const;

/**
 * Per-status shelf sizes as three HEAD counts in parallel. `all` is their
 * sum: `user_books.status` is CHECK-constrained to exactly these values.
 * Counting in SQL is what keeps a large import honest — a `select("status")`
 * stops at PostgREST's 1,000-row cap and under-reports from there.
 */
export async function getShelfCounts(userId: string): Promise<ShelfCounts> {
  const supabase = await createClient();

  const results = await Promise.all(
    SHELF_STATUSES.map((status) =>
      supabase
        .from("user_books")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", status)
    )
  );

  const [reading, read, want_to_read] = results.map((r) => {
    if (r.error) logError("Error counting shelf", r.error);
    return r.count ?? 0;
  });

  return { all: reading + read + want_to_read, reading, read, want_to_read };
}

/** Rows per page on /my-shelf and its "Load more" route. */
export const SHELF_PAGE_SIZE = 48;

/**
 * Get user's books with book details
 */
export async function getUserBooks(
  userId: string,
  options: {
    status?: "reading" | "read" | "want_to_read";
    /** Restrict to one custom shelf (joins shelf_books instead of a second query). */
    shelfId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ userBooks: UserBookWithBook[]; total: number }> {
  const { status, shelfId, limit = 20, offset = 0 } = options;

  const supabase = await createClient();

  // With a shelf id the inner join both filters the rows and keeps the count
  // exact for that shelf; without one the join is left out entirely.
  const columns = shelfId
    ? `*, book:books(${BOOK_CARD_COLUMNS}), shelf_books!inner(shelf_id)`
    : `*, book:books(${BOOK_CARD_COLUMNS})`;

  let query = supabase
    .from("user_books")
    .select(columns, { count: "exact" })
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (shelfId) {
    query = query.eq("shelf_books.shelf_id", shelfId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logError("Error fetching user books", error);
    return { userBooks: [], total: 0 };
  }

  return { userBooks: (data || []) as unknown as UserBookWithBook[], total: count || 0 };
}

// Type for review with book info
type ReviewWithBook = ReviewWithUser & {
  book?: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    author: string;
  };
};

/**
 * Get user's reviews with pagination
 */
export async function getUserReviewsPaginated(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    minRating?: number;
  } = {}
): Promise<{ reviews: ReviewWithBook[]; total: number }> {
  const { page = 1, limit = 10, minRating } = options;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select(
      `
      id,
      user_id,
      book_id,
      content,
      summary,
      liked,
      disliked,
      takeaway,
      rating,
      likes_count,
      is_spoiler,
      created_at,
      updated_at,
      book:books(id, title, slug, cover_url, author)
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (minRating) {
    query = query.gte("rating", minRating);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logError("Error fetching user reviews", error);
    return { reviews: [], total: 0 };
  }

  return { reviews: (data as unknown as ReviewWithBook[]) || [], total: count || 0 };
}

/**
 * Get user's reviews (simple, for profile page)
 */
async function fetchUserReviews(
  userId: string,
  limit: number
): Promise<ReviewWithBook[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id,
      user_id,
      book_id,
      content,
      summary,
      liked,
      disliked,
      takeaway,
      rating,
      likes_count,
      is_spoiler,
      created_at,
      updated_at,
      book:books(id, title, slug, cover_url, author)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logError("Error fetching user reviews", error);
    return [];
  }

  return (data as unknown as ReviewWithBook[]) || [];
}

/**
 * A reader's latest reviews with their books. Public data, so it is cached
 * under `reviews` (expired by every review write) and `books`.
 */
export const getUserReviews = unstable_cache(
  fetchUserReviews,
  ["user-reviews"],
  { revalidate: 3600, tags: [CACHE_TAGS.reviews, CACHE_TAGS.books] }
);

/**
 * Get user's social links
 */
export async function getSocialLinks(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("social_links")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (error) {
    logError("Error fetching social links", error);
    return [];
  }

  return data || [];
}

