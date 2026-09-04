/**
 * Bulk Book Seeder
 * 
 * Seeds ~2000 books from Open Library by subject.
 * 
 * Usage:
 *   npx tsx scripts/seed-books.ts
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
// CONFIGURATION
// ============================================

// Subjects to seed from (each will fetch ~200-300 books)
const SUBJECTS = [
  "fiction",
  "fantasy",
  "science_fiction",
  "mystery",
  "romance",
  "thriller",
  "historical_fiction",
  "literary_fiction",
  "young_adult",
  "horror",
  "biography",
  "memoir",
  "history",
  "science",
  "self_help",
  "business",
  "philosophy",
  "psychology",
  "poetry",
  "classics",
];

const BOOKS_PER_SUBJECT = 100; // 20 subjects × 100 = 2000 books target
const BATCH_SIZE = 50; // Insert in batches

// ============================================
// TYPES
// ============================================

interface OpenLibraryWork {
  key: string;
  title: string;
  authors?: Array<{ key: string; name: string }>;
  cover_id?: number;
  first_publish_year?: number;
  subject?: string[];
  cover_edition_key?: string;
  availability?: {
    isbn?: string;
  };
}

interface OpenLibrarySubjectResponse {
  name: string;
  work_count: number;
  works: OpenLibraryWork[];
}

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
  open_library_id: string;
  open_library_cover_id: number | null;
  cover_source: "openlibrary";
  average_rating: number | null;
  ratings_count: number;
}

// ============================================
// HELPERS
// ============================================

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

function getOpenLibraryCoverUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchSubjectBooks(
  subject: string,
  limit: number
): Promise<OpenLibraryWork[]> {
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=${limit}`;
  
  console.log(`  Fetching ${subject}...`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Failed to fetch ${subject}: ${response.status}`);
      return [];
    }
    
    const data: OpenLibrarySubjectResponse = await response.json();
    console.log(`  Found ${data.works.length} works for ${subject}`);
    
    return data.works;
  } catch (error) {
    console.error(`  Error fetching ${subject}:`, error);
    return [];
  }
}

// ============================================
// MAIN SEEDING LOGIC
// ============================================

async function seedBooks(): Promise<void> {
  console.log("Starting book seeding...\n");
  
  // Track existing books by Open Library ID to avoid duplicates
  const { data: existingBooks } = await supabase
    .from("books")
    .select("open_library_id, slug")
    .not("open_library_id", "is", null);
  
  const existingOpenLibraryIds = new Set(
    existingBooks?.map((b) => b.open_library_id).filter(Boolean) || []
  );
  const existingSlugs = new Set(
    existingBooks?.map((b) => b.slug).filter(Boolean) || []
  );
  
  console.log(`Found ${existingOpenLibraryIds.size} existing books with Open Library IDs`);
  console.log(`Found ${existingSlugs.size} existing slugs\n`);
  
  const booksToInsert: BookToInsert[] = [];
  const seenSlugs = new Set<string>();
  
  // Fetch books from each subject
  for (const subject of SUBJECTS) {
    const works = await fetchSubjectBooks(subject, BOOKS_PER_SUBJECT);
    
    for (const work of works) {
      // Skip if already in database
      const openLibraryId = work.key.replace("/works/", "");
      if (existingOpenLibraryIds.has(openLibraryId)) {
        continue;
      }
      
      // Skip if no title or author
      if (!work.title || !work.authors?.[0]?.name) {
        continue;
      }
      
      // Generate slug and check for uniqueness
      let slug = generateSlug(work.title);
      let slugCounter = 1;
      while (seenSlugs.has(slug) || existingSlugs.has(slug)) {
        slug = `${generateSlug(work.title)}-${slugCounter}`;
        slugCounter++;
      }
      seenSlugs.add(slug);
      
      // Build book object
      const book: BookToInsert = {
        title: work.title,
        author: work.authors[0].name,
        slug,
        description: null,
        cover_url: work.cover_id ? getOpenLibraryCoverUrl(work.cover_id) : null,
        isbn: work.availability?.isbn || null,
        published_date: work.first_publish_year
          ? `${work.first_publish_year}-01-01`
          : null,
        page_count: null,
        genres: [normalizeSubject(subject)],
        google_books_id: null,
        open_library_id: openLibraryId,
        open_library_cover_id: work.cover_id || null,
        cover_source: "openlibrary",
        average_rating: null,
        ratings_count: 0,
      };
      
      booksToInsert.push(book);
    }
    
    // Rate limit: wait between subjects
    await sleep(500);
  }
  
  console.log(`\nPrepared ${booksToInsert.length} books to insert\n`);
  
  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < booksToInsert.length; i += BATCH_SIZE) {
    const batch = booksToInsert.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase.from("books").insert(batch);
    
    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      // Continue with next batch
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${inserted}/${booksToInsert.length} books`);
    }
    
    // Small delay between batches
    await sleep(100);
  }
  
  console.log(`\n✅ Done! Inserted ${inserted} books.`);
}

// ============================================
// RUN
// ============================================

seedBooks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });

