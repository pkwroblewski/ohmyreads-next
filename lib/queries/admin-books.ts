// Admin catalogue reads (books list, single book, genre list).
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { requireAdmin } from "@/lib/auth/require-admin";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { adminBookIdSchema } from "@/lib/validation/admin";
import { BOOK_CARD_COLUMNS, BOOK_DETAIL_COLUMNS } from "./columns";
import type { Book, BookSummary } from "@/types/database";
import { logError } from "@/lib/utils/log";

export interface BookFilters {
  search?: string;
  genre?: string;
  sortBy?: "title" | "author" | "created_at" | "ratings_count";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// Get books with filters for admin
export async function adminGetBooks(filters: BookFilters = {}) {
  try {
    const { supabase } = await requireAdmin();

    const {
      search = "",
      genre,
      sortBy = "created_at",
      sortOrder = "desc",
      page = 1,
      limit = 50,
    } = filters;

    let query = supabase
      .from("books")
      .select(BOOK_CARD_COLUMNS, { count: "exact" });

    // Search filter (sanitize input to prevent PostgREST query manipulation)
    if (search) {
      const safeSearch = sanitizePostgrestValue(search);
      query = query.or(`title.ilike.%${safeSearch}%,author.ilike.%${safeSearch}%,isbn.ilike.%${safeSearch}%`);
    }

    // Genre filter
    if (genre) {
      query = query.contains("genres", [genre]);
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      success: true,
      books: (data as BookSummary[]) || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logError("Error fetching books", error);
    return { success: false, error: "Failed to fetch books" };
  }
}

// Get single book for editing
export async function adminGetBook(bookId: string) {
  try {
    const { supabase } = await requireAdmin();

    // Read-only: validate id param only
    if (!adminBookIdSchema.safeParse(bookId).success) {
      return { success: false, error: "Invalid book ID" };
    }

    const { data, error } = await supabase
      .from("books")
      .select(BOOK_DETAIL_COLUMNS)
      .eq("id", bookId)
      .single();

    if (error) throw error;

    return { success: true, book: data as Book };
  } catch (error) {
    logError("Error fetching book", error);
    return { success: false, error: "Failed to fetch book" };
  }
}

// Get all unique genres from books
export async function adminGetGenres() {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase
      .from("books")
      .select("genres");

    if (error) throw error;

    // Flatten and dedupe genres
    const allGenres = data?.flatMap((b) => b.genres || []) || [];
    const uniqueGenres = [...new Set(allGenres)].sort();

    return { success: true, genres: uniqueGenres };
  } catch (error) {
    logError("Error fetching genres", error);
    return { success: false, error: "Failed to fetch genres" };
  }
}
