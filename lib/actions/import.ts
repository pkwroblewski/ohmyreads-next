"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import {
  parseGoodreadsCSV,
  mapGoodreadsShelf,
  type GoodreadsRow,
} from "@/lib/utils/csv-parser";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { goodreadsRowsSchema } from "@/lib/validation/import";
import { reportError } from "@/lib/utils/log";

export interface ImportResult {
  success: boolean;
  matched: number;
  notFound: number;
  skipped: number;
  errors: string[];
  notFoundBooks: Array<{
    title: string;
    author: string;
    isbn13: string;
  }>;
  matchedBooks: Array<{
    title: string;
    author: string;
    status: string;
  }>;
}

/**
 * Validates and sanitizes ISBN - only allows digits and dashes
 * Returns null if invalid format
 */
function validateISBN(isbn: string | undefined | null): string | null {
  if (!isbn || typeof isbn !== "string") return null;

  // Only allow digits and dashes
  if (!/^[\d-]+$/.test(isbn)) return null;

  // Remove dashes and check length (ISBN-10 or ISBN-13)
  const digits = isbn.replace(/-/g, "");
  if (digits.length !== 10 && digits.length !== 13) return null;

  return digits;
}

/**
 * Normalize a string for fuzzy matching
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // Remove punctuation, keep any script's letters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Check if two strings are similar enough for a match
 */
function isSimilar(a: string, b: string): boolean {
  const normA = normalize(a);
  const normB = normalize(b);

  // An empty string would "contain" in everything
  if (!normA || !normB) return false;

  // Exact match after normalization
  if (normA === normB) return true;

  // One contains the other (for subtitle variations), unless the shorter is too
  // short to mean anything
  const [shorter, longer] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  return shorter.length >= 4 && longer.includes(shorter);
}

/**
 * Leading words of a title, before any punctuation (subtitle, series, apostrophe),
 * as a PostgREST ilike pattern: a prefix when long enough, else the exact title
 */
function titlePattern(title: string): string | null {
  const lead = title
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .match(/^[\p{L}\p{N} ]+/u)?.[0]
    .trim();
  if (!lead) return null;
  return lead.length >= 4 ? `${lead}*` : lead;
}

/**
 * Import books from Goodreads CSV
 */
export async function importFromGoodreads(
  csvContent: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    matched: 0,
    notFound: 0,
    skipped: 0,
    errors: [],
    notFoundBooks: [],
    matchedBooks: [],
  };

  try {
    const auth = await requireUser();
    if (!auth.ok) {
      result.errors.push(auth.error);
      return result;
    }
    const { supabase, user } = auth;

    // Rate limit: 3 imports per minute per user (imports are heavy)
    const { allowed } = await checkRateLimit(`import:${user.id}`, 3, 60000);
    if (!allowed) {
      result.errors.push("Too many imports. Please wait a moment.");
      return result;
    }

    // Parse CSV
    let rows: GoodreadsRow[];
    try {
      rows = parseGoodreadsCSV(csvContent);
    } catch (e) {
      result.errors.push(
        `Failed to parse CSV: ${e instanceof Error ? e.message : "Unknown error"}`
      );
      return result;
    }

    if (rows.length === 0) {
      result.errors.push("No books found in CSV");
      return result;
    }

    // Validate parsed rows with Zod (row cap + per-row field bounds)
    const validationResult = goodreadsRowsSchema.safeParse(rows);
    if (!validationResult.success) {
      result.errors.push(
        validationResult.error.issues[0]?.message || "Invalid CSV data"
      );
      return result;
    }
    rows = validationResult.data;

    // Step 1: Collect all valid ISBNs from CSV for efficient batch query
    const isbnList = rows
      .flatMap((r) => [r.isbn, r.isbn13])
      .map((isbn) => validateISBN(isbn))
      .filter((v): v is string => v !== null);

    // Deduplicate ISBNs
    const uniqueISBNs = [...new Set(isbnList)];

    // Query books matching any of the ISBNs using .in() filter
    const booksByISBN = new Map<string, { id: string; title: string; author: string; isbn: string | null }>();

    if (uniqueISBNs.length > 0) {
      // Query in chunks of 500 to avoid query limits
      const chunkSize = 500;
      for (let i = 0; i < uniqueISBNs.length; i += chunkSize) {
        const chunk = uniqueISBNs.slice(i, i + chunkSize);
        const { data: matchedBooks } = await supabase
          .from("books")
          .select("id, title, author, isbn")
          .in("isbn", chunk);

        for (const book of matchedBooks || []) {
          if (book.isbn) {
            const cleanISBN = book.isbn.replace(/-/g, "");
            booksByISBN.set(cleanISBN, book);
            booksByISBN.set(book.isbn, book);
          }
        }
      }
    }

    // Step 2: For title matching, we need to load books that weren't matched by ISBN
    // Only load if there are unmatched rows to reduce memory usage
    const unmatchedRows = rows.filter((row) => {
      const cleanISBN13 = validateISBN(row.isbn13);
      if (cleanISBN13 && booksByISBN.has(cleanISBN13)) return false;

      const cleanISBN = validateISBN(row.isbn);
      if (cleanISBN && booksByISBN.has(cleanISBN)) return false;

      return true;
    });

    // Load title-match candidates by each unmatched title's leading words, rather
    // than the catalog, which PostgREST would cut off at 1,000 rows
    const booksByNormalizedTitle = new Map<string, { id: string; title: string; author: string; isbn: string | null }[]>();
    const allBooksForTitleMatch: { id: string; title: string; author: string; isbn: string | null }[] = [];

    const titlePatterns = [
      ...new Set(
        unmatchedRows
          .map((row) => titlePattern(row.title))
          .filter((p): p is string => p !== null)
      ),
    ];
    const seenCandidateIds = new Set<string>();
    const patternChunkSize = 50;
    for (let i = 0; i < titlePatterns.length; i += patternChunkSize) {
      const chunk = titlePatterns.slice(i, i + patternChunkSize);
      // Patterns hold only letters, digits and spaces, so quoting is enough
      const { data: candidates } = await supabase
        .from("books")
        .select("id, title, author, isbn")
        .or(chunk.map((p) => `title.ilike."${p}"`).join(","));

      for (const book of candidates || []) {
        if (seenCandidateIds.has(book.id)) continue;
        seenCandidateIds.add(book.id);
        allBooksForTitleMatch.push(book);
      }
    }

    for (const book of allBooksForTitleMatch) {
      const normalizedTitle = normalize(book.title);
      if (!booksByNormalizedTitle.has(normalizedTitle)) {
        booksByNormalizedTitle.set(normalizedTitle, []);
      }
      booksByNormalizedTitle.get(normalizedTitle)!.push(book);
    }

    // Process each row
    const booksToAdd: Array<{
      user_id: string;
      book_id: string;
      status: string;
      rating: number | null;
      started_at: string | null;
      finished_at: string | null;
    }> = [];

    type BookMatch = { id: string; title: string; author: string; isbn: string | null };

    const findMatch = (row: GoodreadsRow): BookMatch | undefined => {
      let matchedBook: BookMatch | undefined;

      // 1. Try ISBN13 first (most reliable)
      const cleanISBN13 = validateISBN(row.isbn13);
      if (cleanISBN13) {
        matchedBook = booksByISBN.get(cleanISBN13);
      }

      // 2. Try ISBN if no ISBN13 match
      if (!matchedBook) {
        const cleanISBN = validateISBN(row.isbn);
        if (cleanISBN) {
          matchedBook = booksByISBN.get(cleanISBN);
        }
      }

      // 3. Try title + author fuzzy match (only if title matching data was loaded)
      if (!matchedBook && allBooksForTitleMatch.length > 0) {
        const normalizedTitle = normalize(row.title);
        const candidates = normalizedTitle
          ? booksByNormalizedTitle.get(normalizedTitle) || []
          : [];

        // Check if any candidate has a matching author
        for (const candidate of candidates) {
          if (isSimilar(candidate.author, row.author)) {
            matchedBook = candidate;
            break;
          }
        }

        // If no exact title match, try partial matching
        if (!matchedBook) {
          for (const book of allBooksForTitleMatch) {
            if (
              isSimilar(book.title, row.title) &&
              isSimilar(book.author, row.author)
            ) {
              matchedBook = book;
              break;
            }
          }
        }
      }

      return matchedBook;
    };

    const matches = rows.map((row) => ({ row, matchedBook: findMatch(row) }));

    // Books already on the shelf, checked for the matched IDs only: reading the
    // whole shelf would stop at 1,000 rows and let duplicates fail the insert
    const matchedIds = [
      ...new Set(matches.flatMap((m) => (m.matchedBook ? [m.matchedBook.id] : []))),
    ];
    const existingBookIds = new Set<string>();
    for (let i = 0; i < matchedIds.length; i += 500) {
      const { data: existingUserBooks } = await supabase
        .from("user_books")
        .select("book_id")
        .eq("user_id", user.id)
        .in("book_id", matchedIds.slice(i, i + 500));

      for (const ub of existingUserBooks || []) existingBookIds.add(ub.book_id);
    }

    for (const { row, matchedBook } of matches) {
      if (matchedBook) {
        // Check if already in user's shelf
        if (existingBookIds.has(matchedBook.id)) {
          result.skipped++;
          continue;
        }

        // Map status
        const status = mapGoodreadsShelf(row.exclusiveShelf);

        // Prepare data
        const bookData = {
          user_id: user.id,
          book_id: matchedBook.id,
          status,
          rating: row.myRating > 0 ? row.myRating : null,
          started_at: null as string | null,
          finished_at: row.dateRead ? parseDate(row.dateRead) : null,
        };

        // If reading, set started_at to date_added
        if (status === "reading" && row.dateAdded) {
          bookData.started_at = parseDate(row.dateAdded);
        }

        booksToAdd.push(bookData);
        existingBookIds.add(matchedBook.id); // Prevent duplicates within import

        result.matchedBooks.push({
          title: matchedBook.title,
          author: matchedBook.author,
          status,
        });
        result.matched++;
      } else {
        result.notFoundBooks.push({
          title: row.title,
          author: row.author,
          isbn13: row.isbn13,
        });
        result.notFound++;
      }
    }

    // Batch insert matched books
    if (booksToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from("user_books")
        .insert(booksToAdd);

      if (insertError) {
        reportError("Import: batch insert failed", insertError);
        result.errors.push("Failed to add books. Please try again.");
        return result;
      }
    }

    result.success = true;

    // Revalidate relevant pages
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");
    revalidatePath("/stats");

    return result;
  } catch (error) {
    result.errors.push(reportError("Import: unexpected error", error));
    return result;
  }
}

/**
 * Parse date string from Goodreads format (YYYY/MM/DD or MM/DD/YYYY)
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try YYYY/MM/DD format
  const ymdMatch = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try MM/DD/YYYY format
  const mdyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}
