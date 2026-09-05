-- ============================================
-- Verification for migration 069 (catalog dedupe + harry-potter-1)
--
-- Runs against the live data; ALWAYS rolls back. The last statement raises
-- an exception whose message is either "ALL CHECKS PASSED ..." or the first
-- failing check.
--
-- Usage (after 069 is applied):
--   npx supabase db query --linked -f supabase/checks/069_dedupe_books.check.sql
--
-- The rolled-back preview that was run before applying is the sibling file
-- 069_dedupe_books.dryrun.sql.
-- ============================================

BEGIN;

DO $$
DECLARE
  n int;
  v_report text := '';
BEGIN
  -- C1: no title+author group has more than one row
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM public.books
    GROUP BY lower(btrim(title)), lower(btrim(coalesce(author, '')))
    HAVING count(*) > 1
  ) g;
  IF n <> 0 THEN RAISE EXCEPTION 'C1 FAIL: % duplicate title+author groups remain', n; END IF;
  v_report := v_report || 'C1 no duplicate groups; ';

  -- C2: no `-N` slug survives that duplicates its unsuffixed sibling by the
  --     same author (same title by another author is a different book:
  --     "The Deep" by Nick Cutter and by Alma Katsu both stay)
  SELECT count(*) INTO n
  FROM public.books d
  JOIN public.books c
    ON c.slug = regexp_replace(d.slug, '-[0-9]+$', '')
   AND lower(btrim(coalesce(c.author, ''))) = lower(btrim(coalesce(d.author, '')))
  WHERE d.slug ~ '-[0-9]+$';
  IF n <> 0 THEN RAISE EXCEPTION 'C2 FAIL: % suffixed slugs still shadow a sibling', n; END IF;
  v_report := v_report || 'C2 no shadow slugs; ';

  -- C3: nothing points at a book that is gone
  SELECT count(*) INTO n FROM public.user_books ub
    LEFT JOIN public.books b ON b.id = ub.book_id WHERE b.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: % orphaned user_books', n; END IF;
  SELECT count(*) INTO n FROM public.reviews rv
    LEFT JOIN public.books b ON b.id = rv.book_id WHERE b.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: % orphaned reviews', n; END IF;
  SELECT count(*) INTO n FROM public.reading_list_books rl
    LEFT JOIN public.books b ON b.id = rl.book_id WHERE b.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: % orphaned reading_list_books', n; END IF;
  SELECT count(*) INTO n FROM public.book_club_reads cr
    LEFT JOIN public.books b ON b.id = cr.book_id WHERE b.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: % orphaned book_club_reads', n; END IF;
  SELECT count(*) INTO n FROM public.activity_feed af
    LEFT JOIN public.books b ON b.id = af.book_id
    WHERE af.book_id IS NOT NULL AND b.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: % orphaned activity_feed rows', n; END IF;
  v_report := v_report || 'C3 no orphans; ';

  -- C4: harry-potter-1 is gone and the Order of the Phoenix row exists once
  SELECT count(*) INTO n FROM public.books WHERE slug = 'harry-potter-1';
  IF n <> 0 THEN RAISE EXCEPTION 'C4 FAIL: harry-potter-1 still exists'; END IF;
  SELECT count(*) INTO n FROM public.books
    WHERE slug = 'harry-potter-and-the-order-of-the-phoenix' AND isbn = '9780439358071';
  IF n <> 1 THEN RAISE EXCEPTION 'C4 FAIL: expected 1 Order of the Phoenix row, found %', n; END IF;
  v_report := v_report || 'C4 harry potter fixed; ';

  SELECT count(*) INTO n FROM public.books;
  RAISE EXCEPTION 'ALL CHECKS PASSED (%) books=%', v_report, n;
END $$;

ROLLBACK;
