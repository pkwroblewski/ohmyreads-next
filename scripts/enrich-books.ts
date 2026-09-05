/**
 * Book Enrichment Script
 *
 * Batch-enriches existing books with missing or incomplete data from
 * Google Books and Open Library APIs.
 *
 * Usage:
 *   npx tsx scripts/enrich-books.ts              # Enrich all incomplete books
 *   npx tsx scripts/enrich-books.ts --dry-run    # Preview without changes
 *   npx tsx scripts/enrich-books.ts --limit 10   # Process only 10 books
 *   npx tsx scripts/enrich-books.ts --verbose    # Show detailed output
 *
 * Environment:
 *   Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { enrichBookEntry } from "../lib/utils/external-book-search";

// Load environment variables
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// CONFIGURATION
// ============================================

const ENRICH_DELAY_MS = 200; // Delay between API calls to avoid rate limiting
const DEFAULT_LIMIT = 100; // Default batch size if not specified

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

// Parse --limit N
const limitIndex = args.indexOf("--limit");
const limit = limitIndex !== -1 && args[limitIndex + 1]
  ? parseInt(args[limitIndex + 1], 10)
  : DEFAULT_LIMIT;

// ============================================
// TYPES
// ============================================

interface BookToEnrich {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  genres: string[];
  description: string | null;
  cover_url: string | null;
  page_count: number | null;
  published_date: string | null;
  google_books_id: string | null;
  open_library_id: string | null;
  open_library_cover_id: number | null;
}

interface EnrichmentResult {
  bookId: string;
  title: string;
  updated: boolean;
  fieldsUpdated: string[];
  error?: string;
}

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProgress(current: number, total: number): string {
  const percent = Math.round((current / total) * 100);
  const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
  return `[${bar}] ${percent}% (${current}/${total})`;
}

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
// DATABASE QUERIES
// ============================================

/**
 * Fetch books that need enrichment.
 *
 * Criteria:
 * - Missing description OR
 * - Missing cover_url OR
 * - Missing page_count OR
 * - Empty/null genres
 */
async function fetchBooksNeedingEnrichment(
  maxCount: number
): Promise<BookToEnrich[]> {
  // Use RPC or raw query since Supabase JS client doesn't support complex OR with array checks
  // We'll fetch books and filter in application code for simplicity

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, isbn, genres, description, cover_url, page_count, published_date, google_books_id, open_library_id, open_library_cover_id")
    .order("created_at", { ascending: false })
    .limit(maxCount * 2); // Fetch extra to account for filtering

  if (error) {
    console.error("Failed to fetch books:", error.message);
    throw error;
  }

  if (!books) return [];

  // Filter to books needing enrichment
  const needsEnrichment = books.filter((book) => {
    const missingDescription = !book.description;
    const missingCover = !book.cover_url;
    const missingPageCount = !book.page_count;
    const missingGenres = !book.genres || book.genres.length === 0;

    return missingDescription || missingCover || missingPageCount || missingGenres;
  });

  return needsEnrichment.slice(0, maxCount) as BookToEnrich[];
}

/**
 * Update a book with enriched data.
 */
async function updateBook(
  bookId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from("books")
    .update(updates)
    .eq("id", bookId);

  if (error) {
    console.error(`Failed to update book ${bookId}:`, error.message);
    return false;
  }

  return true;
}

// ============================================
// ENRICHMENT LOGIC
// ============================================

async function enrichSingleBook(book: BookToEnrich): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    bookId: book.id,
    title: book.title,
    updated: false,
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

    // Cover id: fill only when missing, so a good cover is never swapped for a mismatched one
    if (!book.open_library_cover_id && enriched.openLibraryCoverId) {
      updates.open_library_cover_id = enriched.openLibraryCoverId;
    }

    // Published date: update if missing and we have it
    if (!book.published_date && enriched.publishedDate) {
      const normalizedDate = normalizeDate(enriched.publishedDate);
      if (normalizedDate) {
        updates.published_date = normalizedDate;
        result.fieldsUpdated.push("published_date");
      }
    }

    // Only update if we have changes
    if (Object.keys(updates).length > 0) {
      if (!isDryRun) {
        const success = await updateBook(book.id, updates);
        result.updated = success;
      } else {
        result.updated = true; // Would have updated in dry-run
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
  }

  return result;
}

// ============================================
// MAIN
// ============================================

async function runEnrichment(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║           BOOK ENRICHMENT - Improve Data Quality       ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Fetch books needing enrichment
  console.log(`\n📚 Fetching books that need enrichment (limit: ${limit})...`);

  const books = await fetchBooksNeedingEnrichment(limit);

  if (books.length === 0) {
    console.log("\n✅ No books need enrichment! All books have complete data.");
    return;
  }

  console.log(`   Found ${books.length} books needing enrichment`);

  // Show what's missing
  const missingStats = {
    description: books.filter((b) => !b.description).length,
    cover_url: books.filter((b) => !b.cover_url).length,
    page_count: books.filter((b) => !b.page_count).length,
    genres: books.filter((b) => !b.genres || b.genres.length === 0).length,
  };

  console.log("\n   Missing data breakdown:");
  console.log(`   - No description: ${missingStats.description}`);
  console.log(`   - No cover: ${missingStats.cover_url}`);
  console.log(`   - No page count: ${missingStats.page_count}`);
  console.log(`   - No genres: ${missingStats.genres}`);

  // Enrich each book
  console.log(`\n🔄 Enriching books (${ENRICH_DELAY_MS}ms delay between requests)...`);
  console.log(`   (Estimated time: ~${Math.ceil((books.length * ENRICH_DELAY_MS) / 1000)} seconds)\n`);

  const results: EnrichmentResult[] = [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    // Progress update
    process.stdout.write(`\r   ${formatProgress(i + 1, books.length)} - "${book.title.substring(0, 35)}..."`);

    const result = await enrichSingleBook(book);
    results.push(result);

    if (result.error) {
      failed++;
    } else if (result.updated && result.fieldsUpdated.length > 0) {
      updated++;
    } else {
      skipped++;
    }

    // Verbose output
    if (isVerbose && result.fieldsUpdated.length > 0) {
      console.log(`\n      Updated: ${result.fieldsUpdated.join(", ")}`);
    }

    // Rate limit delay
    if (i < books.length - 1) {
      await sleep(ENRICH_DELAY_MS);
    }
  }

  // Summary
  console.log("\n\n╔════════════════════════════════════════════════════════╗");
  console.log("║                  ENRICHMENT COMPLETE                    ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  console.log(`\n   📊 Results:`);
  console.log(`   - Updated: ${updated} books`);
  console.log(`   - Skipped (no new data found): ${skipped} books`);
  console.log(`   - Failed: ${failed} books`);

  if (isDryRun) {
    console.log(`\n   🔍 DRY RUN - No actual changes were made`);
    console.log(`      Run without --dry-run to apply changes.`);
  }

  // Show detailed field updates
  const fieldCounts: Record<string, number> = {};
  for (const r of results) {
    for (const field of r.fieldsUpdated) {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }
  }

  if (Object.keys(fieldCounts).length > 0) {
    console.log(`\n   📈 Fields updated:`);
    for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   - ${field}: ${count}`);
    }
  }

  // Show failed books if any
  const failedResults = results.filter((r) => r.error);
  if (failedResults.length > 0 && isVerbose) {
    console.log(`\n   ⚠️  Failed books:`);
    for (const r of failedResults.slice(0, 5)) {
      console.log(`   - "${r.title}": ${r.error}`);
    }
    if (failedResults.length > 5) {
      console.log(`   ... and ${failedResults.length - 5} more`);
    }
  }

  console.log("\n✨ Done!\n");
}

// ============================================
// RUN
// ============================================

runEnrichment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Enrichment failed:", error);
    process.exit(1);
  });
