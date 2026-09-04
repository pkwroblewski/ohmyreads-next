import { createPublicClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { BOOK_CARD_COLUMNS } from "./columns";
import type { BookSummary } from "@/types/database";
import { logError } from "@/lib/utils/log";

export interface AuthorSummary {
  name: string;
  slug: string;
  bookCount: number;
  avgRating: number | null;
}

export interface AuthorWithBooks {
  name: string;
  slug: string;
  books: BookSummary[];
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

  // Aggregated in SQL (migration 058). Selecting every book here truncated at
  // PostgREST's 1000-row cap, so authors beyond that row silently disappeared.
  const { data, error } = await supabase.rpc("get_author_summaries");

  if (error) {
    logError("Error fetching authors", error);
    return [];
  }

  return (data || []).map((row) => ({
    name: row.name,
    slug: row.slug,
    bookCount: Number(row.book_count),
    avgRating: row.avg_rating === null ? null : Number(row.avg_rating),
  }));
}

export const getAllAuthors = unstable_cache(
  fetchAllAuthors,
  ["all-authors"],
  { revalidate: 3600, tags: [CACHE_TAGS.books, CACHE_TAGS.authors] } // 1 hour, or until a book changes
);

/**
 * Get author details with all their books
 */
export async function getAuthorBySlug(
  slug: string
): Promise<AuthorWithBooks | null> {
  const supabase = createPublicClient();

  // books.author_slug is a generated column mirroring createAuthorSlug()
  // (migration 058), so this is an indexed equality filter. It used to select
  // the entire books table and match the slug in JS, which both truncated at
  // 1000 rows and intermittently blew the 60s prerender budget on build.
  const { data: books, error } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .eq("author_slug", slug)
    .order("ratings_count", { ascending: false, nullsFirst: false });

  if (error) {
    logError("Error fetching books for author", error);
    return null;
  }

  if (!books || books.length === 0) {
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
    books: books as BookSummary[],
    avgRating,
    totalRatings,
  };
}
