/**
 * External Book Search Utilities
 * Search Open Library and Google Books APIs for book metadata
 */

import { getGoogleBooksCoverUrl, getOpenLibraryCoverById } from "./covers";

// ============================================
// TYPES
// ============================================

export interface ExternalBookResult {
  source: "openlibrary" | "google";
  externalId: string;
  title: string;
  author: string;
  isbn: string | null;
  description: string | null;
  coverUrl: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  genres: string[];
  // Source-specific IDs for storage
  googleBooksId: string | null;
  openLibraryId: string | null;
  openLibraryCoverId: number | null;
}

// ============================================
// OPEN LIBRARY SEARCH
// ============================================

interface OpenLibrarySearchDoc {
  key: string; // "/works/OL123456W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  subject?: string[];
  number_of_pages_median?: number;
}

interface OpenLibrarySearchResponse {
  numFound: number;
  docs: OpenLibrarySearchDoc[];
}

/**
 * Search Open Library by title/author/isbn
 */
export async function searchOpenLibrary(
  query: string,
  limit: number = 10
): Promise<ExternalBookResult[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,isbn,cover_i,subject,number_of_pages_median");

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error("Open Library search failed:", response.status);
      return [];
    }

    const data: OpenLibrarySearchResponse = await response.json();

    return data.docs.map((doc) => {
      const isbn = doc.isbn?.[0] || null;
      const coverId = doc.cover_i || null;

      return {
        source: "openlibrary" as const,
        externalId: doc.key.replace("/works/", ""),
        title: doc.title,
        author: doc.author_name?.[0] || "Unknown Author",
        isbn,
        description: null, // Open Library search doesn't return description
        coverUrl: coverId ? getOpenLibraryCoverById(coverId, "L") : null,
        publishedDate: doc.first_publish_year
          ? `${doc.first_publish_year}-01-01`
          : null,
        pageCount: doc.number_of_pages_median || null,
        genres: (doc.subject || []).slice(0, 5),
        googleBooksId: null,
        openLibraryId: doc.key.replace("/works/", ""),
        openLibraryCoverId: coverId,
      };
    });
  } catch (error) {
    console.error("Open Library search error:", error);
    return [];
  }
}

/**
 * Get detailed book info from Open Library by work ID
 */
export async function getOpenLibraryBookDetails(
  workId: string
): Promise<{ description?: string } | null> {
  try {
    const response = await fetch(
      `https://openlibrary.org/works/${workId}.json`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      description:
        typeof data.description === "string"
          ? data.description
          : data.description?.value || null,
    };
  } catch {
    return null;
  }
}

// ============================================
// GOOGLE BOOKS SEARCH
// ============================================

interface GoogleBooksVolumeInfo {
  title: string;
  authors?: string[];
  description?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
}

interface GoogleBooksItem {
  id: string;
  volumeInfo: GoogleBooksVolumeInfo;
}

interface GoogleBooksResponse {
  totalItems: number;
  items?: GoogleBooksItem[];
}

/**
 * Search Google Books by title/author/isbn
 */
export async function searchGoogleBooks(
  query: string,
  limit: number = 10
): Promise<ExternalBookResult[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("printType", "books");

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error("Google Books search failed:", response.status);
      return [];
    }

    const data: GoogleBooksResponse = await response.json();

    if (!data.items) return [];

    return data.items.map((item) => {
      const vol = item.volumeInfo;
      const isbn =
        vol.industryIdentifiers?.find((id) => id.type === "ISBN_13")
          ?.identifier ||
        vol.industryIdentifiers?.find((id) => id.type === "ISBN_10")
          ?.identifier ||
        null;

      return {
        source: "google" as const,
        externalId: item.id,
        title: vol.title,
        author: vol.authors?.[0] || "Unknown Author",
        isbn,
        description: vol.description || null,
        coverUrl: getGoogleBooksCoverUrl(item.id, 1),
        publishedDate: vol.publishedDate || null,
        pageCount: vol.pageCount || null,
        genres: (vol.categories || []).slice(0, 5),
        googleBooksId: item.id,
        openLibraryId: null,
        openLibraryCoverId: null,
      };
    });
  } catch (error) {
    console.error("Google Books search error:", error);
    return [];
  }
}

// ============================================
// COMBINED SEARCH
// ============================================

/**
 * Search both Open Library and Google Books, dedupe by ISBN
 */
export async function searchExternalBooks(
  query: string,
  limit: number = 10
): Promise<ExternalBookResult[]> {
  // Search both in parallel
  const [openLibraryResults, googleResults] = await Promise.all([
    searchOpenLibrary(query, limit),
    searchGoogleBooks(query, limit),
  ]);

  // Prefer Google Books results (cleaner covers), but include unique Open Library results
  const seenIsbns = new Set<string>();
  const seenTitles = new Set<string>();
  const combined: ExternalBookResult[] = [];

  // Add Google results first (priority)
  for (const result of googleResults) {
    const normalizedTitle = result.title.toLowerCase().trim();
    if (result.isbn) seenIsbns.add(result.isbn);
    seenTitles.add(normalizedTitle);
    combined.push(result);
  }

  // Add Open Library results that aren't duplicates
  for (const result of openLibraryResults) {
    const normalizedTitle = result.title.toLowerCase().trim();
    
    // Skip if we already have this ISBN
    if (result.isbn && seenIsbns.has(result.isbn)) continue;
    
    // Skip if very similar title already exists
    if (seenTitles.has(normalizedTitle)) continue;

    combined.push(result);
  }

  return combined.slice(0, limit);
}

// ============================================
// DEDUPE CHECK
// ============================================

/**
 * Check if a book already exists in the database
 */
export interface DedupeResult {
  exists: boolean;
  matchedBy: "isbn" | "google_books_id" | "open_library_id" | "title_author" | null;
  existingBookId?: string;
  existingBookSlug?: string;
}

/**
 * Normalize title for fuzzy matching
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize author name for fuzzy matching
 */
export function normalizeAuthor(author: string): string {
  return author
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

