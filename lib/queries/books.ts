import { createClient } from "@/lib/supabase/server";
import type { Book, ReviewWithUser, UserBook } from "@/types/database";

/**
 * Get a single book by its slug
 */
export async function getBookBySlug(slug: string): Promise<Book | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching book by slug:", error);
      return null;
    }

    return data as Book;
  } catch (error) {
    console.error("Error in getBookBySlug:", error);
    return null;
  }
}

/**
 * Get reviews for a specific book with user profiles
 */
export async function getBookReviews(
  bookId: string,
  limit = 10
): Promise<ReviewWithUser[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*, profile:profiles(id, username, display_name, avatar_url)")
      .eq("book_id", bookId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching book reviews:", error);
      return [];
    }

    return (data || []) as ReviewWithUser[];
  } catch (error) {
    console.error("Error in getBookReviews:", error);
    return [];
  }
}

/**
 * Get related books based on overlapping genres
 */
export async function getRelatedBooks(
  genres: string[],
  excludeId: string,
  limit = 6
): Promise<Book[]> {
  try {
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
  } catch (error) {
    console.error("Error in getRelatedBooks:", error);
    return [];
  }
}

/**
 * Get popular books sorted by ratings count
 */
export async function getPopularBooks(limit = 20): Promise<Book[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("ratings_count", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching popular books:", error);
      return [];
    }

    return (data || []) as Book[];
  } catch (error) {
    console.error("Error in getPopularBooks:", error);
    return [];
  }
}

/**
 * Search books by title or author with optional genre filter
 */
export async function searchBooks(
  query: string,
  options?: { genre?: string; page?: number; limit?: number }
): Promise<{ books: Book[]; total: number }> {
  try {
    const supabase = await createClient();
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    let dbQuery = supabase
      .from("books")
      .select("*", { count: "exact" });

    // Apply search filter
    if (query && query.trim()) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query}%,author.ilike.%${query}%`
      );
    }

    // Apply genre filter
    if (options?.genre) {
      dbQuery = dbQuery.contains("genres", [options.genre]);
    }

    // Apply pagination
    const { data, error, count } = await dbQuery
      .order("ratings_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error searching books:", error);
      return { books: [], total: 0 };
    }

    return {
      books: (data || []) as Book[],
      total: count || 0,
    };
  } catch (error) {
    console.error("Error in searchBooks:", error);
    return { books: [], total: 0 };
  }
}

/**
 * Get all book slugs (useful for static generation)
 */
export async function getAllBookSlugs(): Promise<{ slug: string }[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("books")
      .select("slug");

    if (error) {
      console.error("Error fetching book slugs:", error);
      return [];
    }

    return (data || []) as { slug: string }[];
  } catch (error) {
    console.error("Error in getAllBookSlugs:", error);
    return [];
  }
}

/**
 * Get user's status for a specific book (want_to_read, reading, read)
 */
export async function getUserBookStatus(
  userId: string,
  bookId: string
): Promise<UserBook | null> {
  try {
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
  } catch (error) {
    console.error("Error in getUserBookStatus:", error);
    return null;
  }
}

