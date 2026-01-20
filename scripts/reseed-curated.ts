/**
 * Curated Book Reseed Script
 * 
 * Re-seeds the database with the curated high-signal book list (~1000 books)
 * with Google Books enrichment for better covers.
 * 
 * Usage:
 *   npx tsx scripts/reseed-curated.ts
 *   npx tsx scripts/reseed-curated.ts --dry-run    # Preview without changes
 *   npx tsx scripts/reseed-curated.ts --skip-enrich # Skip API enrichment (faster, for testing)
 * 
 * Environment:
 *   Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   Optionally set SEED_TOKEN for production protection
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { curatedBooks, type CuratedBookEntry } from "../lib/data/seed-curated-books";
import { enrichBookEntry, type EnrichedBookData } from "../lib/utils/external-book-search";
import { getOpenLibraryCoverByIsbn } from "../lib/utils/covers";

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

const BATCH_SIZE = 50; // Insert in batches
const ENRICH_DELAY_MS = 150; // Delay between API calls to avoid rate limiting
const ENRICH_BATCH_SIZE = 20; // Enrich in smaller batches with progress updates

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const skipEnrich = args.includes("--skip-enrich");

// ============================================
// TYPES
// ============================================

interface BookToInsert {
  title: string;
  author: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  isbn: string | null;
  published_date: string | null;
  page_count: number | null;
  genres: string[];
  google_books_id: string | null;
  open_library_id: string | null;
  open_library_cover_id: number | null;
  cover_source: "google" | "openlibrary" | null;
  average_rating: number | null;
  ratings_count: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Google Books returns dates in various formats: "1949", "2008-02", "2022-02-15"
 * Database expects full date format.
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

function generateSlug(title: string, existingSlugs: Set<string>): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
  
  let slug = base;
  let counter = 1;
  
  while (existingSlugs.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  
  existingSlugs.add(slug);
  return slug;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProgress(current: number, total: number): string {
  const percent = Math.round((current / total) * 100);
  const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
  return `[${bar}] ${percent}% (${current}/${total})`;
}

// ============================================
// ENRICHMENT
// ============================================

async function enrichBooks(
  books: CuratedBookEntry[]
): Promise<EnrichedBookData[]> {
  console.log(`\n📚 Enriching ${books.length} books with Google Books metadata...`);
  console.log(`   (This may take ~${Math.ceil((books.length * ENRICH_DELAY_MS) / 60000)} minutes)\n`);
  
  const results: EnrichedBookData[] = [];
  let googleCount = 0;
  let openLibraryCount = 0;
  let noEnrichCount = 0;
  
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    
    // Progress update every batch
    if (i % ENRICH_BATCH_SIZE === 0 || i === books.length - 1) {
      process.stdout.write(`\r   ${formatProgress(i + 1, books.length)} - "${book.title.substring(0, 30)}..."`);
    }
    
    const enriched = await enrichBookEntry({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genres: book.genres,
    });
    
    results.push(enriched);
    
    // Track stats
    if (enriched.googleBooksId) {
      googleCount++;
    } else if (enriched.openLibraryId) {
      openLibraryCount++;
    } else {
      noEnrichCount++;
    }
    
    // Rate limit
    if (i < books.length - 1) {
      await sleep(ENRICH_DELAY_MS);
    }
  }
  
  console.log(`\n\n   ✅ Enrichment complete:`);
  console.log(`      - Google Books: ${googleCount} (${Math.round((googleCount / books.length) * 100)}%)`);
  console.log(`      - Open Library: ${openLibraryCount} (${Math.round((openLibraryCount / books.length) * 100)}%)`);
  console.log(`      - No match: ${noEnrichCount} (${Math.round((noEnrichCount / books.length) * 100)}%)`);
  
  return results;
}

function createBookWithoutEnrichment(book: CuratedBookEntry): EnrichedBookData {
  // Use Open Library cover by ISBN as fallback if available
  const coverUrl = book.isbn ? getOpenLibraryCoverByIsbn(book.isbn, "L") : null;
  
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn || null,
    description: null,
    coverUrl,
    publishedDate: null,
    pageCount: null,
    genres: book.genres,
    googleBooksId: null,
    openLibraryId: null,
    openLibraryCoverId: null,
    coverSource: coverUrl ? "openlibrary" : null,
  };
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function clearExistingBooks(): Promise<void> {
  console.log("\n🗑️  Clearing existing books...");
  
  // First, check for dependent data
  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true });
  
  const { count: shelfCount } = await supabase
    .from("user_books")
    .select("*", { count: "exact", head: true });
  
  if (reviewCount && reviewCount > 0) {
    console.log(`   ⚠️  Found ${reviewCount} reviews - these will be deleted`);
  }
  
  if (shelfCount && shelfCount > 0) {
    console.log(`   ⚠️  Found ${shelfCount} shelf entries - these will be deleted`);
  }
  
  // Delete dependent data first (reviews, user_books, etc.)
  // The cascade should handle this, but let's be explicit
  const { error: reviewError } = await supabase.from("reviews").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (reviewError) {
    console.log(`   Note: Could not clear reviews (${reviewError.message})`);
  }
  
  const { error: shelfError } = await supabase.from("user_books").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (shelfError) {
    console.log(`   Note: Could not clear user_books (${shelfError.message})`);
  }
  
  // Delete review_likes if exists
  const { error: likesError } = await supabase.from("review_likes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (likesError) {
    // Table might not exist, that's ok
  }
  
  // Now delete books
  const { error: booksError } = await supabase
    .from("books")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  
  if (booksError) {
    console.error("   ❌ Failed to clear books:", booksError.message);
    throw booksError;
  }
  
  console.log("   ✅ Cleared existing books and related data");
}

async function insertBooks(books: BookToInsert[]): Promise<number> {
  console.log(`\n📥 Inserting ${books.length} books in batches of ${BATCH_SIZE}...`);
  
  let inserted = 0;
  let failed = 0;
  
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(books.length / BATCH_SIZE);
    
    const { error } = await supabase.from("books").insert(batch);
    
    if (error) {
      console.error(`   ❌ Batch ${batchNum}/${totalBatches} failed: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   ${formatProgress(inserted, books.length)} inserted`);
    }
    
    // Small delay between batches
    await sleep(50);
  }
  
  console.log(`\n   ✅ Inserted ${inserted} books (${failed} failed)`);
  return inserted;
}

// ============================================
// MAIN
// ============================================

async function reseedCurated(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║       CURATED BOOK RESEED - High-Signal Catalog        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  
  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }
  
  if (skipEnrich) {
    console.log("\n⏩ SKIP ENRICHMENT MODE - Using ISBN-based Open Library covers\n");
  }
  
  // Show stats
  console.log(`\n📊 Curated book list: ${curatedBooks.length} books`);
  
  // Count by genre
  const genreCounts = new Map<string, number>();
  for (const book of curatedBooks) {
    for (const genre of book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }
  
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log("\n   Top genres:");
  for (const [genre, count] of topGenres) {
    console.log(`   - ${genre}: ${count}`);
  }
  
  // Enrich or skip
  let enrichedBooks: EnrichedBookData[];
  
  if (skipEnrich) {
    enrichedBooks = curatedBooks.map(createBookWithoutEnrichment);
  } else {
    enrichedBooks = await enrichBooks(curatedBooks);
  }
  
  // Build books to insert
  console.log("\n🔧 Building book records...");
  
  const slugs = new Set<string>();
  const booksToInsert: BookToInsert[] = enrichedBooks.map((enriched, index) => {
    const original = curatedBooks[index];
    
    return {
      title: enriched.title,
      author: enriched.author,
      slug: generateSlug(enriched.title, slugs),
      description: enriched.description,
      cover_url: enriched.coverUrl,
      isbn: enriched.isbn,
      published_date: normalizeDate(enriched.publishedDate),
      page_count: enriched.pageCount,
      // Always prefer our curated genres over Google Books categories
      genres: original.genres.length > 0 ? original.genres : enriched.genres,
      google_books_id: enriched.googleBooksId,
      open_library_id: enriched.openLibraryId,
      open_library_cover_id: enriched.openLibraryCoverId,
      cover_source: enriched.coverSource,
      average_rating: null,
      ratings_count: 0,
    };
  });
  
  console.log(`   ✅ Prepared ${booksToInsert.length} books for insertion`);
  
  // Show enrichment stats
  const withGoogle = booksToInsert.filter(b => b.google_books_id).length;
  const withOpenLibrary = booksToInsert.filter(b => b.open_library_id && !b.google_books_id).length;
  const withCover = booksToInsert.filter(b => b.cover_url).length;
  
  console.log(`\n   📈 Enrichment stats:`);
  console.log(`      - With Google Books ID: ${withGoogle} (${Math.round((withGoogle / booksToInsert.length) * 100)}%)`);
  console.log(`      - With Open Library ID: ${withOpenLibrary} (${Math.round((withOpenLibrary / booksToInsert.length) * 100)}%)`);
  console.log(`      - With cover URL: ${withCover} (${Math.round((withCover / booksToInsert.length) * 100)}%)`);
  
  if (isDryRun) {
    console.log("\n🔍 DRY RUN - Skipping database operations");
    console.log("\n✨ Dry run complete! Run without --dry-run to apply changes.");
    return;
  }
  
  // Clear and insert
  await clearExistingBooks();
  const insertedCount = await insertBooks(booksToInsert);
  
  // Final summary
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                    RESEED COMPLETE                      ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\n   📚 Total books inserted: ${insertedCount}`);
  console.log(`   🎨 With Google covers: ${withGoogle}`);
  console.log(`   📖 With Open Library covers: ${booksToInsert.length - withGoogle}`);
  console.log(`\n✨ Done! Your catalog is now seeded with high-signal books.\n`);
}

// ============================================
// RUN
// ============================================

reseedCurated()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Reseed failed:", error);
    process.exit(1);
  });

