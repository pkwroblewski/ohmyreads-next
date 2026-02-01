/**
 * Award Winners Import Script
 *
 * Imports award-winning books from Open Library subject endpoints,
 * enriches them with Google Books data for better covers/descriptions,
 * and adds them to the catalog with award tags.
 *
 * Usage:
 *   npx tsx scripts/import-award-winners.ts                    # Import all awards (default limit per award)
 *   npx tsx scripts/import-award-winners.ts --dry-run          # Preview without changes
 *   npx tsx scripts/import-award-winners.ts --award pulitzer   # Import only Pulitzer winners
 *   npx tsx scripts/import-award-winners.ts --limit 20         # Import 20 books per award
 *   npx tsx scripts/import-award-winners.ts --verbose          # Show detailed output
 *   npx tsx scripts/import-award-winners.ts --list             # List available awards
 *
 * Environment:
 *   Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { enrichBookEntry, normalizeTitle, normalizeAuthor } from "../lib/utils/external-book-search";
import { generateSlug } from "../lib/utils/slug";

// Load environment variables
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// AWARD DEFINITIONS
// ============================================

interface AwardDefinition {
  name: string;
  displayName: string;
  subject: string;
  tag: string;
}

const AWARDS: Record<string, AwardDefinition> = {
  pulitzer: {
    name: "pulitzer",
    displayName: "Pulitzer Prize",
    subject: "pulitzer_prize",
    tag: "Pulitzer Prize",
  },
  hugo: {
    name: "hugo",
    displayName: "Hugo Award",
    subject: "hugo_award",
    tag: "Hugo Award",
  },
  booker: {
    name: "booker",
    displayName: "Man Booker Prize",
    subject: "man_booker_prize",
    tag: "Man Booker Prize",
  },
  national_book: {
    name: "national_book",
    displayName: "National Book Award",
    subject: "national_book_award",
    tag: "National Book Award",
  },
  newbery: {
    name: "newbery",
    displayName: "Newbery Medal",
    subject: "newbery_medal",
    tag: "Newbery Medal",
  },
  caldecott: {
    name: "caldecott",
    displayName: "Caldecott Medal",
    subject: "caldecott_medal",
    tag: "Caldecott Medal",
  },
  nebula: {
    name: "nebula",
    displayName: "Nebula Award",
    subject: "nebula_award",
    tag: "Nebula Award",
  },
};

// ============================================
// CONFIGURATION
// ============================================

const API_DELAY_MS = 300; // Delay between API calls
const DEFAULT_LIMIT_PER_AWARD = 50; // Default books per award

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const showList = args.includes("--list");

// Parse --award <name>
const awardIndex = args.indexOf("--award");
const selectedAward = awardIndex !== -1 && args[awardIndex + 1]
  ? args[awardIndex + 1]
  : null;

// Parse --limit N
const limitIndex = args.indexOf("--limit");
const limitPerAward = limitIndex !== -1 && args[limitIndex + 1]
  ? parseInt(args[limitIndex + 1], 10)
  : DEFAULT_LIMIT_PER_AWARD;

// ============================================
// TYPES
// ============================================

interface OpenLibrarySubjectWork {
  key: string; // "/works/OL123456W"
  title: string;
  authors?: Array<{ name: string; key: string }>;
  cover_id?: number;
  first_publish_year?: number;
  subject?: string[];
  ia?: string[]; // Internet Archive IDs
}

interface OpenLibrarySubjectResponse {
  name: string;
  work_count: number;
  works: OpenLibrarySubjectWork[];
}

interface ImportResult {
  title: string;
  author: string;
  status: "imported" | "duplicate" | "skipped" | "failed";
  reason?: string;
  bookId?: string;
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

// ============================================
// OPEN LIBRARY API
// ============================================

/**
 * Fetch books from an Open Library subject endpoint
 */
async function fetchAwardBooks(subject: string, limit: number): Promise<OpenLibrarySubjectWork[]> {
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=${limit}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch subject ${subject}: ${response.status}`);
      return [];
    }

    const data: OpenLibrarySubjectResponse = await response.json();
    return data.works || [];
  } catch (error) {
    console.error(`Error fetching subject ${subject}:`, error);
    return [];
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

interface ExistingBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  genres: string[];
}

/**
 * Check if a book already exists in the database
 * Returns the existing book if found, null otherwise
 */
async function findExistingBook(
  title: string,
  author: string,
  isbn: string | null
): Promise<ExistingBook | null> {
  // 1. Check by ISBN first (most reliable)
  if (isbn) {
    const { data: byIsbn } = await supabase
      .from("books")
      .select("id, title, author, isbn, genres")
      .eq("isbn", isbn)
      .single();

    if (byIsbn) return byIsbn as ExistingBook;
  }

  // 2. Check by normalized title + author
  const normalizedTitle = normalizeTitle(title);
  const normalizedAuthor = normalizeAuthor(author);

  // Fetch books with similar titles and filter in application
  const { data: candidates } = await supabase
    .from("books")
    .select("id, title, author, isbn, genres")
    .ilike("title", `%${title.split(" ")[0]}%`)
    .limit(20);

  if (candidates) {
    for (const book of candidates) {
      const bookNormalizedTitle = normalizeTitle(book.title);
      const bookNormalizedAuthor = normalizeAuthor(book.author);

      // Check for fuzzy match
      if (
        bookNormalizedTitle === normalizedTitle ||
        bookNormalizedTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(bookNormalizedTitle)
      ) {
        if (
          bookNormalizedAuthor === normalizedAuthor ||
          bookNormalizedAuthor.includes(normalizedAuthor) ||
          normalizedAuthor.includes(bookNormalizedAuthor)
        ) {
          return book as ExistingBook;
        }
      }
    }
  }

  return null;
}

/**
 * Generate a unique slug for a book
 */
async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

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

  return slug;
}

/**
 * Insert a new book into the database
 */
async function insertBook(bookData: {
  title: string;
  author: string;
  slug: string;
  description: string | null;
  isbn: string | null;
  cover_url: string | null;
  page_count: number | null;
  published_date: string | null;
  genres: string[];
  google_books_id: string | null;
  open_library_id: string | null;
  open_library_cover_id: number | null;
  cover_source: "google" | "openlibrary" | null;
}): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("books")
    .insert(bookData)
    .select("id")
    .single();

  if (error) {
    console.error("Insert error:", error.message);
    return null;
  }

  return data;
}

/**
 * Add award tag to existing book's genres if not already present
 */
async function addAwardTagToBook(bookId: string, currentGenres: string[], awardTag: string): Promise<boolean> {
  if (currentGenres.includes(awardTag)) {
    return false; // Already has this award tag
  }

  const updatedGenres = [...currentGenres, awardTag];

  const { error } = await supabase
    .from("books")
    .update({ genres: updatedGenres })
    .eq("id", bookId);

  return !error;
}

// ============================================
// IMPORT LOGIC
// ============================================

async function importAwardWinners(award: AwardDefinition, limit: number): Promise<ImportResult[]> {
  console.log(`\n📚 Fetching ${award.displayName} winners from Open Library...`);

  const works = await fetchAwardBooks(award.subject, limit);

  if (works.length === 0) {
    console.log(`   No books found for ${award.displayName}`);
    return [];
  }

  console.log(`   Found ${works.length} books`);

  const results: ImportResult[] = [];

  for (let i = 0; i < works.length; i++) {
    const work = works[i];
    const title = work.title;
    const author = work.authors?.[0]?.name || "Unknown Author";

    // Progress update
    process.stdout.write(`\r   ${formatProgress(i + 1, works.length)} - "${title.substring(0, 40)}..."`);

    // Skip books without authors (likely anthologies or compilations)
    if (!work.authors || work.authors.length === 0) {
      results.push({
        title,
        author: "Unknown",
        status: "skipped",
        reason: "No author information",
      });
      await sleep(API_DELAY_MS);
      continue;
    }

    // Check for existing book
    const existing = await findExistingBook(title, author, null);

    if (existing) {
      // Book exists - just add award tag if needed
      if (!isDryRun) {
        const tagAdded = await addAwardTagToBook(existing.id, existing.genres || [], award.tag);
        if (tagAdded && isVerbose) {
          console.log(`\n      Added "${award.tag}" tag to existing book`);
        }
      }

      results.push({
        title,
        author,
        status: "duplicate",
        reason: existing.genres?.includes(award.tag) ? "Already has award tag" : "Added award tag to existing",
        bookId: existing.id,
      });

      await sleep(API_DELAY_MS);
      continue;
    }

    // Enrich with Google Books for better data
    const enriched = await enrichBookEntry({
      title,
      author,
      genres: [award.tag],
    });

    // Merge award tag with enriched genres
    const genres = enriched.genres.includes(award.tag)
      ? enriched.genres
      : [award.tag, ...enriched.genres];

    // Skip if no cover found (likely not a real book or very obscure)
    if (!enriched.coverUrl && !work.cover_id) {
      results.push({
        title,
        author,
        status: "skipped",
        reason: "No cover image available",
      });
      await sleep(API_DELAY_MS);
      continue;
    }

    // Prepare book data
    const slug = await generateUniqueSlug(title);
    const openLibraryId = work.key.replace("/works/", "");

    // Determine cover URL
    let coverUrl = enriched.coverUrl;
    let coverSource: "google" | "openlibrary" | null = enriched.coverSource;

    if (!coverUrl && work.cover_id) {
      coverUrl = `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg`;
      coverSource = "openlibrary";
    }

    // Normalize published date to YYYY-MM-DD format
    let publishedDate: string | null = null;
    const rawDate = enriched.publishedDate;

    if (rawDate) {
      // Handle various date formats: "1980", "1997-09", "1997-09-15", "October 1997"
      if (/^\d{4}$/.test(rawDate)) {
        // Year only: "1980" -> "1980-01-01"
        publishedDate = `${rawDate}-01-01`;
      } else if (/^\d{4}-\d{2}$/.test(rawDate)) {
        // Year-month: "1997-09" -> "1997-09-01"
        publishedDate = `${rawDate}-01`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        // Already valid: "1997-09-15"
        publishedDate = rawDate;
      }
      // Otherwise skip invalid date formats
    }

    if (!publishedDate && work.first_publish_year) {
      publishedDate = `${work.first_publish_year}-01-01`;
    }

    const bookData = {
      title: enriched.title || title,
      author: enriched.author || author,
      slug,
      description: enriched.description,
      isbn: enriched.isbn,
      cover_url: coverUrl,
      page_count: enriched.pageCount,
      published_date: publishedDate,
      genres,
      google_books_id: enriched.googleBooksId,
      open_library_id: enriched.openLibraryId || openLibraryId,
      open_library_cover_id: enriched.openLibraryCoverId || work.cover_id || null,
      cover_source: coverSource,
    };

    if (!isDryRun) {
      const inserted = await insertBook(bookData);

      if (inserted) {
        results.push({
          title: bookData.title,
          author: bookData.author,
          status: "imported",
          bookId: inserted.id,
        });

        if (isVerbose) {
          console.log(`\n      Imported: ${bookData.title}`);
        }
      } else {
        results.push({
          title: bookData.title,
          author: bookData.author,
          status: "failed",
          reason: "Database insert failed",
        });
      }
    } else {
      results.push({
        title: bookData.title,
        author: bookData.author,
        status: "imported",
        reason: "Would import (dry-run)",
      });

      if (isVerbose) {
        console.log(`\n      Would import: ${bookData.title}`);
      }
    }

    await sleep(API_DELAY_MS);
  }

  console.log(""); // New line after progress bar

  return results;
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║         AWARD WINNERS IMPORT - Curated Books           ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  // Show list of awards
  if (showList) {
    console.log("\nAvailable awards:");
    for (const [key, award] of Object.entries(AWARDS)) {
      console.log(`  --award ${key.padEnd(15)} ${award.displayName}`);
    }
    return;
  }

  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Determine which awards to import
  const awardsToImport: AwardDefinition[] = [];

  if (selectedAward) {
    const award = AWARDS[selectedAward];
    if (!award) {
      console.error(`\n❌ Unknown award: ${selectedAward}`);
      console.log("\nAvailable awards:");
      for (const key of Object.keys(AWARDS)) {
        console.log(`  --award ${key}`);
      }
      process.exit(1);
    }
    awardsToImport.push(award);
  } else {
    // Import all awards
    awardsToImport.push(...Object.values(AWARDS));
  }

  console.log(`\n📋 Awards to import: ${awardsToImport.map(a => a.displayName).join(", ")}`);
  console.log(`   Limit per award: ${limitPerAward}`);

  // Process each award
  const allResults: { award: string; results: ImportResult[] }[] = [];

  for (const award of awardsToImport) {
    const results = await importAwardWinners(award, limitPerAward);
    allResults.push({ award: award.displayName, results });
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                    IMPORT COMPLETE                      ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  let totalImported = 0;
  let totalDuplicate = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const { award, results } of allResults) {
    const imported = results.filter(r => r.status === "imported").length;
    const duplicate = results.filter(r => r.status === "duplicate").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const failed = results.filter(r => r.status === "failed").length;

    console.log(`\n   📚 ${award}:`);
    console.log(`      - Imported: ${imported}`);
    console.log(`      - Already exists: ${duplicate}`);
    console.log(`      - Skipped: ${skipped}`);
    if (failed > 0) console.log(`      - Failed: ${failed}`);

    totalImported += imported;
    totalDuplicate += duplicate;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  console.log("\n   ═══════════════════════════════════════");
  console.log(`   📊 TOTAL:`);
  console.log(`      - Imported: ${totalImported} books`);
  console.log(`      - Already exists: ${totalDuplicate} books`);
  console.log(`      - Skipped: ${totalSkipped} books`);
  if (totalFailed > 0) console.log(`      - Failed: ${totalFailed} books`);

  if (isDryRun) {
    console.log(`\n   🔍 DRY RUN - No actual changes were made`);
    console.log(`      Run without --dry-run to import books.`);
  }

  // Show failed books in verbose mode
  if (isVerbose && totalFailed > 0) {
    console.log("\n   ⚠️  Failed imports:");
    for (const { results } of allResults) {
      for (const r of results.filter(r => r.status === "failed")) {
        console.log(`   - "${r.title}" by ${r.author}: ${r.reason}`);
      }
    }
  }

  console.log("\n✨ Done!\n");
}

// ============================================
// RUN
// ============================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  });
