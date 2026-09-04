/**
 * Shared column projections for the `books` table.
 *
 * `select("*")` on `books` was the default across ~25 call sites. Two columns
 * make that expensive:
 *
 *   - `fts`, the generated tsvector, is never read by any consumer (it is only
 *     ever a `textSearch()` filter target), so nothing should ship it.
 *   - `description` averages ~940 of the ~1350 bytes in a row, and only the
 *     book detail page, the AI tools and admin enrichment actually render it.
 *
 * So there are two projections: the detail one (everything but `fts`) and the
 * card one (that minus `description`), which is what every grid, rail, shelf
 * and recommendation list needs. They are string literals, not `string`, so
 * supabase-js still infers the row shape from them.
 *
 * `local_average_rating` / `local_ratings_count` (migration 063) are in both
 * projections: cards show this site's own rating when it has one and fall
 * back to the labelled Open Library figure (Task 20), while sorting and
 * filtering still use the external pair.
 *
 * Keep these in sync with the `books` columns in types/database.generated.ts.
 */
export const BOOK_DETAIL_COLUMNS =
  "id, title, author, slug, description, cover_url, isbn, published_date, page_count, genres, google_books_id, average_rating, ratings_count, local_average_rating, local_ratings_count, created_at, open_library_id, open_library_cover_id, cover_source, updated_at, author_slug" as const;

export const BOOK_CARD_COLUMNS =
  "id, title, author, slug, cover_url, isbn, published_date, page_count, genres, google_books_id, average_rating, ratings_count, local_average_rating, local_ratings_count, created_at, open_library_id, open_library_cover_id, cover_source, updated_at, author_slug" as const;

/**
 * The smallest projection that can still render a cover: identity plus every
 * field the `CoverImage` fallback chain reads (Open Library cover id → ISBN →
 * `cover_url` → Google Books). Embedded `book:books(...)` joins in feeds and
 * club reads used to select `cover_url` alone, so any book whose `cover_url`
 * was null showed "image not available" there and a real cover everywhere
 * else.
 */
export const BOOK_COVER_COLUMNS =
  "id, title, author, slug, cover_url, isbn, google_books_id, open_library_cover_id, cover_source" as const;

/**
 * The `profiles` columns that migration 065 leaves readable through the anon
 * and authenticated roles. `select("*")` on profiles now fails with a
 * permission error for those roles; a user's own full row (location,
 * presence, inbox, email preferences) comes from the `get_my_profile()` RPC.
 *
 * Keep in sync with the GRANT list in
 * supabase/migrations/065_profiles_column_privacy.sql.
 */
export const PROFILE_PUBLIC_COLUMNS =
  "id, username, display_name, avatar_url, bio, website, created_at, updated_at, followers_count, following_count, friends_count, is_admin, discovery_visible, is_public_activity, disabled_at" as const;
