-- ============================================
-- Verification for migration 066 (disable user)
--
-- Role-by-role matrix against the live schema; ALWAYS rolls back. The last
-- statement raises an exception whose message is either
-- "ALL CHECKS PASSED ..." or the first failing check.
--
-- Usage (after 066 is applied):
--   npx supabase db query --linked -f supabase/checks/066_disable_user.check.sql
--
-- Fixtures: an admin, a non-admin A (disabled inside this transaction only)
-- and a non-admin B. A gets a review, a comment on that review and a public
-- reading list; all of it vanishes with the rollback.
-- ============================================

BEGIN;

DO $$
DECLARE
  v_admin uuid; v_a uuid; v_b uuid; v_book uuid; v_rev uuid; v_list uuid; v_cmt uuid;
  v_tag text := 'dry-run-066-' || LEFT(md5(random()::text), 8);
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE is_admin AND disabled_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v_a FROM public.profiles WHERE NOT is_admin AND disabled_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v_b FROM public.profiles WHERE NOT is_admin AND disabled_at IS NULL AND id <> v_a ORDER BY created_at LIMIT 1;
  IF v_admin IS NULL OR v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'FIXTURES: need an admin and two non-admins (admin=%, a=%, b=%)', v_admin, v_a, v_b;
  END IF;

  SELECT id INTO v_book FROM public.books b
    WHERE NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.book_id = b.id AND r.user_id = v_a)
    ORDER BY created_at LIMIT 1;

  INSERT INTO public.reviews (user_id, book_id, content, rating)
  VALUES (v_a, v_book, 'Dry-run 066 review by A: long enough to satisfy any minimum length rule.', 4)
  RETURNING id INTO v_rev;
  INSERT INTO public.comments (review_id, user_id, content)
  VALUES (v_rev, v_a, 'Dry-run 066 comment by A') RETURNING id INTO v_cmt;
  INSERT INTO public.reading_lists (user_id, title, slug, visibility)
  VALUES (v_a, 'Dry-run 066 list', v_tag, 'public') RETURNING id INTO v_list;

  PERFORM set_config('chk.admin', v_admin::text, true);
  PERFORM set_config('chk.a', v_a::text, true);
  PERFORM set_config('chk.b', v_b::text, true);
  PERFORM set_config('chk.rev', v_rev::text, true);
  PERFORM set_config('chk.cmt', v_cmt::text, true);
  PERFORM set_config('chk.list', v_list::text, true);
  PERFORM set_config('chk.others', (SELECT count(*) FROM public.reviews WHERE user_id <> v_a)::text, true);
  PERFORM set_config('chk.report', '', true);

  -- The only thing the migration is about: A is disabled. The fixture must
  -- carry the service-role claim, or the trigger under test reverts it.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET disabled_at = now() WHERE id = v_a;
END $$;

-- --------------------------------------------
-- As anon
-- --------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
DECLARE v_cnt bigint;
BEGIN
  -- D1: A's review, comment and list are gone for the public
  SELECT count(*) INTO v_cnt FROM public.reviews WHERE id = current_setting('chk.rev')::uuid;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'D1 FAILED: anon sees a disabled author''s review'; END IF;
  SELECT count(*) INTO v_cnt FROM public.comments WHERE id = current_setting('chk.cmt')::uuid;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'D1b FAILED: anon sees a disabled author''s comment'; END IF;
  SELECT count(*) INTO v_cnt FROM public.reading_lists WHERE id = current_setting('chk.list')::uuid;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'D1c FAILED: anon sees a disabled author''s public list'; END IF;

  -- D2: everyone else's reviews are untouched
  SELECT count(*) INTO v_cnt FROM public.reviews WHERE user_id <> current_setting('chk.a')::uuid;
  IF v_cnt <> current_setting('chk.others')::bigint THEN
    RAISE EXCEPTION 'D2 FAILED: anon sees % other reviews, expected %', v_cnt, current_setting('chk.others');
  END IF;

  -- D3: the profile row itself stays readable (the app 404s it; joins must not break)
  SELECT count(*) INTO v_cnt FROM public.profiles WHERE id = current_setting('chk.a')::uuid AND disabled_at IS NOT NULL;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'D3 FAILED: anon cannot read the disabled profile row / disabled_at'; END IF;

  PERFORM set_config('chk.report', current_setting('chk.report') || 'D1-D3 anon ok; ', true);
END $$;

-- --------------------------------------------
-- As the disabled user A (a session that outlived the ban)
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('chk.a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_cnt bigint; v_ts timestamptz;
BEGIN
  -- D4: A still sees their own rows (re-enabling restores everything)
  SELECT count(*) INTO v_cnt FROM public.reviews WHERE id = current_setting('chk.rev')::uuid;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'D4 FAILED: author cannot see own review while disabled'; END IF;

  -- D5: A cannot clear disabled_at through the owner UPDATE policy
  UPDATE public.profiles SET disabled_at = NULL WHERE id = current_setting('chk.a')::uuid;
  SELECT disabled_at INTO v_ts FROM public.profiles WHERE id = current_setting('chk.a')::uuid;
  IF v_ts IS NULL THEN RAISE EXCEPTION 'D5 FAILED: disabled user cleared disabled_at'; END IF;

  -- D6: B's session cannot see A's content either
  PERFORM set_config('chk.report', current_setting('chk.report') || 'D4-D5 disabled user ok; ', true);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('chk.b'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.reviews WHERE id = current_setting('chk.rev')::uuid;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'D6 FAILED: another user sees a disabled author''s review'; END IF;
  SELECT count(*) INTO v_cnt FROM public.comments WHERE id = current_setting('chk.cmt')::uuid;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'D6b FAILED: another user sees a disabled author''s comment'; END IF;
  PERFORM set_config('chk.report', current_setting('chk.report') || 'D6 user B ok; ', true);
END $$;

-- --------------------------------------------
-- As admin
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('chk.admin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_cnt bigint; v_ts timestamptz;
BEGIN
  -- D7: moderation still sees everything
  SELECT count(*) INTO v_cnt FROM public.reviews WHERE id = current_setting('chk.rev')::uuid;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'D7 FAILED: admin cannot see a disabled author''s review'; END IF;
  SELECT count(*) INTO v_cnt FROM public.comments WHERE id = current_setting('chk.cmt')::uuid;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'D7b FAILED: admin cannot see a disabled author''s comment'; END IF;
  SELECT count(*) INTO v_cnt FROM public.reading_lists WHERE id = current_setting('chk.list')::uuid;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'D7c FAILED: admin cannot see a disabled author''s list'; END IF;

  -- D8: even an admin's session client cannot write disabled_at (service role only)
  UPDATE public.profiles SET disabled_at = NULL WHERE id = current_setting('chk.a')::uuid;
  SELECT disabled_at INTO v_ts FROM public.profiles WHERE id = current_setting('chk.a')::uuid;
  IF v_ts IS NULL THEN RAISE EXCEPTION 'D8 FAILED: admin session cleared disabled_at without the service role'; END IF;

  PERFORM set_config('chk.report', current_setting('chk.report') || 'D7-D8 admin ok; ', true);
END $$;

-- --------------------------------------------
-- As service role: the write path the actions use
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE v_ts timestamptz;
BEGIN
  UPDATE public.profiles SET disabled_at = NULL WHERE id = current_setting('chk.a')::uuid;
  SELECT disabled_at INTO v_ts FROM public.profiles WHERE id = current_setting('chk.a')::uuid;
  IF v_ts IS NOT NULL THEN RAISE EXCEPTION 'D9 FAILED: service role could not clear disabled_at'; END IF;
  PERFORM set_config('chk.report', current_setting('chk.report') || 'D9 service role ok', true);
END $$;

-- Always roll back: the report travels in the exception message.
DO $$
BEGIN
  RAISE EXCEPTION 'ALL CHECKS PASSED (transaction rolled back): %', current_setting('chk.report');
END $$;
