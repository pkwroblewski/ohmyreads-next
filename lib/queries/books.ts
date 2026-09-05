import { cache } from "react";
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
async function fetchBookBySlug(slug: string): Promise<Book | null> {
  // Catalog rows are public, so the cookie-less client is enough and the
  // result can be shared between every visitor.
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_DETAIL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logError("Error fetching book", error);
    return null;
  }

  // DB stores cover_source as plain text; narrow to the app union at the boundary
  return (data as Book | null) ?? null;
}

const getCachedBookBySlug = unstable_cache(
  fetchBookBySlug,
  ["book-by-slug"],
  { revalidate: 3600, tags: [CACHE_TAGS.books] } // 1 hour, or until a book or review changes
);

/**
 * Get a book by slug. Cached for an hour under the `books` tag, and memoised
 * per request so `generateMetadata` and the page share one read.
 */
export const getBookBySlug = cache(
  (slug: string): Promise<Book | null> => getCachedBookBySlug(slug)
);

/**
 * Get reviews for a book with structured fields and sorting
 * Uses FK join to fetch profiles in a single query
 */
export const REVIEWS_PAGE_SIZE = 10;

export interface BookReviewsPage {
  reviews: ReviewWithUser[];
  /** Total reviews on the book, so callers can render page links. */
  total: number;
}

async function fetchBookReviewsPage(
  bookId: string,
  page: number
): Promise<BookReviewsPage> {
  const supabase = createPublicClient();
  const offset = (page - 1) * REVIEWS_PAGE_SIZE;

  // Use FK join to fetch reviews with profiles in a single query; the exact
  // count rides along on the same request instead of a second HEAD call.
  const { data: reviews, error, count } = await supabase
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
      profile:profiles!reviews_user_profile_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `,
      { count: "exact" }
    )
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })
    .range(offset, offset + REVIEWS_PAGE_SIZE - 1)
    // The declared type predates the select: profile is a 4-column subset
    .overrideTypes<ReviewWithUser[], { merge: false }>();

  if (error) {
    logError("Error fetching reviews", error);
    logError("getBookReviews failed for bookId", bookId);
    return { reviews: [], total: 0 };
  }

  return {
    reviews: reviews ?? [],
    total: count ?? 0,
  };
}

const getCachedBookReviewsPage = unstable_cache(
  fetchBookReviewsPage,
  ["book-reviews-page"],
  { revalidate: 3600, tags: [CACHE_TAGS.reviews] } // 1 hour, or until a review is written, edited, deleted or liked
);

/**
 * One page of a book's reviews, newest first. Anonymous view: the review
 * actions expire the `reviews` tag, so a fresh review shows up on the next
 * request rather than after the hour.
 */
export const getBookReviews = cache(
  (bookId: string, page = 1): Promise<BookReviewsPage> =>
    getCachedBookReviewsPage(bookId, Math.max(1, Math.floor(page)))
);

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

/** How many books the catalog holds, for the Browse header's default load. */
async function fetchBookCount(): Promise<number> {
  const supabase = createPublicClient();

  const { count, error } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true });

  if (error) {
    logError("Error counting books", error);
    return 0;
  }

  return count ?? 0;
}

export const getBookCount = unstable_cache(
  fetchBookCount,
  ["book-count"],
  { revalidate: 3600, tags: [CACHE_TAGS.books] } // 1 hour, or until a book changes
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
async function fetchRelatedBooks(
  genres: string[],
  excludeId: string,
  limit: number
): Promise<BookSummary[]> {
  const supabase = createPublicClient();

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

/** Books sharing a genre, by Open Library popularity. Cached under `books`. */
export const getRelatedBooks = unstable_cache(
  fetchRelatedBooks,
  ["related-books"],
  { revalidate: 3600, tags: [CACHE_TAGS.books] }
);

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
