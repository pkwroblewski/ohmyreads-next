"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";
import { BOOK_CATALOG_TAGS, invalidateTags } from "@/lib/cache/tags";
import { createAuditLog } from "@/lib/utils/audit-log";
import { generateSlug } from "@/lib/utils/slug";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  adminBookIdSchema,
  adminCreateBookSchema,
  adminUpdateBookSchema,
} from "@/lib/validation/admin";
import { logError, logger } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
import type { Book } from "@/types/database";

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

// Create new book
export async function adminCreateBook(input: AdminBookInput): Promise<ActionResult<{ book: Book }>> {
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

    invalidateTags(...BOOK_CATALOG_TAGS);
    revalidatePath("/admin/books");
    revalidatePath("/books");

    // DB stores cover_source as plain text; narrow to the app union at the boundary
    return { success: true, book: data as Book };
  } catch (error) {
    logError("Error creating book", error);
    return { success: false, error: "Failed to create book" };
  }
}

// Update existing book
export async function adminUpdateBook(bookId: string, input: Partial<AdminBookInput>): Promise<ActionResult<{ book: Book }>> {
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

    // RLS can turn a write into a silent no-op, so count the rows that came
    // back before claiming success or writing an audit row.
    const { data: updated, error } = await supabase
      .from("books")
      .update(updates)
      .eq("id", bookId)
      .select();

    if (error) throw error;
    if (!updated || updated.length === 0) {
      logger.error("Admin book update changed no rows", { bookId });
      return { success: false, error: "Nothing was changed" };
    }
    const data = updated[0];

    // Audit log
    await createAuditLog({
      action: "admin.book.update",
      targetType: "book",
      targetId: bookId,
      userId: user.id,
      metadata: { updates: Object.keys(updates) },
    });

    invalidateTags(...BOOK_CATALOG_TAGS);
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}`);
    revalidatePath(`/books/${data.slug}`);

    // DB stores cover_source as plain text; narrow to the app union at the boundary
    return { success: true, book: data as Book };
  } catch (error) {
    logError("Error updating book", error);
    return { success: false, error: "Failed to update book" };
  }
}

// Delete book
export async function adminDeleteBook(bookId: string): Promise<ActionResult> {
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

    // Delete book (cascades to user_books, reviews via FK). RLS can turn a
    // delete into a silent no-op, so count the rows before claiming success.
    const { data: deleted, error } = await supabase
      .from("books")
      .delete()
      .eq("id", bookId)
      .select("id");

    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      logger.error("Admin book delete changed no rows", { bookId });
      return { success: false, error: "Nothing was changed" };
    }

    // Audit log
    await createAuditLog({
      action: "admin.book.delete",
      targetType: "book",
      targetId: bookId,
      userId: user.id,
      metadata: { title: book?.title, author: book?.author },
    });

    invalidateTags(...BOOK_CATALOG_TAGS);
    revalidatePath("/admin/books");
    revalidatePath("/books");

    return { success: true };
  } catch (error) {
    logError("Error deleting book", error);
    return { success: false, error: "Failed to delete book" };
  }
}
