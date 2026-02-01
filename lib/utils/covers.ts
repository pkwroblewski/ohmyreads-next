/**
 * Centralized book cover URL resolution
 * 
 * Priority order:
 * 1. Google Books (often cleaner, no barcodes)
 * 2. Open Library high-res (-L suffix)
 * 3. Open Library by ISBN
 * 4. Fallback to null (component handles placeholder)
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
 * Get Open Library cover URL by cover ID
 */
export function getOpenLibraryCoverById(
  coverId: number | string,
  size: CoverSize = "L"
): string {
  return `${OPEN_LIBRARY_COVER_BY_ID}/${coverId}-${size}.jpg`;
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
  return `${OPEN_LIBRARY_COVER_BY_ISBN}/${cleanIsbn}-${size}.jpg`;
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
  // 1. Prefer Google Books if we have the ID (often cleaner covers)
  if (book.google_books_id) {
    return getGoogleBooksCoverUrl(book.google_books_id, 3);
  }

  // 2. If we have an existing cover URL, upgrade it if it's Open Library
  if (book.cover_url) {
    return upgradeOpenLibraryCoverSize(book.cover_url);
  }

  // 3. Try Open Library cover ID if available
  if (book.open_library_cover_id) {
    return getOpenLibraryCoverById(book.open_library_cover_id, "L");
  }

  // 4. Try Open Library by ISBN as last resort
  if (book.isbn) {
    return getOpenLibraryCoverByIsbn(book.isbn, "L");
  }

  // No cover available
  return null;
}

/**
 * Get high-resolution cover URL (for detail pages)
 * Uses zoom=3 for Google Books (highest quality), -L for Open Library
 */
export function resolveHighResCoverUrl(book: BookCoverData): string | null {
  // 1. Prefer Google Books with highest zoom
  if (book.google_books_id) {
    return getGoogleBooksCoverUrl(book.google_books_id, 3);
  }

  // Use standard resolution for others (already uses -L for Open Library)
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
 * Used for fallback chain when primary source fails (e.g., Google Books returns 1x1 pixel)
 */
export function getCoverUrlsWithFallbacks(book: BookCoverData): string[] {
  const urls: string[] = [];

  // 1. Google Books (highest quality when available)
  if (book.google_books_id) {
    urls.push(getGoogleBooksCoverUrl(book.google_books_id, 3));
  }

  // 2. Existing cover_url (may be from different source)
  if (book.cover_url) {
    urls.push(upgradeOpenLibraryCoverSize(book.cover_url));
  }

  // 3. Open Library by cover ID
  if (book.open_library_cover_id) {
    urls.push(getOpenLibraryCoverById(book.open_library_cover_id, "L"));
  }

  // 4. Open Library by ISBN
  if (book.isbn) {
    urls.push(getOpenLibraryCoverByIsbn(book.isbn, "L"));
  }

  return urls;
}

