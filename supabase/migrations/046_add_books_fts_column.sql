-- Add a generated tsvector column combining title + author for full-text search.
-- This replaces ilike '%query%' full-table scans with indexed GIN lookups.
-- Title is weighted A (highest), author is weighted B (high) for relevance ranking.

ALTER TABLE public.books
ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', author), 'B')
) STORED;

CREATE INDEX books_fts_idx ON public.books USING GIN (fts);

-- The old per-column GIN indexes are no longer needed for search
-- (they may still be used by other queries, so we keep them).
