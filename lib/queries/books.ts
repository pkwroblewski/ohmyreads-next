import { createClient, createPublicClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { BOOK_CARD_COLUMNS, BOOK_DETAIL_COLUMNS } from "./columns";
import type { Book, BookSummary, ReviewWithUser, UserBook } from "@/types/database";
import { logError } from "@/lib/utils/log";

/**
 * Get a single book by its slug
 */
export async function getBookBySlug(slug: string): Promise<Book | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_DETAIL_COLUMNS)
    .eq("slug", slug)
    .single();

  if (error) {
    logError("Error fetching book", error);
    return null;
  }

  // DB stores cover_source as plain text; narrow to the app union at the boundary
  return data as Book;
}

/**
 * Get reviews for a book with structured fields and sorting
 * Uses FK join to fetch profiles in a single query
 */
export async function getBookReviews(
  bookId: string,
  options: {
    sort?: "most_recent" | "most_helpful" | "highest_rating" | "lowest_rating";
    minRating?: number;
    includeSpoilers?: boolean;
    limit?: number;
  } = {}
): Promise<ReviewWithUser[]> {
  const {
    sort = "most_recent",
    minRating,
    includeSpoilers = true,
    limit = 50,
  } = options;

  const supabase = await createClient();

  // Use FK join to fetch reviews with profiles in a single query
  let query = supabase
    .from("reviews")
    .select(`
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
      profile:profiles!reviews_user_profile_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("book_id", bookId);

  // Apply filters
  if (minRating) {
    query = query.gte("rating", minRating);
  }

  if (!includeSpoilers) {
    query = query.eq("is_spoiler", false);
  }

  // Apply sorting
  switch (sort) {
    case "most_helpful":
      query = query.order("likes_count", { ascending: false });
      break;
    case "highest_rating":
      query = query.order("rating", { ascending: false });
      break;
    case "lowest_rating":
      query = query.order("rating", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  query = query.limit(limit);

  const { data: reviews, error } = await query;

  if (error) {
    logError("Error fetching reviews", error);
    logError("getBookReviews failed for bookId", bookId);
    return [];
  }

  if (!reviews || reviews.length === 0) {
    return [];
  }

  return reviews as unknown as ReviewWithUser[];
}

/**
 * Get a user's review for a specific book
 * Uses FK join to fetch profile in a single query
 */
export async function getUserReviewForBook(
  userId: string,
  bookId: string
): Promise<ReviewWithUser | null> {
  const supabase = await createClient();

  const { data: review, error } = await supabase
    .from("reviews")
    .select(`
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
      profile:profiles!reviews_user_profile_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single();

  if (error) {
    // Not found is expected if user hasn't reviewed
    if (error.code === "PGRST116") return null;
    logError("Error fetching user review", error);
    return null;
  }

  return review as unknown as ReviewWithUser;
}

/**
 * Get which reviews a user has liked
 */
export async function getUserReviewLikes(
  userId: string,
  reviewIds: string[]
): Promise<Set<string>> {
  if (reviewIds.length === 0) return new Set();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("review_likes")
    .select("review_id")
    .eq("user_id", userId)
    .in("review_id", reviewIds);

  if (error) {
    logError("Error fetching user likes", error);
    return new Set();
  }

  return new Set(data?.map((d) => d.review_id) || []);
}

/**
 * Search books with pagination
 */
export async function searchBooks(
  query: string,
  options: {
    genre?: string;
    sort?: "relevance" | "popular" | "rating" | "newest" | "title";
    page?: number;
    limit?: number;
  } = {}
): Promise<{ books: BookSummary[]; total: number }> {
  const { genre, sort = "relevance", page = 1, limit = 20 } = options;

  const supabase = await createClient();
  const offset = (page - 1) * limit;

  let bookQuery = supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS, { count: "exact" });

  // Full-text search using GIN-indexed tsvector column (title + author)
  // Falls back to ilike for very short queries (1-2 chars) that FTS can't handle
  if (query) {
    if (query.trim().length <= 2) {
      // Sanitized: raw input here would let `.` `,` `(` `)` append filters
      const safeQuery = sanitizePostgrestValue(query);
      bookQuery = bookQuery.or(
        `title.ilike.%${safeQuery}%,author.ilike.%${safeQuery}%`
      );
    } else {
      bookQuery = bookQuery.textSearch("fts", query, {
        type: "websearch",
        config: "english",
      });
    }
  }

  // Genre filter
  if (genre) {
    bookQuery = bookQuery.contains("genres", [genre]);
  }

  // Sorting
  switch (sort) {
    case "popular":
      bookQuery = bookQuery.order("ratings_count", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "rating":
      bookQuery = bookQuery.order("average_rating", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "newest":
      bookQuery = bookQuery.order("created_at", { ascending: false });
      break;
    case "title":
      bookQuery = bookQuery.order("title", { ascending: true });
      break;
    default:
      // Relevance - by popularity
      bookQuery = bookQuery.order("ratings_count", {
        ascending: false,
        nullsFirst: false,
      });
  }

  bookQuery = bookQuery.range(offset, offset + limit - 1);

  const { data, error, count } = await bookQuery;

  if (error) {
    logError("Error searching books", error);
    return { books: [], total: 0 };
  }

  return { books: (data as BookSummary[]) || [], total: count || 0 };
}

/**
 * Get popular books (for homepage) - cached for 1 hour
 */
async function fetchPopularBooks(limit: number): Promise<BookSummary[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    logError("Error fetching popular books", error);
    return [];
  }

  return (data as BookSummary[]) || [];
}

export const getPopularBooks = unstable_cache(
  fetchPopularBooks,
  ["popular-books"],
  { revalidate: 3600, tags: [CACHE_TAGS.books] } // 1 hour, or until a book changes
);

/**
 * Get recently added books - cached for 30 minutes
 */
async function fetchRecentBooks(limit: number): Promise<BookSummary[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logError("Error fetching recent books", error);
    return [];
  }

  return (data as BookSummary[]) || [];
}

export const getRecentBooks = unstable_cache(
  fetchRecentBooks,
  ["recent-books"],
  { revalidate: 1800, tags: [CACHE_TAGS.books] } // 30 minutes, or until a book changes
);

/**
 * Get all unique genres from books - cached for 1 hour
 */
async function fetchAllGenres(): Promise<string[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("get_distinct_genres");

  if (error) {
    logError("Error fetching genres", error);
    return [];
  }

  return (data?.map((row: { genre: string }) => row.genre) || []);
}

export const getAllGenres = unstable_cache(
  fetchAllGenres,
  ["all-genres"],
  { revalidate: 3600, tags: [CACHE_TAGS.books, CACHE_TAGS.genres] } // 1 hour, or until a book changes
);

/**
 * Get related books based on overlapping genres
 */
export async function getRelatedBooks(
  genres: string[],
  excludeId: string,
  limit = 6
): Promise<BookSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .overlaps("genres", genres)
    .neq("id", excludeId)
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    logError("Error fetching related books", error);
    return [];
  }

  return (data || []) as BookSummary[];
}

/**
 * Get all book slugs (useful for static generation)
 */
export async function getAllBookSlugs(): Promise<{ slug: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("books").select("slug");

  if (error) {
    logError("Error fetching book slugs", error);
    return [];
  }

  return (data || []) as { slug: string }[];
}

/**
 * Get user's status for a specific book (want_to_read, reading, read)
 */
export async function getUserBookStatus(
  userId: string,
  bookId: string
): Promise<UserBook | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_books")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single();

  if (error) {
    // Not found is expected for books not in user's shelf
    if (error.code !== "PGRST116") {
      logError("Error fetching user book status", error);
    }
    return null;
  }

  return data as UserBook;
}
