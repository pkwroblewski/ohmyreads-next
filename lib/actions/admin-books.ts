"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/utils/audit-log";
import { generateSlug } from "@/lib/utils/slug";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import {
  adminBookIdSchema,
  adminCreateBookSchema,
  adminUpdateBookSchema,
} from "@/lib/validation/admin";
import { BOOK_CARD_COLUMNS, BOOK_DETAIL_COLUMNS } from "@/lib/queries/columns";
import type { Book, BookSummary } from "@/types/database";

// Check if current user is admin
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Not authorized");
  }

  return { supabase, user };
}

// Input types
export interface AdminBookInput {
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  isbn13?: string;
  cover_url?: string;
  page_count?: number;
  published_date?: string;
  genres?: string[];
  google_books_id?: string;
  open_library_id?: string;
}

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
    console.error("Error fetching books:", error);
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
    console.error("Error fetching book:", error);
    return { success: false, error: "Failed to fetch book" };
  }
}

// Create new book
export async function adminCreateBook(input: AdminBookInput) {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminCreateBookSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Generate slug
    const baseSlug = generateSlug(input.title);
    let slug = baseSlug;
    let counter = 1;

    // Check for duplicate slug
    while (true) {
      const { data: existing } = await supabase
        .from("books")
        .select("id")
        .eq("slug", slug)
        .single();

      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Insert book
    const { data, error } = await supabase
      .from("books")
      .insert({
        title: input.title.trim(),
        author: input.author.trim(),
        slug,
        description: input.description?.trim() || null,
        isbn: input.isbn?.trim() || null,
        isbn13: input.isbn13?.trim() || null,
        cover_url: input.cover_url?.trim() || null,
        page_count: input.page_count || null,
        published_date: input.published_date || null,
        genres: input.genres || [],
        google_books_id: input.google_books_id || null,
        open_library_id: input.open_library_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await createAuditLog({
      action: "admin.book.create",
      targetType: "book",
      targetId: data.id,
      userId: user.id,
      metadata: { title: input.title, author: input.author },
    });

    revalidatePath("/admin/books");
    revalidatePath("/books");

    return { success: true, book: data };
  } catch (error) {
    console.error("Error creating book:", error);
    return { success: false, error: "Failed to create book" };
  }
}

// Update existing book
export async function adminUpdateBook(bookId: string, input: Partial<AdminBookInput>) {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminUpdateBookSchema.safeParse({ bookId, input });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.author !== undefined) updates.author = input.author.trim();
    if (input.description !== undefined) updates.description = input.description?.trim() || null;
    if (input.isbn !== undefined) updates.isbn = input.isbn?.trim() || null;
    if (input.isbn13 !== undefined) updates.isbn13 = input.isbn13?.trim() || null;
    if (input.cover_url !== undefined) updates.cover_url = input.cover_url?.trim() || null;
    if (input.page_count !== undefined) updates.page_count = input.page_count || null;
    if (input.published_date !== undefined) updates.published_date = input.published_date || null;
    if (input.genres !== undefined) updates.genres = input.genres || [];

    // Update slug if title changed
    if (input.title) {
      const baseSlug = generateSlug(input.title);
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const { data: existing } = await supabase
          .from("books")
          .select("id")
          .eq("slug", slug)
          .neq("id", bookId)
          .single();

        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updates.slug = slug;
    }

    const { data, error } = await supabase
      .from("books")
      .update(updates)
      .eq("id", bookId)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await createAuditLog({
      action: "admin.book.update",
      targetType: "book",
      targetId: bookId,
      userId: user.id,
      metadata: { updates: Object.keys(updates) },
    });

    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}`);
    revalidatePath(`/books/${data.slug}`);

    return { success: true, book: data };
  } catch (error) {
    console.error("Error updating book:", error);
    return { success: false, error: "Failed to update book" };
  }
}

// Delete book
export async function adminDeleteBook(bookId: string) {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminBookIdSchema.safeParse(bookId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Get book info for audit log
    const { data: book } = await supabase
      .from("books")
      .select("title, author")
      .eq("id", bookId)
      .single();

    // Delete book (cascades to user_books, reviews via FK)
    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", bookId);

    if (error) throw error;

    // Audit log
    await createAuditLog({
      action: "admin.book.delete",
      targetType: "book",
      targetId: bookId,
      userId: user.id,
      metadata: { title: book?.title, author: book?.author },
    });

    revalidatePath("/admin/books");
    revalidatePath("/books");

    return { success: true };
  } catch (error) {
    console.error("Error deleting book:", error);
    return { success: false, error: "Failed to delete book" };
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
    console.error("Error fetching genres:", error);
    return { success: false, error: "Failed to fetch genres" };
  }
}
