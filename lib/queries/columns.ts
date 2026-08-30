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
 * Keep these in sync with the `books` columns in types/database.generated.ts.
 */
export const BOOK_DETAIL_COLUMNS =
  "id, title, author, slug, description, cover_url, isbn, published_date, page_count, genres, google_books_id, average_rating, ratings_count, created_at, open_library_id, open_library_cover_id, cover_source, updated_at, author_slug" as const;

export const BOOK_CARD_COLUMNS =
  "id, title, author, slug, cover_url, isbn, published_date, page_count, genres, google_books_id, average_rating, ratings_count, created_at, open_library_id, open_library_cover_id, cover_source, updated_at, author_slug" as const;
