"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseGoodreadsCSV,
  mapGoodreadsShelf,
  type GoodreadsRow,
} from "@/lib/utils/csv-parser";

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
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Check if two strings are similar enough for a match
 */
function isSimilar(a: string, b: string): boolean {
  const normA = normalize(a);
  const normB = normalize(b);

  // Exact match after normalization
  if (normA === normB) return true;

  // One contains the other (for subtitle variations)
  if (normA.includes(normB) || normB.includes(normA)) return true;

  return false;
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
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      result.errors.push("Not authenticated");
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

    // Get user's existing books to avoid duplicates
    const { data: existingUserBooks } = await supabase
      .from("user_books")
      .select("book_id")
      .eq("user_id", user.id);

    const existingBookIds = new Set(
      existingUserBooks?.map((ub) => ub.book_id) || []
    );

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

    // Load books for title matching only if needed (limited to 10000 for safety)
    const booksByNormalizedTitle = new Map<string, { id: string; title: string; author: string; isbn: string | null }[]>();
    let allBooksForTitleMatch: { id: string; title: string; author: string; isbn: string | null }[] = [];

    if (unmatchedRows.length > 0) {
      const { data: titleMatchBooks } = await supabase
        .from("books")
        .select("id, title, author, isbn")
        .limit(10000);

      allBooksForTitleMatch = titleMatchBooks || [];

      for (const book of allBooksForTitleMatch) {
        const normalizedTitle = normalize(book.title);
        if (!booksByNormalizedTitle.has(normalizedTitle)) {
          booksByNormalizedTitle.set(normalizedTitle, []);
        }
        booksByNormalizedTitle.get(normalizedTitle)!.push(book);
      }
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

    for (const row of rows) {
      // Try to find a match
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
        const candidates = booksByNormalizedTitle.get(normalizedTitle) || [];

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
        result.errors.push(`Failed to add books: ${insertError.message}`);
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
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
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
