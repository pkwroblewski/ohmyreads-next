/**
 * External Book Search Utilities
 * Search Open Library and Google Books APIs for book metadata
 */

import { getGoogleBooksCoverUrl, getOpenLibraryCoverById } from "./covers";
import { logError } from "@/lib/utils/log";
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
      logError("Open Library search failed", response.status);
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
    logError("Open Library search error", error);
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
// OPEN LIBRARY RATINGS
// ============================================

export interface OpenLibraryRatings {
  average: number | null;
  count: number;
}

/**
 * Fetch ratings from Open Library for a work ID
 * API: https://openlibrary.org/works/{work_id}/ratings.json
 */
export async function getOpenLibraryRatings(
  workId: string
): Promise<OpenLibraryRatings | null> {
  try {
    // Normalize work ID - remove "/works/" prefix if present
    const normalizedId = workId.replace("/works/", "").replace("OL", "").replace("W", "");
    const fullWorkId = `OL${normalizedId}W`;

    const response = await fetch(
      `https://openlibrary.org/works/${fullWorkId}/ratings.json`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Open Library returns ratings in summary.average and summary.count
    if (data.summary) {
      return {
        average: data.summary.average || null,
        count: data.summary.count || 0,
      };
    }

    return null;
  } catch (error) {
    logError("Error fetching Open Library ratings", error, { workId });
    return null;
  }
}

/**
 * Fetch ratings by ISBN from Open Library
 * First looks up the work ID, then fetches ratings
 */
export async function getOpenLibraryRatingsByIsbn(
  isbn: string
): Promise<OpenLibraryRatings | null> {
  try {
    // First, get the book info by ISBN to find the work ID
    const bookResult = await searchOpenLibraryByIsbn(isbn);

    if (!bookResult?.openLibraryId) {
      return null;
    }

    // Then fetch ratings using the work ID
    return getOpenLibraryRatings(bookResult.openLibraryId);
  } catch {
    return null;
  }
}

/**
 * Fetch ratings by title + author from Open Library
 */
export async function getOpenLibraryRatingsByTitleAuthor(
  title: string,
  author: string
): Promise<{ ratings: OpenLibraryRatings; workId: string } | null> {
  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", title);
    url.searchParams.set("author", author);
    url.searchParams.set("limit", "1");
    url.searchParams.set("fields", "key");

    const response = await fetch(url.toString());

    if (!response.ok) return null;

    const data: OpenLibrarySearchResponse = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return null;
    }

    const workId = data.docs[0].key.replace("/works/", "");
    const ratings = await getOpenLibraryRatings(workId);

    if (!ratings) return null;

    return { ratings, workId };
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
  language?: string;
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
 * Restricts to English language books only
 */
export async function searchGoogleBooks(
  query: string,
  limit: number = 10
): Promise<ExternalBookResult[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(Math.min(limit * 2, 20))); // Fetch more to filter
  url.searchParams.set("printType", "books");
  url.searchParams.set("langRestrict", "en"); // Prefer English results

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      logError("Google Books search failed", response.status);
      return [];
    }

    const data: GoogleBooksResponse = await response.json();

    if (!data.items) return [];

    // Filter to English books and map to results
    return data.items
      .filter((item) => {
        // Only include English language books
        const lang = item.volumeInfo.language;
        return !lang || lang === "en";
      })
      .slice(0, limit)
      .map((item) => {
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
          coverUrl: getGoogleBooksCoverUrl(item.id, 3),
          publishedDate: vol.publishedDate || null,
          pageCount: vol.pageCount || null,
          genres: (vol.categories || []).slice(0, 5),
          googleBooksId: item.id,
          openLibraryId: null,
          openLibraryCoverId: null,
        };
      });
  } catch (error) {
    logError("Google Books search error", error);
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

// ============================================
// SINGLE BOOK ENRICHMENT (For seeding)
// ============================================

export interface BookEnrichmentInput {
  title: string;
  author: string;
  isbn?: string;
  genres: string[];
}

export interface EnrichedBookData {
  title: string;
  author: string;
  isbn: string | null;
  description: string | null;
  coverUrl: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  genres: string[];
  googleBooksId: string | null;
  openLibraryId: string | null;
  openLibraryCoverId: number | null;
  coverSource: "google" | "openlibrary" | null;
}

/**
 * Search Google Books by ISBN (most precise)
 */
export async function searchGoogleBooksByIsbn(
  isbn: string
): Promise<ExternalBookResult | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("printType", "books");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const data: GoogleBooksResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const vol = item.volumeInfo;
    const foundIsbn =
      vol.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier ||
      vol.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier ||
      isbn;

    return {
      source: "google" as const,
      externalId: item.id,
      title: vol.title,
      author: vol.authors?.[0] || "Unknown Author",
      isbn: foundIsbn,
      description: vol.description || null,
      coverUrl: getGoogleBooksCoverUrl(item.id, 3),
      publishedDate: vol.publishedDate || null,
      pageCount: vol.pageCount || null,
      genres: (vol.categories || []).slice(0, 5),
      googleBooksId: item.id,
      openLibraryId: null,
      openLibraryCoverId: null,
    };
  } catch {
    return null;
  }
}

/**
 * Search Google Books by title + author
 */
export async function searchGoogleBooksByTitleAuthor(
  title: string,
  author: string
): Promise<ExternalBookResult | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  // Use intitle: and inauthor: for more precise matching
  url.searchParams.set("q", `intitle:${title} inauthor:${author}`);
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("printType", "books");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const data: GoogleBooksResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Find best match using title/author similarity
    const normalizedInputTitle = normalizeTitle(title);
    const normalizedInputAuthor = normalizeAuthor(author);

    let bestMatch: GoogleBooksItem | null = null;
    let bestScore = 0;

    for (const item of data.items) {
      const vol = item.volumeInfo;
      const itemTitle = normalizeTitle(vol.title);
      const itemAuthor = normalizeAuthor(vol.authors?.[0] || "");

      // Simple scoring: exact title match + author contains input
      let score = 0;
      if (itemTitle === normalizedInputTitle) {
        score += 10;
      } else if (itemTitle.includes(normalizedInputTitle) || normalizedInputTitle.includes(itemTitle)) {
        score += 5;
      }

      if (itemAuthor === normalizedInputAuthor) {
        score += 10;
      } else if (itemAuthor.includes(normalizedInputAuthor) || normalizedInputAuthor.includes(itemAuthor)) {
        score += 5;
      }

      // Prefer books with covers and page counts
      if (vol.imageLinks?.thumbnail) score += 2;
      if (vol.pageCount) score += 1;
      
      // Prefer English language books
      if (!vol.language || vol.language === "en") score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (!bestMatch || bestScore < 10) {
      return null; // Require at least a title or author match
    }

    const vol = bestMatch.volumeInfo;
    const isbn =
      vol.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier ||
      vol.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier ||
      null;

    return {
      source: "google" as const,
      externalId: bestMatch.id,
      title: vol.title,
      author: vol.authors?.[0] || author,
      isbn,
      description: vol.description || null,
      coverUrl: getGoogleBooksCoverUrl(bestMatch.id, 3),
      publishedDate: vol.publishedDate || null,
      pageCount: vol.pageCount || null,
      genres: (vol.categories || []).slice(0, 5),
      googleBooksId: bestMatch.id,
      openLibraryId: null,
      openLibraryCoverId: null,
    };
  } catch {
    return null;
  }
}

/**
 * Search Open Library by ISBN
 */
export async function searchOpenLibraryByIsbn(
  isbn: string
): Promise<ExternalBookResult | null> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("isbn", isbn);
  url.searchParams.set("limit", "1");
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,isbn,cover_i,subject,number_of_pages_median");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const data: OpenLibrarySearchResponse = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return null;
    }

    const doc = data.docs[0];
    const coverId = doc.cover_i || null;

    return {
      source: "openlibrary" as const,
      externalId: doc.key.replace("/works/", ""),
      title: doc.title,
      author: doc.author_name?.[0] || "Unknown Author",
      isbn: doc.isbn?.[0] || isbn,
      description: null,
      coverUrl: coverId ? getOpenLibraryCoverById(coverId, "L") : null,
      publishedDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : null,
      pageCount: doc.number_of_pages_median || null,
      genres: (doc.subject || []).slice(0, 5),
      googleBooksId: null,
      openLibraryId: doc.key.replace("/works/", ""),
      openLibraryCoverId: coverId,
    };
  } catch {
    return null;
  }
}

/**
 * Enrich a single book entry with external metadata
 * Priority: Google Books (ISBN) > Google Books (title+author) > Open Library (ISBN) > fallback to input data
 */
export async function enrichBookEntry(
  input: BookEnrichmentInput
): Promise<EnrichedBookData> {
  let result: ExternalBookResult | null = null;

  // 1. Try Google Books by ISBN first (most precise)
  if (input.isbn) {
    result = await searchGoogleBooksByIsbn(input.isbn);
  }

  // 2. Try Google Books by title + author
  if (!result) {
    result = await searchGoogleBooksByTitleAuthor(input.title, input.author);
  }

  // 3. Try Open Library by ISBN as fallback
  if (!result && input.isbn) {
    result = await searchOpenLibraryByIsbn(input.isbn);
  }

  // 4. If we found something, return enriched data
  if (result) {
    return {
      title: result.title || input.title,
      author: result.author || input.author,
      isbn: result.isbn || input.isbn || null,
      description: result.description,
      coverUrl: result.coverUrl,
      publishedDate: result.publishedDate,
      pageCount: result.pageCount,
      // Merge genres: prefer input genres (curated) but add any new ones from API
      genres: mergeGenres(input.genres, result.genres),
      googleBooksId: result.googleBooksId,
      openLibraryId: result.openLibraryId,
      openLibraryCoverId: result.openLibraryCoverId,
      coverSource: result.source === "google" ? "google" : "openlibrary",
    };
  }

  // 5. Fallback: return input data without enrichment
  return {
    title: input.title,
    author: input.author,
    isbn: input.isbn || null,
    description: null,
    coverUrl: null,
    publishedDate: null,
    pageCount: null,
    genres: input.genres,
    googleBooksId: null,
    openLibraryId: null,
    openLibraryCoverId: null,
    coverSource: null,
  };
}

/**
 * Merge genre arrays, preferring curated genres but adding unique API genres
 */
function mergeGenres(curated: string[], fromApi: string[]): string[] {
  const combined = [...curated];
  const normalizedCurated = new Set(curated.map(g => g.toLowerCase()));
  
  for (const genre of fromApi) {
    if (!normalizedCurated.has(genre.toLowerCase())) {
      combined.push(genre);
    }
  }
  
  return combined.slice(0, 8); // Limit to 8 genres
}

/**
 * Batch enrich multiple books with rate limiting
 */
export async function enrichBooksWithRateLimit(
  books: BookEnrichmentInput[],
  delayMs: number = 200, // 200ms between requests to avoid rate limiting
  onProgress?: (current: number, total: number, title: string) => void
): Promise<EnrichedBookData[]> {
  const results: EnrichedBookData[] = [];
  
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    
    if (onProgress) {
      onProgress(i + 1, books.length, book.title);
    }
    
    const enriched = await enrichBookEntry(book);
    results.push(enriched);
    
    // Rate limit delay (except for last item)
    if (i < books.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

