-- ============================================
-- Verification for migration 067 (account deletion)
--
-- Runs against the live schema; ALWAYS rolls back. The last statement raises
-- an exception whose message is either "ALL CHECKS PASSED ..." or the first
-- failing check.
--
-- Usage (after 067 is applied):
--   npx supabase db query --linked -f supabase/checks/067_account_deletion.check.sql
--
-- Fixtures: a throwaway auth user (the on_auth_user_created trigger gives it
-- a profile) with a shelf row, a review, a report it filed and a submission
-- it moderated. Deleting the auth user must cascade the owned rows, keep the
-- report and submission with a NULL actor, and not trip the reading_stats
-- trigger (the 23503 the first live run hit).
-- ============================================

BEGIN;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_other uuid;
  v_book uuid;
  v_review uuid;
  v_report uuid;
  v_submission uuid;
  v_tag text := 'dry-run-067-' || LEFT(md5(random()::text), 8);
  n int;
  v_def text;
BEGIN
  -- C1: the schema changes are in place
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'reporter_id') <> 'YES' THEN
    RAISE EXCEPTION 'C1 FAIL: reports.reporter_id is still NOT NULL';
  END IF;
  IF (SELECT confdeltype FROM pg_constraint WHERE conname = 'reports_reporter_id_fkey') <> 'n' THEN
    RAISE EXCEPTION 'C1 FAIL: reports.reporter_id FK is not ON DELETE SET NULL';
  END IF;
  IF (SELECT confdeltype FROM pg_constraint WHERE conname = 'book_submissions_moderated_by_fkey') <> 'n' THEN
    RAISE EXCEPTION 'C1 FAIL: book_submissions.moderated_by FK is not ON DELETE SET NULL';
  END IF;
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'sync_reading_stats';
  IF v_def IS NULL OR v_def NOT LIKE '%FROM auth.users WHERE id = v_user_id%' THEN
    RAISE EXCEPTION 'C1 FAIL: sync_reading_stats has no departed-user guard';
  END IF;

  -- Fixtures
  SELECT id INTO v_other FROM public.profiles WHERE disabled_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v_book FROM public.books ORDER BY created_at LIMIT 1;
  IF v_other IS NULL OR v_book IS NULL THEN
    RAISE EXCEPTION 'FIXTURES: need one profile and one book';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_tag || '@example.com', 'x', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
    RAISE EXCEPTION 'FIXTURES: on_auth_user_created did not create a profile';
  END IF;

  INSERT INTO public.user_books (user_id, book_id, status) VALUES (v_user, v_book, 'read');
  INSERT INTO public.reviews (user_id, book_id, content)
    VALUES (v_user, v_book, v_tag || ' review text long enough to satisfy the length rule.')
    RETURNING id INTO v_review;
  -- the stats trigger has now created a reading_stats row for v_user
  IF NOT EXISTS (SELECT 1 FROM public.reading_stats WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'FIXTURES: reading_stats row was not created by the trigger';
  END IF;
  INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
    VALUES (v_user, 'review', v_review, 'spam') RETURNING id INTO v_report;
  INSERT INTO public.book_submissions (title, author, slug, submitted_by, moderated_by, status)
    VALUES (v_tag, 'x', v_tag, v_other, v_user, 'approved') RETURNING id INTO v_submission;

  -- C2: the deletion itself must not raise (this is what auth.admin.deleteUser does)
  DELETE FROM auth.users WHERE id = v_user;

  -- C3: owned rows are gone
  SELECT count(*) INTO n FROM public.profiles WHERE id = v_user;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: profile survived (%)', n; END IF;
  SELECT count(*) INTO n FROM public.user_books WHERE user_id = v_user;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: user_books survived (%)', n; END IF;
  SELECT count(*) INTO n FROM public.reviews WHERE user_id = v_user;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: reviews survived (%)', n; END IF;
  SELECT count(*) INTO n FROM public.reading_stats WHERE user_id = v_user;
  IF n <> 0 THEN RAISE EXCEPTION 'C3 FAIL: reading_stats survived (%)', n; END IF;

  -- C4: moderation history survives, anonymised
  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE id = v_report AND reporter_id IS NULL) THEN
    RAISE EXCEPTION 'C4 FAIL: the report was not kept with a NULL reporter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.book_submissions WHERE id = v_submission AND moderated_by IS NULL) THEN
    RAISE EXCEPTION 'C4 FAIL: the submission was not kept with a NULL moderator';
  END IF;

  RAISE EXCEPTION 'ALL CHECKS PASSED (C1-C4) — rolled back, tag %', v_tag;
END $$;

ROLLBACK;
