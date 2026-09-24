"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  BOOK_CATALOG_TAGS,
  CACHE_TAGS,
  invalidateTags,
} from "@/lib/cache/tags";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
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
import type { UpdateReadingProgressInput } from "@/lib/validation/book-action";
import type { Database } from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";
import { insertBookWithUniqueSlug } from "@/lib/import/insert-book";
import { processBook } from "@/lib/covers/pipeline";
import { normalizeGenres } from "@/lib/data/genres";
import {
  getGoogleBookById,
  getOpenLibraryWorkById,
  normalizeDate,
} from "@/lib/utils/external-book-search";
import type { ActionResult } from "@/types/app";
type UserBookInsert = Database["public"]["Tables"]["user_books"]["Insert"];

// Types for external book data
/** Only the id travels: the action re-fetches the record server-side. */
export interface ExternalBookData {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
}

type ShelfStatus = "want_to_read" | "reading" | "read";

export async function addToShelf(bookId: string, status: string): Promise<ActionResult<{ newBadges: Array<{ id: string; name: string; icon: string }> }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = addToShelfSchema.safeParse({ bookId, status });
    if (!validationResult.success) {
      return {
        success: false,
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
      return { success: false, error: reportError("Error adding to shelf", error) };
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
    const badgeSync =
      badgeResult?.status === "fulfilled"
        ? (badgeResult.value as Awaited<ReturnType<typeof syncUserBadges>>)
        : null;
    const newBadges = badgeSync?.success ? badgeSync.newBadges : [];

    // A move to "reading" writes an activity_feed row via trigger, and shelf
    // adds are one of the two inputs to the trending score.
    invalidateTags(CACHE_TAGS.activity, CACHE_TAGS.trending);
    // Revalidate affected pages
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");

    return { success: true, newBadges };
  } catch (error) {
    logError("Error in addToShelf", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Write a reader's position in a book they are currently reading.
 *
 * Progress comes in as a page number or as a percentage: an audiobook or an
 * e-reader leaves a reader with no page to type. `percent` wins when both are
 * given, and whichever side is missing is derived from the effective total
 * (the total passed in, then the one already stored, then `books.page_count`).
 * With no total at all, a percentage is stored on its own and a page number
 * is stored without one.
 */
export async function updateReadingProgress(
  input: UpdateReadingProgressInput
): Promise<
  ActionResult<{
    currentPage: number | null;
    totalPages: number | null;
    progressPercentage: number | null;
  }>
> {
  const { bookId, currentPage, totalPages, percent } = input;
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateReadingProgressSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
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
      return { success: false, error: "Book is not in your currently-reading shelf" };
    }

    const bookPageCount = row.book?.page_count ?? null;
    const effectiveTotal = totalPages ?? row.total_pages ?? bookPageCount;

    let clampedPage: number | null;
    let progressPercentage: number | null;

    if (percent !== undefined) {
      progressPercentage = percent;
      clampedPage =
        effectiveTotal !== null
          ? Math.round((effectiveTotal * percent) / 100)
          : (currentPage ?? null);
    } else {
      // The refinement guarantees a page when there is no percentage.
      const page = currentPage as number;
      clampedPage = effectiveTotal !== null ? Math.min(page, effectiveTotal) : page;
      progressPercentage =
        effectiveTotal !== null
          ? Math.min(100, Math.round((clampedPage / effectiveTotal) * 100))
          : null;
    }

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
      return { success: false, error: "Failed to update progress" };
    }
    if (!updated || updated.length === 0) {
      return { success: false, error: "Book is not in your currently-reading shelf" };
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
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function removeFromShelf(bookId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 20 shelf mutations per minute per user
    const { allowed } = await checkRateLimit(`book:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = bookIdSchema.safeParse(bookId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { error } = await supabase
      .from("user_books")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (error) {
      return { success: false, error: reportError("Error removing from shelf", error) };
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
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Import an external book to catalog and add to user's shelf
 * Used when user wants to add a book from Google Books/Open Library that's not in catalog.
 * The catalog row is built from Google / Open Library's own response for the
 * given id, never from client-supplied fields.
 */
export async function importAndAddToShelf(
  externalBook: ExternalBookData,
  status: ShelfStatus
): Promise<ActionResult<{ bookId: string; slug: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

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
    const { googleBooksId, openLibraryId } = validationResult.data.externalBook;
    status = validationResult.data.status;

    // Check if book already exists by Google Books ID or Open Library ID
    let existingBook = null;

    if (googleBooksId) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("google_books_id", googleBooksId)
        .limit(1)
        .maybeSingle();
      existingBook = data;
    }

    if (!existingBook && openLibraryId) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("open_library_id", openLibraryId)
        .limit(1)
        .maybeSingle();
      existingBook = data;
    }

    // Not in the catalog under that id: load the record from its source.
    const record = existingBook
      ? null
      : googleBooksId
        ? await getGoogleBookById(googleBooksId)
        : openLibraryId
          ? await getOpenLibraryWorkById(openLibraryId)
          : null;

    // The same edition may already be in the catalog under another source
    if (!existingBook && record?.isbn) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("isbn", record.isbn)
        .limit(1)
        .maybeSingle();
      existingBook = data;
    }

    let bookId: string;
    let bookSlug: string;

    const createdCatalogEntry = !existingBook;

    if (existingBook) {
      // Book already exists, use it
      bookId = existingBook.id;
      bookSlug = existingBook.slug;
    } else if (!record) {
      return {
        success: false,
        error: "Couldn't load this book's details. Please try again later.",
      };
    } else {
      // Catalog inserts are rarer and heavier than shelf moves: 10 per hour
      const { allowed: catalogAllowed } = await checkRateLimit(
        `catalog-insert:${user.id}`,
        10,
        3600000
      );
      if (!catalogAllowed) {
        return {
          success: false,
          error: "You've added a lot of new books recently. Please try again later.",
        };
      }

      // Create new book in catalog with race-condition-safe slug generation.
      // The books INSERT policy is admin-only, so the write goes through the
      // service-role client — after the auth, rate-limit and Zod checks above,
      // and only for this insert; every other query stays on the session client.
      const baseSlug = generateSlug(record.title);
      const admin = createAdminClient();

      const result = await insertBookWithUniqueSlug(
        admin,
        {
          title: record.title.slice(0, 500),
          author: record.author.slice(0, 200),
          description: record.description,
          cover_url: record.coverUrl,
          isbn: record.isbn,
          google_books_id: record.googleBooksId,
          open_library_id: record.openLibraryId,
          open_library_cover_id: record.openLibraryCoverId,
          genres: normalizeGenres(record.genres),
          page_count: record.pageCount,
          published_date: normalizeDate(record.publishedDate),
          // User-submitted books start with no ratings, external or local
          average_rating: null,
          ratings_count: 0,
          local_average_rating: null,
          local_ratings_count: 0,
        },
        baseSlug
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      bookId = result.id;
      bookSlug = result.slug;

      // Pick and store a verified cover for the new row once the response has
      // been sent. The row was inserted with the search result's remote
      // cover_url; the pipeline swaps it for a bucket copy, or leaves it when
      // no candidate passes. It must never delay or fail the action.
      const newRow = {
        id: bookId,
        cover_url: record.coverUrl,
        isbn: record.isbn,
        google_books_id: record.googleBooksId,
        open_library_cover_id: record.openLibraryCoverId,
      };
      after(() =>
        processBook(admin, newRow).catch((error) =>
          logError("Cover pipeline failed for a user-added book", error, {
            bookId: newRow.id,
          })
        )
      );
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

