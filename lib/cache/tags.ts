import { updateTag } from "next/cache";

/**
 * Cache tags shared between the `unstable_cache` entries that hold derived data
 * and the mutations that make that data stale.
 *
 * Producers (`lib/queries/*`) pass these through `unstable_cache(..., { tags })`;
 * consumers (`lib/actions/*`) call `invalidateTags()` after a write. Both sides
 * deliberately share one constant: a tag that matches only by coincidence stops
 * invalidating the moment someone retypes the string, and nothing fails loudly.
 */
export const CACHE_TAGS = {
  /** Rows in `books` — title, cover, genres, author, Open Library ratings. */
  books: "books",
  /** The distinct-genre list derived from `books.genres`. */
  genres: "genres",
  /** The author aggregate list derived from `books.author`. */
  authors: "authors",
  /** Rows in `reviews` (local reviews — not `books.average_rating`). */
  reviews: "reviews",
  /** `activity_feed` rows, written by DB triggers on reviews / checkins / user_books. */
  activity: "activity-feed",
  /** Trending scores and the AI insight text derived from them. */
  trending: "trending",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Expire every cache entry carrying these tags. Server Actions only.
 *
 * `updateTag` rather than `revalidateTag(tag, profile)`: Next 16 treats a
 * profiled `revalidateTag` as stale-while-revalidate and deliberately does not
 * let the acting request read its own write, so an admin who just approved a
 * book would still be served the old list. `updateTag` expires immediately and
 * gives read-your-own-writes. It throws outside a Server Action — route
 * handlers must use `revalidateTag(tag, "max")` instead.
 */
export function invalidateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    updateTag(tag);
  }
}

/** A book row changed: the catalog lists, genre list and author list all derive from it. */
export const BOOK_CATALOG_TAGS = [
  CACHE_TAGS.books,
  CACHE_TAGS.genres,
  CACHE_TAGS.authors,
] as const;
