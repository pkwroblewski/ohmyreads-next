-- Migration 063: split book ratings into external (Open Library) and local
--
-- `books.average_rating` / `books.ratings_count` served two masters.
-- `scripts/import-ratings.ts` fills them from **Open Library**, while the
-- pre-existing `recalculate_book_rating()` RPC -- which `lib/actions/reviews.ts`
-- calls after every review write -- overwrote them with the *local* review
-- average. So a book's first local review silently replaced thousands of
-- external ratings with one, and the book then failed the recommendation
-- thresholds (`average_rating >= 3.8 AND ratings_count >= 5`) and sorted last
-- everywhere `ratings_count` orders results: search, autocomplete, curated
-- picks, sitemap, AI tools.
--
-- Measured before this migration: all five books that had a rated review held
-- exactly their local average and local count, and four of the five had fallen
-- below `ratings_count >= 5`. Reviewing a book removed it from recommendations.
--
-- Decision (with the user): `average_rating` / `ratings_count` keep meaning
-- **Open Library**, and the local average moves to new columns. That keeps the
-- ~35 read sites sorting by real popularity, which is the only workable choice
-- while the catalog has 635 externally-rated books and six local ratings.
--
-- Migration 057 deliberately left book ratings out of both its triggers and
-- `reconcile_counters()` because making the clobbering atomic would have
-- widened it. With the columns split, both are now safe to add, and are.

-- ============================================
-- 1. The local columns
-- ============================================

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS local_average_rating NUMERIC(3, 2),
  ADD COLUMN IF NOT EXISTS local_ratings_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.books.average_rating IS
  'External rating (Open Library), written by scripts/import-ratings.ts. Never derived from public.reviews.';
COMMENT ON COLUMN public.books.ratings_count IS
  'External ratings count (Open Library). Drives recommendation thresholds and popularity sorts.';
COMMENT ON COLUMN public.books.local_average_rating IS
  'Average of public.reviews.rating for this book. Maintained by trigger; never written by an import script.';
COMMENT ON COLUMN public.books.local_ratings_count IS
  'Count of public.reviews rows with a non-null rating. Maintained by trigger.';

-- Bounds, mirroring the external columns' constraints from migration 059.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.books'::regclass
      AND conname = 'books_local_average_rating_range'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_local_average_rating_range
      CHECK (local_average_rating IS NULL
             OR (local_average_rating >= 0 AND local_average_rating <= 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.books'::regclass
      AND conname = 'books_local_ratings_count_non_negative'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_local_ratings_count_non_negative
      CHECK (local_ratings_count >= 0);
  END IF;
END $$;

-- ============================================
-- 2. Backfill the local columns from reviews
-- ============================================

UPDATE public.books b
SET local_average_rating = agg.avg_rating,
    local_ratings_count  = agg.cnt
FROM (
  SELECT book_id,
         ROUND(AVG(rating)::numeric, 1) AS avg_rating,
         COUNT(rating)                  AS cnt
  FROM public.reviews
  WHERE rating IS NOT NULL
  GROUP BY book_id
) agg
WHERE b.id = agg.book_id;

-- ============================================
-- 3. Clear the external columns where they are actually local data
--
-- Every book with a rated review had its external pair overwritten by the RPC
-- the last time that review was written, so what is stored is a local average
-- wearing an external label. Leaving it would carry the lie forward; the values
-- come back from Open Library on the next run of scripts/import-ratings.ts,
-- which is part of this task.
-- ============================================

UPDATE public.books b
SET average_rating = NULL,
    ratings_count  = 0
WHERE EXISTS (
  SELECT 1 FROM public.reviews r
  WHERE r.book_id = b.id AND r.rating IS NOT NULL
);

-- ============================================
-- 4. recalculate_book_rating() now writes only the local columns
--
-- Kept as a callable RPC for manual repair even though the trigger below makes
-- the app's explicit call redundant.
-- ============================================

CREATE OR REPLACE FUNCTION public.recalculate_book_rating(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rating numeric;
  v_count integer;
BEGIN
  -- AVG() ignores NULL ratings; COUNT(rating) counts only rated reviews, so a
  -- review with text but no rating does not dilute the average or the count.
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(rating)
  INTO v_avg_rating, v_count
  FROM public.reviews
  WHERE book_id = p_book_id;

  UPDATE public.books
  SET local_average_rating = CASE WHEN v_count = 0 THEN NULL ELSE v_avg_rating END,
      local_ratings_count  = COALESCE(v_count, 0)
  WHERE id = p_book_id;
END;
$$;

-- ============================================
-- 5. Keep the local columns in step with reviews, atomically
--
-- Statement-level with transition tables, matching migration 057: a bulk review
-- write recomputes once per distinct book per statement rather than once per
-- row. This is what task 13 held back, and it is only safe now that the
-- function cannot touch the external columns.
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_book_local_ratings(p_book_ids UUID[])
RETURNS VOID AS $$
DECLARE
  v_book_id UUID;
BEGIN
  FOREACH v_book_id IN ARRAY p_book_ids LOOP
    CONTINUE WHEN v_book_id IS NULL;

    -- Lock the book row before reading reviews, so two concurrent review
    -- writes cannot both compute from a stale set and race their updates.
    PERFORM 1 FROM public.books WHERE id = v_book_id FOR UPDATE;

    UPDATE public.books b
    SET local_average_rating = src.avg_rating,
        local_ratings_count  = src.cnt
    FROM (
      SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating,
             COUNT(rating)                  AS cnt
      FROM public.reviews
      WHERE book_id = v_book_id
    ) src
    WHERE b.id = v_book_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger-only: it takes an arbitrary array of book ids and is SECURITY
-- DEFINER, so it must not be reachable as an RPC.
REVOKE ALL ON FUNCTION public.sync_book_local_ratings(UUID[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_book_local_ratings_from_new()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_book_local_ratings(
    ARRAY(SELECT DISTINCT book_id FROM new_rows WHERE book_id IS NOT NULL)
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_book_local_ratings_from_old()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_book_local_ratings(
    ARRAY(SELECT DISTINCT book_id FROM old_rows WHERE book_id IS NOT NULL)
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- An UPDATE can move a review between books, so both sides matter.
CREATE OR REPLACE FUNCTION public.sync_book_local_ratings_from_both()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_book_local_ratings(
    ARRAY(
      SELECT DISTINCT book_id FROM (
        SELECT book_id FROM old_rows
        UNION
        SELECT book_id FROM new_rows
      ) ids WHERE book_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS reviews_sync_book_local_ratings_insert ON public.reviews;
CREATE TRIGGER reviews_sync_book_local_ratings_insert
  AFTER INSERT ON public.reviews
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_book_local_ratings_from_new();

DROP TRIGGER IF EXISTS reviews_sync_book_local_ratings_update ON public.reviews;
CREATE TRIGGER reviews_sync_book_local_ratings_update
  AFTER UPDATE ON public.reviews
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_book_local_ratings_from_both();

DROP TRIGGER IF EXISTS reviews_sync_book_local_ratings_delete ON public.reviews;
CREATE TRIGGER reviews_sync_book_local_ratings_delete
  AFTER DELETE ON public.reviews
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_book_local_ratings_from_old();

-- ============================================
-- 6. reconcile_counters() gains the local pair
--
-- Migration 057 excluded book ratings because the column was ambiguous, and
-- running it anyway is what destroyed 542 books' external ratings. The local
-- columns are an unambiguous denormalization of public.reviews, so they belong
-- in the repair function; the external pair stays excluded, permanently.
-- ============================================

CREATE OR REPLACE FUNCTION public.reconcile_book_local_ratings()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed BIGINT;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin = true
     )
  THEN
    RAISE EXCEPTION 'reconcile_book_local_ratings() is admin-only';
  END IF;

  WITH src AS (
    SELECT b.id,
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.rating)                  AS cnt
    FROM public.books b
    LEFT JOIN public.reviews r ON r.book_id = b.id
    GROUP BY b.id
  ), fixed AS (
    UPDATE public.books b
    SET local_average_rating = CASE WHEN src.cnt = 0 THEN NULL ELSE src.avg_rating END,
        local_ratings_count  = src.cnt
    FROM src
    WHERE b.id = src.id
      AND (b.local_average_rating IS DISTINCT FROM
             CASE WHEN src.cnt = 0 THEN NULL ELSE src.avg_rating END
           OR b.local_ratings_count IS DISTINCT FROM src.cnt)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_fixed FROM fixed;

  RETURN v_fixed;
END;
$$;
