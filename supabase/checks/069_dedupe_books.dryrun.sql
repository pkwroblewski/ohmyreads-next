BEGIN;

-- ============================================
-- Migration 069: catalog dedupe + one broken record
--
-- UX fixes plan (2026-09-04) task 10 / review findings D1 and D5.
--
-- Part 1 collapses every title+author group that has more than one `books`
-- row onto a single canonical row. The canonical row is the one readers are
-- attached to (most user_books + reviews, then most other child rows), then
-- the one whose slug carries no `-N` suffix, then the more complete record,
-- then the oldest. Every child row on a duplicate is repointed at the
-- canonical id first; where the child table has a unique key that would
-- collide (user_books, reviews, reading_list_books, book_club_reads) the
-- duplicate's row is dropped and the canonical row's entry kept.
--
-- The full FK list was read from pg_constraint on 2026-09-05:
--   activity_feed, book_club_reads, book_submissions, place_checkins,
--   reading_list_books, reviews, user_books.
-- (The plan's guesses `club_books` / `challenge_books` do not exist.)
--
-- There is no redirect table, so the `-N` slugs simply 404 afterwards; they
-- were never linked externally.
--
-- Part 2 fixes `harry-potter-1`: a box-set record titled just "Harry Potter"
-- carrying ISBN 9780439358071 -- which is *Order of the Phoenix* (Scholastic)
-- -- a 2008 date and a "collects the complete series" blurb. The catalog
-- already holds a Sorcerer's Stone row, so the record is given the identity
-- its ISBN and cover already point at, and the derived fields are cleared for
-- `npm run enrich-books` to refill.
--
-- Usage:
--   npx supabase db query --linked -f supabase/migrations/069_dedupe_books.sql
--   npx supabase db query --linked -f supabase/checks/069_dedupe_books.check.sql
-- ============================================

-- ============================================
-- Part 1: dedupe
-- ============================================

DO $$
DECLARE
  n_dupes int;
  n_groups int;
  n int;
  v_report text := '';
BEGIN
  CREATE TEMP TABLE _dedupe_map AS
  WITH dupes AS (
    SELECT lower(btrim(title)) AS t, lower(btrim(coalesce(author, ''))) AS a
    FROM public.books
    GROUP BY 1, 2
    HAVING count(*) > 1
  ),
  ranked AS (
    SELECT
      b.id,
      b.slug,
      first_value(b.id) OVER (
        PARTITION BY lower(btrim(b.title)), lower(btrim(coalesce(b.author, '')))
        ORDER BY
          -- readers first: never delete the row people are attached to
          (SELECT count(*) FROM public.user_books ub WHERE ub.book_id = b.id)
            + (SELECT count(*) FROM public.reviews rv WHERE rv.book_id = b.id) DESC,
          (SELECT count(*) FROM public.activity_feed af WHERE af.book_id = b.id)
            + (SELECT count(*) FROM public.reading_list_books rl WHERE rl.book_id = b.id)
            + (SELECT count(*) FROM public.book_club_reads cr WHERE cr.book_id = b.id)
            + (SELECT count(*) FROM public.book_submissions bs WHERE bs.book_id = b.id)
            + (SELECT count(*) FROM public.place_checkins pc WHERE pc.book_id = b.id) DESC,
          (b.slug ~ '-[0-9]+$') ASC,                                  -- prefer the unsuffixed slug
          (b.description IS NULL OR btrim(b.description) = '') ASC,   -- prefer the fuller record
          (b.page_count IS NULL) ASC,
          b.created_at ASC,
          b.id ASC
      ) AS canonical_id
    FROM public.books b
    JOIN dupes d
      ON d.t = lower(btrim(b.title))
     AND d.a = lower(btrim(coalesce(b.author, '')))
  )
  SELECT id AS dup_id, slug AS dup_slug, canonical_id
  FROM ranked
  WHERE id <> canonical_id;

  SELECT count(*), count(DISTINCT canonical_id) INTO n_dupes, n_groups FROM _dedupe_map;
  v_report := format('069: %s duplicate rows across %s groups', n_dupes, n_groups);

  -- user_books (unique on user_id, book_id)
  DELETE FROM public.user_books ub
   USING _dedupe_map m
   WHERE ub.book_id = m.dup_id
     AND EXISTS (
       SELECT 1 FROM public.user_books c
        WHERE c.user_id = ub.user_id AND c.book_id = m.canonical_id
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; user_books dropped=%s', n);

  UPDATE public.user_books ub SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE ub.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format(' moved=%s', n);

  -- reviews (unique on user_id, book_id)
  DELETE FROM public.reviews rv
   USING _dedupe_map m
   WHERE rv.book_id = m.dup_id
     AND EXISTS (
       SELECT 1 FROM public.reviews c
        WHERE c.user_id = rv.user_id AND c.book_id = m.canonical_id
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; reviews dropped=%s', n);

  UPDATE public.reviews rv SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE rv.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format(' moved=%s', n);

  -- reading_list_books (primary key on list_id, book_id)
  DELETE FROM public.reading_list_books rl
   USING _dedupe_map m
   WHERE rl.book_id = m.dup_id
     AND EXISTS (
       SELECT 1 FROM public.reading_list_books c
        WHERE c.list_id = rl.list_id AND c.book_id = m.canonical_id
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; reading_list_books dropped=%s', n);

  UPDATE public.reading_list_books rl SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE rl.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format(' moved=%s', n);

  -- book_club_reads (unique on club_id, book_id)
  DELETE FROM public.book_club_reads cr
   USING _dedupe_map m
   WHERE cr.book_id = m.dup_id
     AND EXISTS (
       SELECT 1 FROM public.book_club_reads c
        WHERE c.club_id = cr.club_id AND c.book_id = m.canonical_id
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; book_club_reads dropped=%s', n);

  UPDATE public.book_club_reads cr SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE cr.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format(' moved=%s', n);

  -- no unique key on book_id: a plain repoint
  UPDATE public.activity_feed af SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE af.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; activity_feed moved=%s', n);

  UPDATE public.book_submissions bs SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE bs.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; book_submissions moved=%s', n);

  UPDATE public.place_checkins pc SET book_id = m.canonical_id
    FROM _dedupe_map m WHERE pc.book_id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; place_checkins moved=%s', n);

  DELETE FROM public.books b USING _dedupe_map m WHERE b.id = m.dup_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_report := v_report || format('; books deleted=%s', n);

  RAISE NOTICE '%', v_report;

  -- dry run: keep _dedupe_map for the report below
END $$;

-- ============================================
-- Part 2: harry-potter-1 -> Order of the Phoenix
-- ============================================

UPDATE public.books
SET title = 'Harry Potter and the Order of the Phoenix',
    slug = 'harry-potter-and-the-order-of-the-phoenix',
    isbn = '9780439358071',
    published_date = NULL,
    page_count = NULL,
    description = NULL,
    cover_url = NULL,
    cover_source = NULL,
    google_books_id = NULL,
    open_library_id = NULL,
    open_library_cover_id = NULL
WHERE slug = 'harry-potter-1';


-- ============================================
-- Dry-run report + rollback
-- ============================================

DO $$
DECLARE
  v_report text := E'
069 DRY RUN
';
  r record;
  n int;
BEGIN
  FOR r IN
    SELECT m.dup_slug, b.slug AS canonical_slug, b.title
    FROM _dedupe_map m JOIN public.books b ON b.id = m.canonical_id
    ORDER BY b.title, m.dup_slug
  LOOP
    v_report := v_report || format('  %s  ->  %s   (%s)%s', r.dup_slug, r.canonical_slug, r.title, E'
');
  END LOOP;

  SELECT count(*) INTO n FROM (
    SELECT 1 FROM public.books
    GROUP BY lower(btrim(title)), lower(btrim(coalesce(author, ''))) HAVING count(*) > 1) g;
  v_report := v_report || format('  duplicate groups remaining: %s%s', n, E'
');

  SELECT count(*) INTO n FROM public.user_books ub
    LEFT JOIN public.books b ON b.id = ub.book_id WHERE b.id IS NULL;
  v_report := v_report || format('  orphaned user_books: %s%s', n, E'
');

  SELECT count(*) INTO n FROM public.reviews rv
    LEFT JOIN public.books b ON b.id = rv.book_id WHERE b.id IS NULL;
  v_report := v_report || format('  orphaned reviews: %s%s', n, E'
');

  SELECT count(*) INTO n FROM public.activity_feed af
    LEFT JOIN public.books b ON b.id = af.book_id WHERE af.book_id IS NOT NULL AND b.id IS NULL;
  v_report := v_report || format('  orphaned activity_feed: %s%s', n, E'
');

  SELECT count(*) INTO n FROM public.books;
  v_report := v_report || format('  books after: %s%s', n, E'
');

  SELECT count(*) INTO n FROM public.books WHERE slug = 'harry-potter-and-the-order-of-the-phoenix';
  v_report := v_report || format('  harry potter row retitled: %s%s', n, E'
');

  RAISE EXCEPTION '%', v_report || '  (rolled back -- nothing was changed)';
END $$;

ROLLBACK;
