import { createPublicClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import type { Book } from "@/types/database";

export interface AuthorSummary {
  name: string;
  slug: string;
  bookCount: number;
  avgRating: number | null;
}

export interface AuthorWithBooks {
  name: string;
  slug: string;
  books: Book[];
  avgRating: number | null;
  totalRatings: number;
}

/**
 * Create a URL-friendly slug from an author name
 */
export function createAuthorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .trim();
}

/**
 * Get all unique authors with their book counts
 */
async function fetchAllAuthors(): Promise<AuthorSummary[]> {
  const supabase = createPublicClient();

  const { data: books, error } = await supabase
    .from("books")
    .select("author, average_rating, ratings_count");

  if (error) {
    console.error("Error fetching authors:", error);
    return [];
  }

  // Group by author
  const authorMap = new Map<
    string,
    { count: number; totalRating: number; ratingCount: number }
  >();

  for (const book of books || []) {
    const existing = authorMap.get(book.author) || {
      count: 0,
      totalRating: 0,
      ratingCount: 0,
    };

    authorMap.set(book.author, {
      count: existing.count + 1,
      totalRating:
        existing.totalRating +
        (book.average_rating || 0) * (book.ratings_count || 0),
      ratingCount: existing.ratingCount + (book.ratings_count || 0),
    });
  }

  // Convert to array and sort by book count
  const authors: AuthorSummary[] = Array.from(authorMap.entries())
    .map(([name, data]) => ({
      name,
      slug: createAuthorSlug(name),
      bookCount: data.count,
      avgRating:
        data.ratingCount > 0
          ? Math.round((data.totalRating / data.ratingCount) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.bookCount - a.bookCount);

  return authors;
}

export const getAllAuthors = unstable_cache(
  fetchAllAuthors,
  ["all-authors"],
  { revalidate: 3600 } // Cache for 1 hour
);

/**
 * Get author details with all their books
 */
export async function getAuthorBySlug(
  slug: string
): Promise<AuthorWithBooks | null> {
  const supabase = createPublicClient();

  // Get all books to find matching author
  const { data: allBooks, error } = await supabase
    .from("books")
    .select("*")
    .order("ratings_count", { ascending: false });

  if (error) {
    console.error("Error fetching books for author:", error);
    return null;
  }

  // Find books by this author (match by slug)
  const books = (allBooks || []).filter(
    (book) => createAuthorSlug(book.author) === slug
  );

  if (books.length === 0) {
    return null;
  }

  // Get author name from first book
  const authorName = books[0].author;

  // Calculate average rating
  const totalRatings = books.reduce((sum, b) => sum + (b.ratings_count || 0), 0);
  const weightedSum = books.reduce(
    (sum, b) => sum + (b.average_rating || 0) * (b.ratings_count || 0),
    0
  );
  const avgRating =
    totalRatings > 0 ? Math.round((weightedSum / totalRatings) * 10) / 10 : null;

  return {
    name: authorName,
    slug,
    books: books as Book[],
    avgRating,
    totalRatings,
  };
}

/**
 * Get authors grouped by first letter
 */
export async function getAuthorsByLetter(): Promise<Map<string, AuthorSummary[]>> {
  const authors = await getAllAuthors();
  const grouped = new Map<string, AuthorSummary[]>();

  for (const author of authors) {
    const firstLetter = author.name.charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstLetter) ? firstLetter : "#";

    if (!grouped.has(letter)) {
      grouped.set(letter, []);
    }
    grouped.get(letter)!.push(author);
  }

  // Sort each group alphabetically
  for (const [, list] of grouped) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return grouped;
}
