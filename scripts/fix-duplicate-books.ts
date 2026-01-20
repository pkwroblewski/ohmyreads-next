/**
 * Duplicate Book Fixer
 *
 * Finds and fixes duplicate books in the database.
 * Duplicates are identified by similar titles (case-insensitive, normalized).
 *
 * Usage:
 *   npx tsx scripts/fix-duplicate-books.ts --audit     # Just show duplicates
 *   npx tsx scripts/fix-duplicate-books.ts --fix       # Fix duplicates (merge + delete)
 *
 * Environment:
 *   Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// TYPES
// ============================================

interface Book {
  id: string;
  title: string;
  author: string;
  slug: string;
  created_at: string;
  ratings_count: number;
  average_rating: number | null;
  cover_url: string | null;
}

interface DuplicateGroup {
  normalizedTitle: string;
  books: Book[];
  canonical: Book;
  duplicates: Book[];
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalize a title for comparison
 * - Lowercase
 * - Remove special characters
 * - Collapse whitespace
 * - Remove common suffixes like "(Book 1)", "#1", etc.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove special chars
    .replace(/\s+/g, " ")    // Collapse whitespace
    .replace(/\b(book|volume|vol|part|#)\s*\d+\b/gi, "") // Remove "Book 1", etc.
    .replace(/\s*\d+\s*$/, "") // Remove trailing numbers
    .trim();
}

/**
 * Choose the canonical book from a group of duplicates
 * Priority: more reviews > older creation date > has cover
 */
function chooseCanonical(books: Book[]): Book {
  return books.sort((a, b) => {
    // Prefer books with more ratings
    if (a.ratings_count !== b.ratings_count) {
      return b.ratings_count - a.ratings_count;
    }
    // Prefer older books (likely the original)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

// ============================================
// MAIN FUNCTIONS
// ============================================

async function findDuplicates(): Promise<DuplicateGroup[]> {
  console.log("Fetching all books...");

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, slug, created_at, ratings_count, average_rating, cover_url")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch books: ${error.message}`);
  }

  console.log(`Found ${books?.length || 0} books total`);

  // Group books by normalized title
  const groups = new Map<string, Book[]>();

  for (const book of books || []) {
    const normalized = normalizeTitle(book.title);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(book);
  }

  // Find groups with duplicates (more than 1 book)
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [normalizedTitle, groupBooks] of groups) {
    if (groupBooks.length > 1) {
      // Further filter: same author (normalized)
      const byAuthor = new Map<string, Book[]>();
      for (const book of groupBooks) {
        const normalizedAuthor = book.author.toLowerCase().trim();
        if (!byAuthor.has(normalizedAuthor)) {
          byAuthor.set(normalizedAuthor, []);
        }
        byAuthor.get(normalizedAuthor)!.push(book);
      }

      for (const authorBooks of byAuthor.values()) {
        if (authorBooks.length > 1) {
          const canonical = chooseCanonical(authorBooks);
          duplicateGroups.push({
            normalizedTitle,
            books: authorBooks,
            canonical,
            duplicates: authorBooks.filter(b => b.id !== canonical.id),
          });
        }
      }
    }
  }

  return duplicateGroups;
}

async function auditDuplicates(): Promise<void> {
  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    console.log("\n✅ No duplicate books found!");
    return;
  }

  console.log(`\n⚠️  Found ${duplicates.length} duplicate groups:\n`);

  for (const group of duplicates) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Title: "${group.books[0].title}" by ${group.books[0].author}`);
    console.log(`Normalized: "${group.normalizedTitle}"`);
    console.log(`\n  CANONICAL (keep):`);
    console.log(`    ID: ${group.canonical.id}`);
    console.log(`    Slug: ${group.canonical.slug}`);
    console.log(`    Ratings: ${group.canonical.ratings_count}`);
    console.log(`    Created: ${group.canonical.created_at}`);

    console.log(`\n  DUPLICATES (remove):`);
    for (const dup of group.duplicates) {
      console.log(`    ID: ${dup.id}`);
      console.log(`    Slug: ${dup.slug}`);
      console.log(`    Ratings: ${dup.ratings_count}`);
      console.log(`    Created: ${dup.created_at}`);
      console.log();
    }
  }

  const totalDuplicates = duplicates.reduce((sum, g) => sum + g.duplicates.length, 0);
  console.log(`\n📊 Summary:`);
  console.log(`   ${duplicates.length} duplicate groups`);
  console.log(`   ${totalDuplicates} duplicate books to remove`);
  console.log(`\nRun with --fix to merge and remove duplicates.`);
}

async function fixDuplicates(): Promise<void> {
  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    console.log("\n✅ No duplicate books found!");
    return;
  }

  console.log(`\n🔧 Fixing ${duplicates.length} duplicate groups...\n`);

  let fixed = 0;
  let errors = 0;

  for (const group of duplicates) {
    console.log(`Processing: "${group.books[0].title}"...`);

    try {
      // 1. Move user_books references to canonical
      for (const dup of group.duplicates) {
        const { error: userBooksError } = await supabase
          .from("user_books")
          .update({ book_id: group.canonical.id })
          .eq("book_id", dup.id);

        if (userBooksError && !userBooksError.message.includes("duplicate")) {
          console.warn(`  Warning updating user_books: ${userBooksError.message}`);
        }
      }

      // 2. Move reviews to canonical
      for (const dup of group.duplicates) {
        const { error: reviewsError } = await supabase
          .from("reviews")
          .update({ book_id: group.canonical.id })
          .eq("book_id", dup.id);

        if (reviewsError && !reviewsError.message.includes("duplicate")) {
          console.warn(`  Warning updating reviews: ${reviewsError.message}`);
        }
      }

      // 3. Move reading list items to canonical
      for (const dup of group.duplicates) {
        const { error: listItemsError } = await supabase
          .from("reading_list_items")
          .update({ book_id: group.canonical.id })
          .eq("book_id", dup.id);

        if (listItemsError && !listItemsError.message.includes("duplicate")) {
          console.warn(`  Warning updating reading_list_items: ${listItemsError.message}`);
        }
      }

      // 4. Move book club reads to canonical
      for (const dup of group.duplicates) {
        const { error: clubReadsError } = await supabase
          .from("book_club_reads")
          .update({ book_id: group.canonical.id })
          .eq("book_id", dup.id);

        if (clubReadsError && !clubReadsError.message.includes("duplicate")) {
          console.warn(`  Warning updating book_club_reads: ${clubReadsError.message}`);
        }
      }

      // 5. Delete duplicate books
      for (const dup of group.duplicates) {
        const { error: deleteError } = await supabase
          .from("books")
          .delete()
          .eq("id", dup.id);

        if (deleteError) {
          throw new Error(`Failed to delete ${dup.id}: ${deleteError.message}`);
        }
      }

      console.log(`  ✅ Merged ${group.duplicates.length} duplicate(s) into ${group.canonical.slug}`);
      fixed++;
    } catch (err) {
      console.error(`  ❌ Error: ${err}`);
      errors++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Fixed: ${fixed} groups`);
  console.log(`   ❌ Errors: ${errors} groups`);
}

// ============================================
// CLI
// ============================================

const args = process.argv.slice(2);

if (args.includes("--fix")) {
  fixDuplicates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
} else if (args.includes("--audit") || args.length === 0) {
  auditDuplicates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
} else {
  console.log(`
Usage:
  npx tsx scripts/fix-duplicate-books.ts --audit   # Show duplicates (default)
  npx tsx scripts/fix-duplicate-books.ts --fix     # Fix duplicates
  `);
  process.exit(1);
}
