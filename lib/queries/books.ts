import { createClient, createPublicClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import type { Book, ReviewWithUser, UserBook } from "@/types/database";

/**
 * Get a single book by its slug
 */
export async function getBookBySlug(slug: string): Promise<Book | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching book:", error);
    return null;
  }

  return data;
}

/**
 * Get reviews for a book with structured fields and sorting
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

  // First, fetch reviews
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
      updated_at
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
    console.error("Error fetching reviews:", error);
    return [];
  }

  if (!reviews || reviews.length === 0) {
    return [];
  }

  // Get unique user IDs and fetch their profiles
  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
  }

  // Create a map of user_id to profile
  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  // Merge reviews with profiles
  const reviewsWithProfiles = reviews.map((review) => ({
    ...review,
    profile: profileMap.get(review.user_id) || null,
  }));

  return reviewsWithProfiles as unknown as ReviewWithUser[];
}

/**
 * Get a user's review for a specific book
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
      updated_at
    `)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single();

  if (error) {
    // Not found is expected if user hasn't reviewed
    if (error.code === "PGRST116") return null;
    console.error("Error fetching user review:", error);
    return null;
  }

  // Fetch the user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", userId)
    .single();

  return {
    ...review,
    profile: profile || null,
  } as unknown as ReviewWithUser;
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
    console.error("Error fetching user likes:", error);
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
): Promise<{ books: Book[]; total: number }> {
  const { genre, sort = "relevance", page = 1, limit = 20 } = options;

  const supabase = await createClient();
  const offset = (page - 1) * limit;

  let bookQuery = supabase.from("books").select("*", { count: "exact" });

  // Text search
  if (query) {
    bookQuery = bookQuery.or(`title.ilike.%${query}%,author.ilike.%${query}%`);
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
    console.error("Error searching books:", error);
    return { books: [], total: 0 };
  }

  return { books: data || [], total: count || 0 };
}

/**
 * Get popular books (for homepage) - cached for 1 hour
 */
async function fetchPopularBooks(limit: number): Promise<Book[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching popular books:", error);
    return [];
  }

  return data || [];
}

export const getPopularBooks = unstable_cache(
  fetchPopularBooks,
  ["popular-books"],
  { revalidate: 3600 } // Cache for 1 hour
);

/**
 * Get recently added books - cached for 30 minutes
 */
async function fetchRecentBooks(limit: number): Promise<Book[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent books:", error);
    return [];
  }

  return data || [];
}

export const getRecentBooks = unstable_cache(
  fetchRecentBooks,
  ["recent-books"],
  { revalidate: 1800 } // Cache for 30 minutes
);

/**
 * Get all unique genres from books - cached for 1 hour
 */
async function fetchAllGenres(): Promise<string[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase.from("books").select("genres");

  if (error) {
    console.error("Error fetching genres:", error);
    return [];
  }

  // Flatten and deduplicate genres
  const allGenres = data?.flatMap((b) => b.genres || []) || [];
  return [...new Set(allGenres)].sort();
}

export const getAllGenres = unstable_cache(
  fetchAllGenres,
  ["all-genres"],
  { revalidate: 3600 } // Cache for 1 hour
);

/**
 * Get related books based on overlapping genres
 */
export async function getRelatedBooks(
  genres: string[],
  excludeId: string,
  limit = 6
): Promise<Book[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .overlaps("genres", genres)
    .neq("id", excludeId)
    .order("ratings_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching related books:", error);
    return [];
  }

  return (data || []) as Book[];
}

/**
 * Get all book slugs (useful for static generation)
 */
export async function getAllBookSlugs(): Promise<{ slug: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("books").select("slug");

  if (error) {
    console.error("Error fetching book slugs:", error);
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
      console.error("Error fetching user book status:", error);
    }
    return null;
  }

  return data as UserBook;
}
