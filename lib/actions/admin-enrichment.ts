"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { BOOK_CATALOG_TAGS, invalidateTags } from "@/lib/cache/tags";
import { enrichBookEntry } from "@/lib/utils/external-book-search";
import { logger, reportError } from "@/lib/utils/log";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  enrichmentLimitSchema,
  bookToEnrichSchema,
  enrichBookIdsSchema,
} from "@/lib/validation/admin";

// ============================================
// TYPES
// ============================================

/** The session client `requireAdmin()` hands back; RLS still applies. */
type AdminClient = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

export interface BookToEnrich {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  genres: string[];
  description: string | null;
  cover_url: string | null;
  page_count: number | null;
  google_books_id: string | null;
  open_library_id: string | null;
  created_at: string;
}

export interface EnrichmentStats {
  totalBooks: number;
  missingDescription: number;
  missingCover: number;
  missingPageCount: number;
  missingGenres: number;
}

export interface EnrichmentResultItem {
  bookId: string;
  title: string;
  success: boolean;
  fieldsUpdated: string[];
  error?: string;
}

export interface EnrichmentResult {
  totalProcessed: number;
  updated: number;
  skipped: number;
  failed: number;
  results: EnrichmentResultItem[];
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Already full date: 2022-02-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Year and month: 2022-02
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  // Year only: 2022
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }

  // Try to parse other formats
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }

  return null;
}

// ============================================
// ADMIN CHECK
// ============================================

async function requireAdminRateLimit(userId: string): Promise<void> {
  // Rate limit: 30 admin mutations per minute per admin
  const { allowed } = await checkRateLimit(`admin:${userId}`, 30, 60000);
  if (!allowed) {
    throw new Error("Too many requests. Please wait a moment.");
  }
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Get stats and list of books that need enrichment.
 */
export async function getBooksNeedingEnrichment(
  limit: number = 50
): Promise<{ stats: EnrichmentStats; books: BookToEnrich[] }> {
  const { supabase } = await requireAdmin();

  // Read-only: validate limit param only
  if (!enrichmentLimitSchema.safeParse(limit).success) {
    throw new Error("Invalid limit");
  }

  // Fetch books to analyze
  const { data: books, error } = await supabase
    .from("books")
    .select(
      "id, title, author, isbn, genres, description, cover_url, page_count, google_books_id, open_library_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit * 2); // Fetch extra to account for filtering

  if (error) {
    logger.error("Failed to fetch books for enrichment", { error: error.message });
    throw new Error("Failed to fetch books");
  }

  if (!books) {
    return {
      stats: {
        totalBooks: 0,
        missingDescription: 0,
        missingCover: 0,
        missingPageCount: 0,
        missingGenres: 0,
      },
      books: [],
    };
  }

  // Filter to books needing enrichment
  const needsEnrichment = books.filter((book) => {
    const missingDescription = !book.description;
    const missingCover = !book.cover_url;
    const missingPageCount = !book.page_count;
    const missingGenres = !book.genres || book.genres.length === 0;

    return missingDescription || missingCover || missingPageCount || missingGenres;
  });

  const booksToEnrich = needsEnrichment.slice(0, limit) as BookToEnrich[];

  // Calculate stats
  const stats: EnrichmentStats = {
    totalBooks: booksToEnrich.length,
    missingDescription: booksToEnrich.filter((b) => !b.description).length,
    missingCover: booksToEnrich.filter((b) => !b.cover_url).length,
    missingPageCount: booksToEnrich.filter((b) => !b.page_count).length,
    missingGenres: booksToEnrich.filter(
      (b) => !b.genres || b.genres.length === 0
    ).length,
  };

  return { stats, books: booksToEnrich };
}

/**
 * Enrich a single book with data from external APIs.
 */
export async function enrichSingleBook(
  book: BookToEnrich
): Promise<EnrichmentResultItem> {
  const { supabase, user } = await requireAdmin();
  await requireAdminRateLimit(user.id);

  // Validate input with Zod
  const validationResult = bookToEnrichSchema.safeParse(book);
  if (!validationResult.success) {
    return {
      bookId: book?.id ?? "",
      title: book?.title ?? "",
      success: false,
      fieldsUpdated: [],
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  return enrichSingleBookCore(supabase, book);
}

/**
 * Core enrichment logic — called by enrichSingleBook (after auth/rate
 * limit/validation) and by enrichBooks in a loop (batch is validated and
 * rate-limited once; per-book checks here would burn one token per book).
 */
async function enrichSingleBookCore(
  supabase: AdminClient,
  book: BookToEnrich
): Promise<EnrichmentResultItem> {
  const result: EnrichmentResultItem = {
    bookId: book.id,
    title: book.title,
    success: false,
    fieldsUpdated: [],
  };

  try {
    // Call enrichment API
    const enriched = await enrichBookEntry({
      title: book.title,
      author: book.author,
      isbn: book.isbn || undefined,
      genres: book.genres || [],
    });

    // Determine what needs updating (only update missing fields)
    const updates: Record<string, unknown> = {};

    // Description: update if missing
    if (!book.description && enriched.description) {
      updates.description = enriched.description;
      result.fieldsUpdated.push("description");
    }

    // Cover URL: update if missing
    if (!book.cover_url && enriched.coverUrl) {
      updates.cover_url = enriched.coverUrl;
      updates.cover_source = enriched.coverSource;
      result.fieldsUpdated.push("cover_url");
    }

    // Page count: update if missing
    if (!book.page_count && enriched.pageCount) {
      updates.page_count = enriched.pageCount;
      result.fieldsUpdated.push("page_count");
    }

    // Genres: update if empty
    if ((!book.genres || book.genres.length === 0) && enriched.genres.length > 0) {
      updates.genres = enriched.genres;
      result.fieldsUpdated.push("genres");
    }

    // ISBN: update if missing
    if (!book.isbn && enriched.isbn) {
      updates.isbn = enriched.isbn;
      result.fieldsUpdated.push("isbn");
    }

    // External IDs: update if we found them
    if (!book.google_books_id && enriched.googleBooksId) {
      updates.google_books_id = enriched.googleBooksId;
      result.fieldsUpdated.push("google_books_id");
    }

    if (!book.open_library_id && enriched.openLibraryId) {
      updates.open_library_id = enriched.openLibraryId;
      result.fieldsUpdated.push("open_library_id");
    }

    if (enriched.openLibraryCoverId) {
      updates.open_library_cover_id = enriched.openLibraryCoverId;
    }

    // Published date: update if missing and we have it
    if (enriched.publishedDate) {
      const normalizedDate = normalizeDate(enriched.publishedDate);
      if (normalizedDate) {
        updates.published_date = normalizedDate;
        result.fieldsUpdated.push("published_date");
      }
    }

    // Only update if we have changes
    if (Object.keys(updates).length > 0) {
      // RLS can turn an update into a silent no-op, so count the rows before
      // reporting the fields as updated.
      const { data: updated, error } = await supabase
        .from("books")
        .update(updates)
        .eq("id", book.id)
        .select("id");

      if (error) {
        result.error = reportError("Book enrichment update failed", error, {
          bookId: book.id,
        });
        return result;
      }
      if (!updated || updated.length === 0) {
        logger.error("Book enrichment update changed no rows", {
          bookId: book.id,
        });
        result.fieldsUpdated = [];
        result.error = "Nothing was changed";
        return result;
      }

      // Cover, description or ratings changed: the cached book page reads them.
      invalidateTags(...BOOK_CATALOG_TAGS);
      result.success = true;
    } else {
      // No new data found - mark as success but no updates
      result.success = true;
    }
  } catch (error) {
    result.error = reportError("Book enrichment failed", error, {
      bookId: book.id,
      title: book.title,
    });
  }

  return result;
}

/**
 * Enrich multiple books in batch.
 */
export async function enrichBooks(
  bookIds: string[]
): Promise<EnrichmentResult> {
  const { supabase, user } = await requireAdmin();
  await requireAdminRateLimit(user.id);

  // Validate input with Zod
  const validationResult = enrichBookIdsSchema.safeParse(bookIds);
  if (!validationResult.success) {
    throw new Error(
      validationResult.error.issues[0]?.message || "Invalid input"
    );
  }

  // Fetch the specific books
  const { data: books, error } = await supabase
    .from("books")
    .select(
      "id, title, author, isbn, genres, description, cover_url, page_count, google_books_id, open_library_id, created_at"
    )
    .in("id", bookIds);

  if (error || !books) {
    throw new Error("Failed to fetch books");
  }

  const result: EnrichmentResult = {
    totalProcessed: books.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  // Process books one at a time with rate limiting
  for (const book of books) {
    const enrichResult = await enrichSingleBookCore(supabase, book as BookToEnrich);
    result.results.push(enrichResult);

    if (enrichResult.error) {
      result.failed++;
    } else if (enrichResult.fieldsUpdated.length > 0) {
      result.updated++;
    } else {
      result.skipped++;
    }

    // Rate limit: 200ms delay between API calls
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return result;
}
