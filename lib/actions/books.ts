"use server";

import { revalidatePath } from "next/cache";
import {
  BOOK_CATALOG_TAGS,
  CACHE_TAGS,
  invalidateTags,
} from "@/lib/cache/tags";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils/slug";
import { syncUserBadges } from "@/lib/actions/badges";
import { syncChallengeProgress } from "@/lib/actions/challenges";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  addToShelfSchema,
  updateReadingProgressSchema,
  importAndAddToShelfSchema,
  bookIdSchema,
} from "@/lib/validation/book-action";
import crypto from "crypto";
import type { Database } from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";
type UserBookInsert = Database["public"]["Tables"]["user_books"]["Insert"];

// Types for external book data
export interface ExternalBookData {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string | null;
  isbn?: string;
  googleBooksId?: string;
  openLibraryId?: string;
  genres?: string[];
  pageCount?: number;
  publishedDate?: string;
}

type ShelfStatus = "want_to_read" | "reading" | "read";

// PostgreSQL unique violation error code
const UNIQUE_VIOLATION = "23505";
const MAX_SLUG_RETRIES = 10;

// Generate a short random suffix using crypto
function generateRandomSuffix(): string {
  const bytes = crypto.randomBytes(4);
  return bytes.toString("hex").slice(0, 6);
}

// Book data for insertion (without id/created_at which are auto-generated)
interface BookInsertData {
  title: string;
  author: string;
  description?: string | null;
  cover_url?: string | null;
  isbn?: string | null;
  google_books_id?: string | null;
  open_library_id?: string | null;
  genres?: string[];
  page_count?: number | null;
  published_date?: string | null;
  average_rating?: number | null;
  ratings_count?: number;
}

/**
 * Insert a book with automatic slug collision handling.
 * Uses database unique constraint instead of check-then-insert to avoid race conditions.
 * On collision, retries with random suffix until success or max retries reached.
 */
async function insertBookWithUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookData: BookInsertData,
  baseSlug: string
): Promise<{ id: string; slug: string } | { error: string }> {
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < MAX_SLUG_RETRIES) {
    const { data, error } = await supabase
      .from("books")
      .insert({ ...bookData, slug })
      .select("id, slug")
      .single();

    if (data) {
      // Success
      return { id: data.id, slug: data.slug };
    }

    if (error) {
      // Check if this is a unique constraint violation on slug
      if (error.code === UNIQUE_VIOLATION && error.message?.includes("slug")) {
        // Collision - retry with random suffix
        attempt++;
        slug = `${baseSlug}-${generateRandomSuffix()}`;
        continue;
      }

      // Different error - fail immediately
      return { error: reportError("Error inserting book", error) };
    }
  }

  // Exhausted retries - use timestamp as last resort
  const lastResortSlug = `${baseSlug}-${Date.now()}`;
  const { data, error } = await supabase
    .from("books")
    .insert({ ...bookData, slug: lastResortSlug })
    .select("id, slug")
    .single();

  if (data) {
    return { id: data.id, slug: data.slug };
  }

  return {
    error: error
      ? reportError("Error inserting book (last-resort slug)", error)
      : "Failed to create book after multiple attempts",
  };
}

export async function addToShelf(bookId: string, status: string) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = addToShelfSchema.safeParse({ bookId, status });
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Prepare data
    const now = new Date().toISOString();
    const data: UserBookInsert = {
      user_id: user.id,
      book_id: bookId,
      status,
      updated_at: now,
    };

    // Set timestamps based on status
    if (status === "reading") {
      data.started_at = now;
    } else if (status === "read") {
      data.finished_at = now;
    }

    // Upsert (insert or update on conflict)
    const { error } = await supabase.from("user_books").upsert(data, {
      onConflict: "user_id,book_id",
      ignoreDuplicates: false,
    });

    if (error) {
      return { error: reportError("Error adding to shelf", error) };
    }

    // reading_stats is maintained by a trigger on user_books (migration 057)

    // Sync challenges on any status change (moving OUT of "read" must recount
    // too); badges only when a book becomes read — they are one-way.
    // Must await: fire-and-forget promises can be frozen on serverless.
    // allSettled isolates sync failures from the shelf write's success.
    const syncs: Promise<unknown>[] = [syncChallengeProgress()];
    if (status === "read") {
      syncs.push(syncUserBadges());
    }
    const results = await Promise.allSettled(syncs);
    const badgeResult = status === "read" ? results[1] : undefined;
    const newBadges =
      badgeResult?.status === "fulfilled"
        ? ((badgeResult.value as Awaited<ReturnType<typeof syncUserBadges>>)
            ?.newBadges ?? [])
        : [];

    // A move to "reading" writes an activity_feed row via trigger, and shelf
    // adds are one of the two inputs to the trending score.
    invalidateTags(CACHE_TAGS.activity, CACHE_TAGS.trending);
    // Revalidate affected pages
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");

    return { success: true, newBadges };
  } catch (error) {
    logError("Error in addToShelf", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function updateReadingProgress(
  bookId: string,
  currentPage: number,
  totalPages?: number
): Promise<
  | { error: string }
  | {
      success: true;
      currentPage: number;
      totalPages: number | null;
      progressPercentage: number | null;
    }
> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateReadingProgressSchema.safeParse({
      bookId,
      currentPage,
      totalPages,
    });
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Fetch the shelf row to resolve the effective total and enforce status
    const { data: row } = await supabase
      .from("user_books")
      .select("status, total_pages, book:books(page_count)")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle();

    if (!row || row.status !== "reading") {
      return { error: "Book is not in your currently-reading shelf" };
    }

    const bookPageCount = row.book?.page_count ?? null;
    const effectiveTotal = totalPages ?? row.total_pages ?? bookPageCount;
    const clampedPage =
      effectiveTotal !== null
        ? Math.min(currentPage, effectiveTotal)
        : currentPage;
    const progressPercentage =
      effectiveTotal !== null
        ? Math.min(100, Math.round((clampedPage / effectiveTotal) * 100))
        : null;

    // status filter prevents scribbling on want-to-read/read rows
    const { data: updated, error } = await supabase
      .from("user_books")
      .update({
        current_page: clampedPage,
        total_pages: effectiveTotal,
        progress_percentage: progressPercentage,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("status", "reading")
      .select("book_id");

    if (error) {
      logError("Error updating reading progress", error);
      return { error: "Failed to update progress" };
    }
    if (!updated || updated.length === 0) {
      return { error: "Book is not in your currently-reading shelf" };
    }

    revalidatePath("/my-shelf");
    revalidatePath("/dashboard");

    return {
      success: true,
      currentPage: clampedPage,
      totalPages: effectiveTotal,
      progressPercentage,
    };
  } catch (error) {
    logError("Error in updateReadingProgress", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function removeFromShelf(bookId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = bookIdSchema.safeParse(bookId);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { error } = await supabase
      .from("user_books")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (error) {
      return { error: reportError("Error removing from shelf", error) };
    }

    // reading_stats is maintained by a trigger on user_books (migration 057)

    // Un-shelving a read book must recount challenges; badges stay (one-way)
    await Promise.allSettled([syncChallengeProgress()]);

    invalidateTags(CACHE_TAGS.trending);
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    logError("Error in removeFromShelf", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Import an external book to catalog and add to user's shelf
 * Used when user wants to add a book from Google Books/Open Library that's not in catalog
 */
export async function importAndAddToShelf(
  externalBook: ExternalBookData,
  status: ShelfStatus
): Promise<{ success: boolean; bookId?: string; slug?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = importAndAddToShelfSchema.safeParse({
      externalBook,
      status,
    });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }
    externalBook = validationResult.data.externalBook;
    status = validationResult.data.status;

    // Check if book already exists by ISBN, Google Books ID, or Open Library ID
    let existingBook = null;

    if (externalBook.isbn) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("isbn", externalBook.isbn)
        .limit(1)
        .single();
      existingBook = data;
    }

    if (!existingBook && externalBook.googleBooksId) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("google_books_id", externalBook.googleBooksId)
        .limit(1)
        .single();
      existingBook = data;
    }

    if (!existingBook && externalBook.openLibraryId) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("open_library_id", externalBook.openLibraryId)
        .limit(1)
        .single();
      existingBook = data;
    }

    let bookId: string;
    let bookSlug: string;

    const createdCatalogEntry = !existingBook;

    if (existingBook) {
      // Book already exists, use it
      bookId = existingBook.id;
      bookSlug = existingBook.slug;
    } else {
      // Create new book in catalog with race-condition-safe slug generation
      const baseSlug = generateSlug(externalBook.title);

      const result = await insertBookWithUniqueSlug(
        supabase,
        {
          title: externalBook.title,
          author: externalBook.author,
          description: externalBook.description || null,
          cover_url: externalBook.coverUrl || null,
          isbn: externalBook.isbn || null,
          google_books_id: externalBook.googleBooksId || null,
          open_library_id: externalBook.openLibraryId || null,
          genres: externalBook.genres || [],
          page_count: externalBook.pageCount || null,
          published_date: externalBook.publishedDate || null,
          // User-submitted books start with no ratings
          average_rating: null,
          ratings_count: 0,
        },
        baseSlug
      );

      if ("error" in result) {
        return { success: false, error: result.error };
      }

      bookId = result.id;
      bookSlug = result.slug;
    }

    // Now add to user's shelf
    const now = new Date().toISOString();
    const shelfData: UserBookInsert = {
      user_id: user.id,
      book_id: bookId,
      status,
      updated_at: now,
    };

    if (status === "reading") {
      shelfData.started_at = now;
    } else if (status === "read") {
      shelfData.finished_at = now;
    }

    const { error: shelfError } = await supabase.from("user_books").upsert(shelfData, {
      onConflict: "user_id,book_id",
      ignoreDuplicates: false,
    });

    if (shelfError) {
      logError("Error adding to shelf", shelfError);
      return { success: false, error: "Book added to catalog but failed to add to shelf" };
    }

    // reading_stats is maintained by a trigger on user_books (migration 057)

    // Same sync wiring as addToShelf; badges not surfaced on the import path
    const importSyncs: Promise<unknown>[] = [syncChallengeProgress()];
    if (status === "read") {
      importSyncs.push(syncUserBadges());
    }
    await Promise.allSettled(importSyncs);

    // Only bust the catalog caches when this import actually added a book.
    if (createdCatalogEntry) {
      invalidateTags(...BOOK_CATALOG_TAGS);
    }
    invalidateTags(CACHE_TAGS.activity, CACHE_TAGS.trending);
    // Revalidate pages
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");
    revalidatePath("/books");
    revalidatePath(`/books/${bookSlug}`);

    return { success: true, bookId, slug: bookSlug };
  } catch (error) {
    logError("Error in importAndAddToShelf", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

