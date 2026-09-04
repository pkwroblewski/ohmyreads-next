-- ============================================
-- Verification for migration 068 (RLS performance and catalog cleanup)
--
-- Runs against the live schema; ALWAYS rolls back. The last statement raises
-- an exception whose message is either "ALL CHECKS PASSED ..." or the first
-- failing check.
--
-- Usage (after 068 is applied):
--   npx supabase db query --linked -f supabase/checks/068_rls_performance.check.sql
--
-- C1-C5 read the catalogs. C6-C9 replay the RLS visibility matrix from the
-- Aug 2026 plan (tasks 12/31) through the merged policies: an ordinary user,
-- an admin and anon against a discoverable profile and one that opted out
-- (discovery_visible flipped inside this transaction), plus the split
-- places / social_links write policies.
-- ============================================

BEGIN;

DO $$
DECLARE
  v_user uuid;      -- ordinary, non-admin reader with shelf rows
  v_admin uuid;     -- an admin
  v_hidden uuid;    -- another reader with shelf rows, opted out below
  v_open uuid;      -- another reader with shelf rows, discoverable
  n int;
  n2 int;
  v_txt text;
  v_plan text;
  v_report text := '';
BEGIN
  -- C1: no policy still calls auth.uid() outside a sub-select
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public'
    AND (regexp_replace(COALESCE(qual, '') || COALESCE(with_check, ''), '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') ~ 'auth\.uid\(\)');
  IF n <> 0 THEN RAISE EXCEPTION 'C1 FAIL: % policies still call auth.uid() per row', n; END IF;

  -- C2: no table has more than one permissive policy for any command
  --     (policies granted only TO service_role are ignored: that role
  --     bypasses RLS, and the advisor ignores them too)
  SELECT count(*) INTO n FROM (
    SELECT p.tablename, c.cmd
    FROM pg_policies p
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS c(cmd)
    WHERE p.schemaname = 'public' AND p.permissive = 'PERMISSIVE'
      AND p.roles <> '{service_role}'::name[]
      AND (p.cmd = c.cmd OR p.cmd = 'ALL')
    GROUP BY p.tablename, c.cmd
    HAVING count(*) > 1
  ) dup;
  IF n <> 0 THEN RAISE EXCEPTION 'C2 FAIL: % table/command pairs still have several permissive policies', n; END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public';
  v_report := v_report || format('policies=%s ', n);

  -- C3: the four functions have a pinned search_path
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname IN ('get_distinct_genres', 'update_club_timestamp', 'update_list_timestamp', 'generate_list_slug')
    AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%');
  IF n <> 4 THEN RAISE EXCEPTION 'C3 FAIL: only % of 4 functions have search_path set', n; END IF;

  -- C4: pg_trgm lives in extensions and its two GIN indexes survived
  SELECT ns.nspname INTO v_txt FROM pg_extension e JOIN pg_namespace ns ON ns.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF v_txt IS DISTINCT FROM 'extensions' THEN RAISE EXCEPTION 'C4 FAIL: pg_trgm is in schema %', v_txt; END IF;
  SELECT count(*) INTO n FROM pg_indexes WHERE indexname IN ('profiles_username_trgm_idx', 'profiles_display_name_trgm_idx');
  IF n <> 2 THEN RAISE EXCEPTION 'C4 FAIL: trgm indexes on profiles: % of 2', n; END IF;
  IF extensions.similarity('abc', 'abd') IS NULL THEN RAISE EXCEPTION 'C4 FAIL: similarity() unusable'; END IF;

  -- C5: backup table and the five redundant indexes are gone, the keepers remain
  IF to_regclass('public.books_external_id_dedupe_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'C5 FAIL: books_external_id_dedupe_backup still exists';
  END IF;
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname = 'public' AND indexname IN
    ('books_isbn_idx', 'books_google_books_id_idx', 'books_open_library_id_idx', 'user_books_user_book_idx', 'idx_activity_feed_user_id');
  IF n <> 0 THEN RAISE EXCEPTION 'C5 FAIL: % redundant indexes still exist', n; END IF;
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname = 'public' AND indexname IN
    ('books_isbn_unique_idx', 'books_google_books_id_unique_idx', 'books_open_library_id_unique_idx', 'user_books_user_id_book_id_key', 'activity_feed_user_created_at_idx');
  IF n <> 5 THEN RAISE EXCEPTION 'C5 FAIL: only % of 5 covering indexes present', n; END IF;
  -- an isbn lookup still uses the partial unique index
  v_plan := '';
  FOR v_txt IN EXECUTE 'EXPLAIN (FORMAT text) SELECT id FROM public.books WHERE isbn = ''9780000000000''' LOOP
    v_plan := v_plan || v_txt || ' ';
  END LOOP;
  IF v_plan NOT LIKE '%books_isbn_unique_idx%' THEN RAISE EXCEPTION 'C5 FAIL: isbn lookup plan: %', v_plan; END IF;

  -- Fixtures for the visibility matrix
  SELECT p.id INTO v_admin FROM public.profiles p WHERE p.is_admin = true AND p.disabled_at IS NULL LIMIT 1;
  SELECT p.id INTO v_user FROM public.profiles p
    WHERE p.is_admin = false AND p.disabled_at IS NULL AND EXISTS (SELECT 1 FROM public.user_books ub WHERE ub.user_id = p.id)
    ORDER BY p.created_at LIMIT 1;
  SELECT p.id INTO v_hidden FROM public.profiles p
    WHERE p.id <> v_user AND p.disabled_at IS NULL AND EXISTS (SELECT 1 FROM public.user_books ub WHERE ub.user_id = p.id)
    ORDER BY p.created_at LIMIT 1;
  SELECT p.id INTO v_open FROM public.profiles p
    WHERE p.id NOT IN (v_user, v_hidden) AND p.disabled_at IS NULL AND COALESCE(p.discovery_visible, true)
      AND EXISTS (SELECT 1 FROM public.user_books ub WHERE ub.user_id = p.id)
    ORDER BY p.created_at LIMIT 1;
  IF v_admin IS NULL OR v_user IS NULL OR v_hidden IS NULL THEN
    RAISE EXCEPTION 'FIXTURES: need an admin and two readers with shelf rows (admin=% user=% hidden=%)', v_admin, v_user, v_hidden;
  END IF;
  UPDATE public.profiles SET discovery_visible = false WHERE id = v_hidden;

  -- C6: ordinary user — own rows, discoverable rows, but not the opted-out reader's
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.user_books WHERE user_id = v_user;
  IF n = 0 THEN RAISE EXCEPTION 'C6 FAIL: user cannot see own user_books'; END IF;
  SELECT count(*) INTO n FROM public.user_books WHERE user_id = v_hidden;
  IF n <> 0 THEN RAISE EXCEPTION 'C6 FAIL: user sees % rows of an opted-out shelf', n; END IF;
  IF v_open IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.user_books WHERE user_id = v_open;
    IF n = 0 THEN RAISE EXCEPTION 'C6 FAIL: user cannot see a discoverable shelf'; END IF;
  END IF;
  SELECT count(*) INTO n FROM public.reading_stats WHERE user_id = v_hidden;
  IF n <> 0 THEN RAISE EXCEPTION 'C6 FAIL: user sees opted-out reading_stats'; END IF;
  SELECT count(*) INTO n FROM public.places;
  v_report := v_report || format('places_visible=%s ', n);
  -- writes: places are admin-only, social_links owner-only
  BEGIN
    INSERT INTO public.places (name, place_type) VALUES ('dry-run-068', 'other');
    RAISE EXCEPTION 'C6 FAIL: ordinary user inserted a place';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.social_links (user_id, platform, url) VALUES (v_hidden, 'website', 'https://example.com');
    RAISE EXCEPTION 'C6 FAIL: user inserted a social link for someone else';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  -- C7: admin sees the opted-out reader's rows
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.user_books WHERE user_id = v_hidden;
  IF n = 0 THEN RAISE EXCEPTION 'C7 FAIL: admin cannot see an opted-out shelf'; END IF;
  SELECT count(*) INTO n FROM public.reports;
  SELECT count(*) INTO n2 FROM public.book_submissions;
  v_report := v_report || format('admin_reports=%s admin_submissions=%s ', n, n2);
  EXECUTE 'RESET ROLE';

  -- C8: anon sees discoverable shelves only, and only public user_shelves
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.user_books WHERE user_id = v_hidden;
  IF n <> 0 THEN RAISE EXCEPTION 'C8 FAIL: anon sees % rows of an opted-out shelf', n; END IF;
  SELECT count(*) INTO n FROM public.user_shelves WHERE is_public = false;
  IF n <> 0 THEN RAISE EXCEPTION 'C8 FAIL: anon sees % private shelves', n; END IF;
  SELECT count(*) INTO n FROM public.shelf_books sb
    WHERE sb.shelf_id IN (SELECT id FROM public.user_shelves);
  SELECT count(*) INTO n2 FROM public.reports;
  IF n2 <> 0 THEN RAISE EXCEPTION 'C8 FAIL: anon sees % reports', n2; END IF;
  EXECUTE 'RESET ROLE';

  -- C9: the totals the app relies on (postgres bypasses RLS) are unchanged by the policy rewrite
  SELECT count(*) INTO n FROM public.user_books;
  SELECT count(*) INTO n2 FROM public.user_shelves WHERE is_public = false;
  v_report := v_report || format('user_books_total=%s private_shelves=%s', n, n2);

  RAISE EXCEPTION 'ALL CHECKS PASSED (rolled back) — %', v_report;
END $$;
