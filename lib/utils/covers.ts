/**
 * Centralized book cover URL resolution
 *
 * Priority order (Open Library first - more reliable, Google Books has placeholder issues):
 * 1. Open Library by cover ID (most reliable)
 * 2. Open Library by ISBN
 * 3. Existing cover_url
 * 4. Google Books (fallback - may return "image not available" placeholders)
 */

// Google Books cover URL template
const GOOGLE_BOOKS_COVER_URL = "https://books.google.com/books/content";

// Open Library cover URL templates
const OPEN_LIBRARY_COVER_BY_ID = "https://covers.openlibrary.org/b/id";
const OPEN_LIBRARY_COVER_BY_ISBN = "https://covers.openlibrary.org/b/isbn";

export interface BookCoverData {
  cover_url?: string | null;
  google_books_id?: string | null;
  isbn?: string | null;
  open_library_cover_id?: number | null;
}

export type CoverSize = "S" | "M" | "L";

/**
 * Get Google Books cover URL
 * zoom levels: 1 (standard), 2 (medium), 3 (highest quality)
 */
export function getGoogleBooksCoverUrl(
  googleBooksId: string,
  zoom: 1 | 2 | 3 = 3
): string {
  return `${GOOGLE_BOOKS_COVER_URL}?id=${googleBooksId}&printsec=frontcover&img=1&zoom=${zoom}&source=gbs_api`;
}

/**
 * Without this Open Library answers a missing cover with a 200 and a 1×1
 * blank image; with it the request 404s, which is what lets `<img onError>`
 * (via the `/_next/image` optimizer) fall through to the next candidate.
 */
const OPEN_LIBRARY_MISSING_AS_404 = "?default=false";

/**
 * Get Open Library cover URL by cover ID
 */
export function getOpenLibraryCoverById(
  coverId: number | string,
  size: CoverSize = "L"
): string {
  return `${OPEN_LIBRARY_COVER_BY_ID}/${coverId}-${size}.jpg${OPEN_LIBRARY_MISSING_AS_404}`;
}

/**
 * Get Open Library cover URL by ISBN
 */
export function getOpenLibraryCoverByIsbn(
  isbn: string,
  size: CoverSize = "L"
): string {
  // Clean ISBN (remove hyphens/spaces)
  const cleanIsbn = isbn.replace(/[-\s]/g, "");
  return `${OPEN_LIBRARY_COVER_BY_ISBN}/${cleanIsbn}-${size}.jpg${OPEN_LIBRARY_MISSING_AS_404}`;
}

/**
 * Upgrade Open Library cover URLs from -S or -M to -L for higher resolution
 */
export function upgradeOpenLibraryCoverSize(url: string): string {
  if (url.includes("covers.openlibrary.org")) {
    return url.replace(/-[SM]\.jpg$/i, "-L.jpg");
  }
  return url;
}

/**
 * Check if a URL is from Open Library
 */
export function isOpenLibraryCover(url: string): boolean {
  return url.includes("covers.openlibrary.org");
}

/**
 * Check if a URL is from Google Books
 */
export function isGoogleBooksCover(url: string): boolean {
  return url.includes("books.google.com");
}

/**
 * Resolve the best available cover URL for a book
 * Returns null if no cover is available (caller should show placeholder)
 */
export function resolveCoverUrl(book: BookCoverData): string | null {
  // 1. Open Library by cover ID (most reliable - returns 404 for missing)
  if (book.open_library_cover_id) {
    return getOpenLibraryCoverById(book.open_library_cover_id, "L");
  }

  // 2. Open Library by ISBN
  if (book.isbn) {
    return getOpenLibraryCoverByIsbn(book.isbn, "L");
  }

  // 3. Existing cover_url (may be from different source)
  if (book.cover_url) {
    return upgradeOpenLibraryCoverSize(book.cover_url);
  }

  // 4. Google Books as fallback (may return "image not available" placeholders)
  if (book.google_books_id) {
    return getGoogleBooksCoverUrl(book.google_books_id, 3);
  }

  // No cover available
  return null;
}

/**
 * Get high-resolution cover URL (for detail pages)
 * Uses -L for Open Library, zoom=3 for Google Books
 */
export function resolveHighResCoverUrl(book: BookCoverData): string | null {
  // Same priority as resolveCoverUrl - Open Library first, Google Books last
  return resolveCoverUrl(book);
}

/**
 * Determine the source of a cover URL for attribution
 */
export function getCoverSource(
  url: string | null
): "google" | "openlibrary" | "unknown" | null {
  if (!url) return null;
  if (isGoogleBooksCover(url)) return "google";
  if (isOpenLibraryCover(url)) return "openlibrary";
  return "unknown";
}

/**
 * Get attribution text for cover source
 */
export function getCoverAttribution(url: string | null): string | null {
  const source = getCoverSource(url);
  switch (source) {
    case "google":
      return "Cover via Google Books";
    case "openlibrary":
      return "Cover via Open Library";
    default:
      return null;
  }
}

/**
 * Get all possible cover URLs for a book in priority order
 * Used for fallback chain when primary source fails
 *
 * Order: Open Library first (reliable 404 for missing), Google Books last (placeholder issues)
 */
export function getCoverUrlsWithFallbacks(book: BookCoverData): string[] {
  const urls: string[] = [];

  // 1. Open Library by cover ID (most reliable - returns 404 for missing)
  if (book.open_library_cover_id) {
    urls.push(getOpenLibraryCoverById(book.open_library_cover_id, "L"));
  }

  // 2. Open Library by ISBN
  if (book.isbn) {
    urls.push(getOpenLibraryCoverByIsbn(book.isbn, "L"));
  }

  // 3. Existing cover_url (may be from different source)
  if (book.cover_url) {
    urls.push(upgradeOpenLibraryCoverSize(book.cover_url));
  }

  // 4. Google Books as fallback (may return "image not available" placeholders)
  if (book.google_books_id) {
    urls.push(getGoogleBooksCoverUrl(book.google_books_id, 3));
  }

  return urls;
}

// Note: Google Books "no preview" grey placeholders (128x170, 575x750) cannot
// be detected client-side without CORS canvas access; Google Books is last in
// the chain so they are rarely reached. Broken and 1×1 candidates are skipped
// by `useCoverSrc` (hooks/use-cover-src.ts) through the <img> error/load
// events, so no separate probe request is made.

