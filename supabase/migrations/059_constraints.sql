-- ============================================
-- Migration 059: Database-level constraints
--
-- The app deduped books and validated lengths only in application code, so
-- anything writing outside those paths (scripts/, imports, the admin client,
-- a future endpoint) could put data in the table that the app considers
-- impossible. This adds the DB-level backstop:
--
--   * partial UNIQUE indexes on the three external ids
--   * CHECKs on books.average_rating (0-5) and books.ratings_count (>= 0)
--   * length CHECKs mirroring the Zod caps in lib/validation/
--
-- direct_messages already had `dm_content_length CHECK (length(content) <=
-- 10000)`; reviews and comments had nothing.
--
-- ============================================
-- Data repair required first
-- ============================================
-- Production has 35 rows carrying an external id that a sibling row also
-- carries: 10 duplicate isbn, 10 duplicate google_books_id, 15 duplicate
-- open_library_id. The unique indexes cannot be created while those exist.
--
-- These rows are NOT deleted. Verified before writing this migration: none of
-- the 30 books involved is referenced by ANY of the seven tables with a
-- book_id FK (user_books, reviews, activity_feed, book_club_reads,
-- book_submissions, place_checkins, reading_list_books) -- zero rows in all
-- seven. So no user data hangs off them. Even so, deleting catalog rows is
-- not what this task needs: nulling the redundant id is enough to make the id
-- unique, loses nothing (the value survives on the sibling row), and is
-- reversible. Merging genuine duplicate catalog entries is a separate concern
-- and already has scripts/fix-duplicate-books.ts.
--
-- Every nulled value is copied into books_external_id_dedupe_backup first, so
-- this is undoable -- see the restore statement at the bottom of section 1.
-- ============================================

-- ============================================
-- 1. Data repair
-- ============================================

CREATE TABLE IF NOT EXISTS public.books_external_id_dedupe_backup (
  book_id     UUID NOT NULL,
  id_kind     TEXT NOT NULL,
  id_value    TEXT NOT NULL,
  book_title  TEXT,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, id_kind)
);

COMMENT ON TABLE public.books_external_id_dedupe_backup IS
  'Pre-image of external ids cleared by migration 059 so the partial unique indexes could be created. Retained so the change is reversible; safe to drop once the dedupe is considered settled.';

ALTER TABLE public.books_external_id_dedupe_backup ENABLE ROW LEVEL SECURITY;
-- No policies: service_role and the table owner only. Nothing in the app reads it.

-- 1a. One group is not a duplicate at all but a mis-assigned id: "The Dark
--     Forest" and "The Three-Body Problem" (both Cixin Liu) shared
--     open_library_id OL16314245W. openlibrary.org/works/OL16314245W.json
--     reports title "The Dark Forest (The Three-Body Problem Series Book 2)",
--     so the id belongs to The Dark Forest and is wrong on The Three-Body
--     Problem. Both rows carry ratings_count 36 -- the same figure, imported
--     through the bad id -- so a generic "keep the most-rated row" rule would
--     have broken the tie arbitrarily. Fix it explicitly, before the generic
--     pass, so the outcome does not depend on tie-break order.

INSERT INTO public.books_external_id_dedupe_backup (book_id, id_kind, id_value, book_title)
SELECT id, 'open_library_id', open_library_id, title
FROM public.books
WHERE open_library_id = 'OL16314245W' AND title = 'The Three-Body Problem'
ON CONFLICT (book_id, id_kind) DO NOTHING;

UPDATE public.books
SET open_library_id = NULL
WHERE open_library_id = 'OL16314245W' AND title = 'The Three-Body Problem';

-- 1b. Genuine duplicates: keep the id on the most-rated row (then oldest, then
--     lowest id, so the choice is deterministic) and clear it on the rest.

WITH ranked AS (
  SELECT
    id, title, isbn, google_books_id, open_library_id,
    row_number() OVER (PARTITION BY isbn
                       ORDER BY ratings_count DESC NULLS LAST, created_at, id) AS rn_isbn,
    row_number() OVER (PARTITION BY google_books_id
                       ORDER BY ratings_count DESC NULLS LAST, created_at, id) AS rn_gbid,
    row_number() OVER (PARTITION BY open_library_id
                       ORDER BY ratings_count DESC NULLS LAST, created_at, id) AS rn_olid
  FROM public.books
),
losers AS (
  SELECT id, 'isbn' AS kind, isbn AS val, title FROM ranked
   WHERE isbn IS NOT NULL AND isbn <> '' AND rn_isbn > 1
  UNION ALL
  SELECT id, 'google_books_id', google_books_id, title FROM ranked
   WHERE google_books_id IS NOT NULL AND google_books_id <> '' AND rn_gbid > 1
  UNION ALL
  SELECT id, 'open_library_id', open_library_id, title FROM ranked
   WHERE open_library_id IS NOT NULL AND open_library_id <> '' AND rn_olid > 1
)
INSERT INTO public.books_external_id_dedupe_backup (book_id, id_kind, id_value, book_title)
SELECT id, kind, val, title FROM losers
ON CONFLICT (book_id, id_kind) DO NOTHING;

UPDATE public.books b
SET isbn = NULL
WHERE EXISTS (
  SELECT 1 FROM public.books_external_id_dedupe_backup k
  WHERE k.book_id = b.id AND k.id_kind = 'isbn' AND k.id_value = b.isbn
);

UPDATE public.books b
SET google_books_id = NULL
WHERE EXISTS (
  SELECT 1 FROM public.books_external_id_dedupe_backup k
  WHERE k.book_id = b.id AND k.id_kind = 'google_books_id' AND k.id_value = b.google_books_id
);

UPDATE public.books b
SET open_library_id = NULL
WHERE EXISTS (
  SELECT 1 FROM public.books_external_id_dedupe_backup k
  WHERE k.book_id = b.id AND k.id_kind = 'open_library_id' AND k.id_value = b.open_library_id
);

-- To undo the repair (drop the unique indexes in section 2 first, or it will
-- fail):
--   UPDATE public.books b SET isbn = k.id_value
--     FROM public.books_external_id_dedupe_backup k
--    WHERE k.book_id = b.id AND k.id_kind = 'isbn';
--   ... likewise for google_books_id and open_library_id.

-- ============================================
-- 2. Uniqueness on the external ids
--
-- Partial, because all three are nullable and most books have only some of
-- them. Empty string is excluded too: '' is not a real id, and without this a
-- future writer inserting '' would collide with every other ''.
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS books_isbn_unique_idx
  ON public.books (isbn) WHERE isbn IS NOT NULL AND isbn <> '';

CREATE UNIQUE INDEX IF NOT EXISTS books_google_books_id_unique_idx
  ON public.books (google_books_id) WHERE google_books_id IS NOT NULL AND google_books_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS books_open_library_id_unique_idx
  ON public.books (open_library_id) WHERE open_library_id IS NOT NULL AND open_library_id <> '';

-- ============================================
-- 3. Rating sanity on books
--
-- NULL stays allowed: it means "no rating known", which is the state of 80
-- books today.
-- ============================================

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_average_rating_range;
ALTER TABLE public.books
  ADD CONSTRAINT books_average_rating_range
  CHECK (average_rating IS NULL OR (average_rating >= 0 AND average_rating <= 5));

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_ratings_count_non_negative;
ALTER TABLE public.books
  ADD CONSTRAINT books_ratings_count_non_negative
  CHECK (ratings_count IS NULL OR ratings_count >= 0);

-- ============================================
-- 4. Length caps mirroring lib/validation/
--
-- comment.ts:      content max 1000
-- review.ts:       summary max 2000; liked / disliked / takeaway max 1000 each;
--                  vibeTags max 10
--
-- reviews.content is assembled from those four fields in createReview():
--   summary (2000)
--   + "What I liked: " (14) + liked (1000)
--   + "What I didn't like: " (20) + disliked (1000)
--   + "Key takeaway: " (14) + takeaway (1000)
--   + three "\n\n" joins (6)
-- = 5054 worst case. Capped at 6000 to leave headroom while still bounding it.
-- ============================================

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_content_length;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_length
  CHECK (content IS NULL OR length(content) <= 1000);

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_content_length;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_content_length
  CHECK (content IS NULL OR length(content) <= 6000);

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_field_lengths;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_field_lengths
  CHECK (
    (summary  IS NULL OR length(summary)  <= 2000)
    AND (liked    IS NULL OR length(liked)    <= 1000)
    AND (disliked IS NULL OR length(disliked) <= 1000)
    AND (takeaway IS NULL OR length(takeaway) <= 1000)
  );

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_vibe_tags_max;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_vibe_tags_max
  CHECK (vibe_tags IS NULL OR COALESCE(array_length(vibe_tags, 1), 0) <= 10);
