/**
 * Import Ratings from Open Library
 *
 * Fetches ratings from Open Library for all books in the catalog
 * and updates the average_rating and ratings_count fields.
 *
 * Usage:
 *   npx tsx scripts/import-ratings.ts
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
  isbn: string | null;
  open_library_id: string | null;
  average_rating: number | null;
  ratings_count: number;
}

interface OpenLibraryRatings {
  average: number | null;
  count: number;
}

// ============================================
// OPEN LIBRARY API
// ============================================

/**
 * Fetch ratings from Open Library for a work ID
 */
async function getOpenLibraryRatings(
  workId: string
): Promise<OpenLibraryRatings | null> {
  try {
    // Normalize work ID - handle different formats
    let fullWorkId = workId;
    if (!workId.startsWith("OL")) {
      fullWorkId = `OL${workId}W`;
    }
    if (!fullWorkId.endsWith("W")) {
      fullWorkId = `${fullWorkId}W`;
    }

    const response = await fetch(
      `https://openlibrary.org/works/${fullWorkId}/ratings.json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.summary) {
      return {
        average: data.summary.average || null,
        count: data.summary.count || 0,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching ratings for ${workId}:`, error);
    return null;
  }
}

/**
 * Search Open Library by title + author to find work ID and ratings
 */
async function searchOpenLibraryForRatings(
  title: string,
  author: string
): Promise<{ workId: string; ratings: OpenLibraryRatings } | null> {
  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", title);
    url.searchParams.set("author", author);
    // Five, not one. The top hit is often a box set, an omnibus or a
    // translation carrying no ratings while the canonical work a couple of
    // places down carries thousands. Taking docs[0] is why several books came
    // back "no ratings found" when the ratings plainly exist.
    url.searchParams.set("limit", "5");
    url.searchParams.set("fields", "key,ratings_average,ratings_count");

    const response = await fetch(url.toString());

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return null;
    }

    interface SearchDoc {
      key: string;
      ratings_average?: number;
      ratings_count?: number;
    }

    // Most-rated wins, which approximates "the edition everyone actually read".
    const rated = (data.docs as SearchDoc[])
      .filter((doc) => doc.key && (doc.ratings_count ?? 0) > 0)
      .sort((a, b) => (b.ratings_count ?? 0) - (a.ratings_count ?? 0))[0];

    if (rated) {
      return {
        workId: rated.key.replace("/works/", ""),
        ratings: {
          average: rated.ratings_average ?? null,
          count: rated.ratings_count ?? 0,
        },
      };
    }

    // Search returned no ratings inline; ask the ratings endpoint about each
    // candidate in turn, since the counts above can lag the work record.
    for (const doc of data.docs as SearchDoc[]) {
      if (!doc.key) continue;
      const workId = doc.key.replace("/works/", "");
      const ratings = await getOpenLibraryRatings(workId);
      if (ratings && ratings.count > 0) {
        return { workId, ratings };
      }
    }

    return null;
  } catch (error) {
    console.error(`Error searching for ${title} by ${author}:`, error);
    return null;
  }
}

// ============================================
// MAIN IMPORT LOGIC
// ============================================

async function importRatings() {
  console.log("📚 Starting Open Library ratings import...\n");

  // Fetch all books from the database
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, isbn, open_library_id, average_rating, ratings_count")
    .order("title");

  if (error) {
    console.error("Error fetching books:", error);
    process.exit(1);
  }

  if (!books || books.length === 0) {
    console.log("No books found in database.");
    process.exit(0);
  }

  console.log(`Found ${books.length} books in catalog.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i] as Book;
    const progress = `[${i + 1}/${books.length}]`;

    // Skip books that already have ratings (unless they have 0 count)
    if (book.average_rating !== null && book.ratings_count > 0) {
      console.log(`${progress} ⏭️  ${book.title} - already has ${book.ratings_count} ratings`);
      skipped++;
      continue;
    }

    let ratings: OpenLibraryRatings | null = null;
    let workId = book.open_library_id;

    // Strategy 1: Use existing Open Library ID
    if (workId) {
      ratings = await getOpenLibraryRatings(workId);
    }

    // Strategy 2: Search by title + author.
    //
    // Also runs when Strategy 1 returned a *zero-count* summary, not just when
    // it returned nothing. Open Library serves `{average: 0, count: 0}` for a
    // work whose ratings live under a different work id -- the stored id for
    // Dune is one digit off the one carrying its 443 ratings -- and the old
    // `if (!ratings)` treated that as an answer, so the search never ran and
    // the book was reported as "no ratings found". That is why 20 books were
    // left unrated after the task 13 incident.
    if (!ratings || ratings.count === 0) {
      const result = await searchOpenLibraryForRatings(book.title, book.author);
      if (result && result.ratings.count > 0) {
        ratings = result.ratings;
        workId = result.workId;
      }
    }

    // Update the book if we found ratings
    if (ratings && ratings.count > 0) {
      // Writes only the EXTERNAL pair. `local_average_rating` /
      // `local_ratings_count` belong to public.reviews and are maintained by
      // the trigger from migration 063 -- an import must never touch them.
      const { error: updateError } = await supabase
        .from("books")
        .update({
          average_rating: ratings.average ? Math.round(ratings.average * 10) / 10 : null,
          ratings_count: ratings.count,
          // Also save the Open Library ID if we found it
          ...(workId && !book.open_library_id ? { open_library_id: workId } : {}),
        })
        .eq("id", book.id);

      if (updateError) {
        console.log(`${progress} ❌ ${book.title} - update failed: ${updateError.message}`);
        failed++;
      } else {
        console.log(
          `${progress} ✅ ${book.title} - ${ratings.average?.toFixed(1) || "?"} ★ (${ratings.count} ratings)`
        );
        updated++;
      }
    } else {
      console.log(`${progress} ⚠️  ${book.title} - no ratings found on Open Library`);
      failed++;
    }

    // Rate limit: wait 300ms between requests to avoid overwhelming the API
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Import Summary");
  console.log("=".repeat(50));
  console.log(`✅ Updated: ${updated} books`);
  console.log(`⏭️  Skipped: ${skipped} books (already have ratings)`);
  console.log(`⚠️  No ratings found: ${failed} books`);
  console.log("=".repeat(50) + "\n");
}

// Run the import
importRatings().catch(console.error);
