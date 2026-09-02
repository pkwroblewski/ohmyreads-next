import { createClient } from "@/lib/supabase/server";
import { BOOK_CARD_COLUMNS, PROFILE_PUBLIC_COLUMNS } from "./columns";
import type { Profile, ReviewWithUser, UserBookWithBook } from "@/types/database";
import { logError } from "@/lib/utils/log";

/**
 * Get profile by username
 */
export async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("username", username)
    .single();

  if (error) {
    logError("Error fetching profile", error);
    return null;
  }

  // Public projection only: the private columns are absent, not null (065).
  return data as Profile;
}

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
  const [booksResult, reviewsResult] = await Promise.all([
    supabase.from("user_books").select("status").eq("user_id", userId),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const books = booksResult.data || [];

  return {
    booksRead: books.filter((b) => b.status === "read").length,
    booksReading: books.filter((b) => b.status === "reading").length,
    booksWantToRead: books.filter((b) => b.status === "want_to_read").length,
    totalBooks: books.length,
    reviewsCount: reviewsResult.count || 0,
  };
}

/**
 * Get user's books with book details
 */
export async function getUserBooks(
  userId: string,
  options: {
    status?: "reading" | "read" | "want_to_read";
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ userBooks: UserBookWithBook[]; total: number }> {
  const { status, limit = 20, offset = 0 } = options;

  const supabase = await createClient();

  let query = supabase
    .from("user_books")
    .select(
      `
      *,
      book:books(${BOOK_CARD_COLUMNS})
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logError("Error fetching user books", error);
    return { userBooks: [], total: 0 };
  }

  return { userBooks: (data || []) as UserBookWithBook[], total: count || 0 };
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
export async function getUserReviews(
  userId: string,
  limit = 5
): Promise<ReviewWithBook[]> {
  const supabase = await createClient();

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

