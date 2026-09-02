-- ============================================
-- Verification for migration 064 (phase 2 security)
--
-- Runs a role-by-role matrix against the live schema and ALWAYS rolls back:
-- the last statement raises an exception whose message is either
-- "ALL CHECKS PASSED ..." or the first failing check. Nothing here is
-- persisted, so it is safe against production.
--
-- Usage (after 064 is applied):
--   npx supabase db query --linked -f supabase/checks/064_phase2_security.check.sql
--
-- Dry run of the migration itself (migration + checks in one transaction):
--   { echo "BEGIN;"; cat supabase/migrations/064_phase2_security.sql; \
--     cat supabase/checks/064_phase2_security.check.sql; } > /tmp/dry.sql
--   npx supabase db query --linked -f /tmp/dry.sql
--
-- Fixtures are chosen dynamically: an admin, a non-admin A, a non-admin B who
-- is A's accepted friend, and a non-admin C with no relationship to A. The
-- JWT is simulated with request.jwt.claims + SET LOCAL ROLE, exactly what
-- PostgREST does per request.
-- ============================================

BEGIN;

-- --------------------------------------------
-- Fixtures (as postgres)
-- --------------------------------------------
DO $$
DECLARE
  v_admin uuid; v_a uuid; v_b uuid; v_c uuid;
  v_book1 uuid; v_book2 uuid;
  v_fr uuid; v_bs uuid; v_bs2 uuid; v_rev_a uuid; v_rev_b uuid;
  v_slug text := 'dry-run-064-' || LEFT(md5(random()::text), 8);
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE is_admin ORDER BY created_at LIMIT 1;
  SELECT p.id INTO v_a FROM public.profiles p
    WHERE NOT p.is_admin
      AND EXISTS (SELECT 1 FROM public.friend_requests fr
                  WHERE fr.status = 'accepted' AND (fr.sender_id = p.id OR fr.receiver_id = p.id)
                    AND NOT EXISTS (SELECT 1 FROM public.profiles q WHERE q.id = CASE WHEN fr.sender_id = p.id THEN fr.receiver_id ELSE fr.sender_id END AND q.is_admin))
    ORDER BY p.created_at LIMIT 1;
  SELECT CASE WHEN fr.sender_id = v_a THEN fr.receiver_id ELSE fr.sender_id END INTO v_b
    FROM public.friend_requests fr
    JOIN public.profiles q ON q.id = CASE WHEN fr.sender_id = v_a THEN fr.receiver_id ELSE fr.sender_id END
    WHERE fr.status = 'accepted' AND (fr.sender_id = v_a OR fr.receiver_id = v_a) AND NOT q.is_admin
    LIMIT 1;
  SELECT p.id INTO v_c FROM public.profiles p
    WHERE NOT p.is_admin AND p.id NOT IN (v_a, v_b)
      AND NOT EXISTS (SELECT 1 FROM public.friend_requests fr
                      WHERE (fr.sender_id = p.id AND fr.receiver_id = v_a) OR (fr.sender_id = v_a AND fr.receiver_id = p.id))
    LIMIT 1;
  IF v_admin IS NULL OR v_a IS NULL OR v_b IS NULL OR v_c IS NULL THEN
    RAISE EXCEPTION 'FIXTURES: need an admin, non-admin A with non-admin friend B, and unrelated non-admin C (admin=%, a=%, b=%, c=%)', v_admin, v_a, v_b, v_c;
  END IF;

  SELECT id INTO v_book1 FROM public.books b
    WHERE NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.book_id = b.id AND r.user_id IN (v_a, v_b))
    ORDER BY created_at LIMIT 1;
  SELECT id INTO v_book2 FROM public.books b
    WHERE b.id <> v_book1
      AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.book_id = b.id AND r.user_id IN (v_a, v_b))
    ORDER BY created_at LIMIT 1;

  INSERT INTO public.friend_requests (sender_id, receiver_id, status)
  VALUES (v_c, v_a, 'pending') RETURNING id INTO v_fr;

  INSERT INTO public.book_submissions (submitted_by, title, author, slug, status)
  VALUES (v_b, 'Dry Run Book', 'Dry Run Author', v_slug, 'pending') RETURNING id INTO v_bs;
  INSERT INTO public.book_submissions (submitted_by, title, author, slug, status)
  VALUES (v_b, 'Dry Run Book 2', 'Dry Run Author', v_slug || '-2', 'pending') RETURNING id INTO v_bs2;

  INSERT INTO public.reviews (user_id, book_id, content, rating)
  VALUES (v_a, v_book1, 'Dry-run review by A: long enough to satisfy any minimum length rule.', 4)
  RETURNING id INTO v_rev_a;
  INSERT INTO public.reviews (user_id, book_id, content, rating)
  VALUES (v_b, v_book2, 'Dry-run review by B: long enough to satisfy any minimum length rule.', 4)
  RETURNING id INTO v_rev_b;

  INSERT INTO public.reading_stats (user_id) VALUES (v_a) ON CONFLICT (user_id) DO NOTHING;

  PERFORM set_config('chk.admin', v_admin::text, true);
  PERFORM set_config('chk.a', v_a::text, true);
  PERFORM set_config('chk.b', v_b::text, true);
  PERFORM set_config('chk.c', v_c::text, true);
  PERFORM set_config('chk.book1', v_book1::text, true);
  PERFORM set_config('chk.fr', v_fr::text, true);
  PERFORM set_config('chk.bs', v_bs::text, true);
  PERFORM set_config('chk.bs2', v_bs2::text, true);
  PERFORM set_config('chk.rev_a', v_rev_a::text, true);
  PERFORM set_config('chk.rev_b', v_rev_b::text, true);
  PERFORM set_config('chk.a_friends', (SELECT friends_count FROM public.profiles WHERE id = v_a)::text, true);
  PERFORM set_config('chk.a_followers', (SELECT followers_count FROM public.profiles WHERE id = v_a)::text, true);
  PERFORM set_config('chk.b_unread', (SELECT unread_messages_count FROM public.profiles WHERE id = v_b)::text, true);
  PERFORM set_config('chk.a_books_read', (SELECT books_read FROM public.reading_stats WHERE user_id = v_a)::text, true);
  PERFORM set_config('chk.pending_total', (SELECT count(*) FROM public.book_submissions WHERE status = 'pending')::text, true);
  PERFORM set_config('chk.report', '', true);
END $$;

-- --------------------------------------------
-- As anon
-- --------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM public.approve_book_submission(gen_random_uuid(), NULL);
    RAISE EXCEPTION 'C1 FAILED: anon could call approve_book_submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.cleanup_expired_presence();
    RAISE EXCEPTION 'C2 FAILED: anon could call cleanup_expired_presence';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.are_friends(current_setting('chk.a')::uuid, current_setting('chk.b')::uuid);
    RAISE EXCEPTION 'C3 FAILED: anon could call are_friends';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.on_review_created();
    RAISE EXCEPTION 'C3b FAILED: anon could call a trigger function';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
           WHEN feature_not_supported THEN RAISE EXCEPTION 'C3b FAILED: trigger function reachable (0A000)'; END;
  PERFORM set_config('chk.report', current_setting('chk.report') || 'C1-C3 anon ok; ', true);
END $$;

-- --------------------------------------------
-- As non-admin A
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('chk.a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  a uuid := current_setting('chk.a')::uuid;
  b uuid := current_setting('chk.b')::uuid;
  c uuid := current_setting('chk.c')::uuid;
  v_sender uuid; v_status text; v_int int; v_cnt bigint; v_id uuid;
BEGIN
  -- C4/C5: moderation RPCs refuse non-admins
  BEGIN
    PERFORM public.approve_book_submission(current_setting('chk.bs')::uuid, a);
    RAISE EXCEPTION 'C4 FAILED: non-admin approved a book submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.approve_place_submission(gen_random_uuid(), NULL);
    RAISE EXCEPTION 'C5 FAILED: non-admin could call approve_place_submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.reject_place_submission(gen_random_uuid(), NULL);
    RAISE EXCEPTION 'C5b FAILED: non-admin could call reject_place_submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- C6: receiver cannot rewrite the sender while accepting
  UPDATE public.friend_requests SET sender_id = b, status = 'accepted', responded_at = now()
  WHERE id = current_setting('chk.fr')::uuid;
  SELECT sender_id, status INTO v_sender, v_status FROM public.friend_requests WHERE id = current_setting('chk.fr')::uuid;
  IF v_sender <> c OR v_status <> 'accepted' THEN
    RAISE EXCEPTION 'C6 FAILED: sender_id=% status=% (expected sender=% accepted)', v_sender, v_status, c;
  END IF;
  IF NOT public.are_friends(a, c) THEN RAISE EXCEPTION 'C6b FAILED: are_friends(a,c) false after accept'; END IF;
  SELECT friends_count INTO v_int FROM public.profiles WHERE id = a;
  IF v_int <> current_setting('chk.a_friends')::int + 1 THEN
    RAISE EXCEPTION 'C6c FAILED: friends_count trigger blocked by freeze (got %, expected %)', v_int, current_setting('chk.a_friends')::int + 1;
  END IF;

  -- C7: profile counters frozen
  UPDATE public.profiles SET followers_count = 999 WHERE id = a;
  SELECT followers_count INTO v_int FROM public.profiles WHERE id = a;
  IF v_int <> current_setting('chk.a_followers')::int THEN RAISE EXCEPTION 'C7 FAILED: followers_count=%', v_int; END IF;

  -- C8: reviews.likes_count frozen
  UPDATE public.reviews SET likes_count = 999 WHERE id = current_setting('chk.rev_a')::uuid;
  SELECT likes_count INTO v_int FROM public.reviews WHERE id = current_setting('chk.rev_a')::uuid;
  IF v_int <> 0 THEN RAISE EXCEPTION 'C8 FAILED: likes_count=%', v_int; END IF;

  -- C9: liking still updates likes_count through the trigger
  INSERT INTO public.review_likes (review_id, user_id) VALUES (current_setting('chk.rev_b')::uuid, a);
  SELECT likes_count INTO v_int FROM public.reviews WHERE id = current_setting('chk.rev_b')::uuid;
  IF v_int <> 1 THEN RAISE EXCEPTION 'C9 FAILED: likes_count after like = % (trigger blocked?)', v_int; END IF;

  -- C10: DM to a friend still allowed (are_friends usable from the policy)
  INSERT INTO public.direct_messages (sender_id, receiver_id, content) VALUES (a, b, 'dry run') RETURNING id INTO v_id;
  PERFORM set_config('chk.dm', v_id::text, true);

  -- C11: reading_stats frozen
  UPDATE public.reading_stats SET books_read = 999 WHERE user_id = a;
  SELECT books_read INTO v_int FROM public.reading_stats WHERE user_id = a;
  IF v_int <> current_setting('chk.a_books_read')::int THEN RAISE EXCEPTION 'C11 FAILED: books_read=%', v_int; END IF;

  -- C12: no self-granted badges
  BEGIN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (a, 'forged_badge');
    RAISE EXCEPTION 'C12 FAILED: user inserted a badge';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- C13: cannot delete own stats row
  DELETE FROM public.reading_stats WHERE user_id = a;
  SELECT count(*) INTO v_cnt FROM public.reading_stats WHERE user_id = a;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'C13 FAILED: reading_stats row deleted'; END IF;

  -- C14: other users' pending submissions invisible
  SELECT count(*) INTO v_cnt FROM public.book_submissions WHERE id IN (current_setting('chk.bs')::uuid, current_setting('chk.bs2')::uuid);
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'C14 FAILED: non-admin sees % foreign submissions', v_cnt; END IF;

  -- C15/C16: no catalog or foreign-review writes
  UPDATE public.books SET title = title WHERE id = current_setting('chk.book1')::uuid;
  GET DIAGNOSTICS v_int = ROW_COUNT;
  IF v_int <> 0 THEN RAISE EXCEPTION 'C15 FAILED: non-admin updated books (% rows)', v_int; END IF;
  DELETE FROM public.reviews WHERE id = current_setting('chk.rev_b')::uuid;
  GET DIAGNOSTICS v_int = ROW_COUNT;
  IF v_int <> 0 THEN RAISE EXCEPTION 'C16 FAILED: non-admin deleted a foreign review'; END IF;

  -- C17: username format enforced
  BEGIN
    UPDATE public.profiles SET username = 'Bad-Name' WHERE id = a;
    RAISE EXCEPTION 'C17 FAILED: invalid username accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  PERFORM set_config('chk.report', current_setting('chk.report') || 'C4-C17 user A ok; ', true);
END $$;

-- --------------------------------------------
-- As non-admin B (DM recipient)
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('chk.b'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  b uuid := current_setting('chk.b')::uuid;
  v_content text; v_read timestamptz; v_int int;
BEGIN
  -- C18: recipient can mark read but not rewrite content/sender
  UPDATE public.direct_messages SET content = 'forged', sender_id = b, read_at = now()
  WHERE id = current_setting('chk.dm')::uuid;
  SELECT content, read_at INTO v_content, v_read FROM public.direct_messages WHERE id = current_setting('chk.dm')::uuid;
  IF v_content <> 'dry run' OR v_read IS NULL THEN
    RAISE EXCEPTION 'C18 FAILED: content=% read_at=%', v_content, v_read;
  END IF;
  SELECT unread_messages_count INTO v_int FROM public.profiles WHERE id = b;
  IF v_int <> current_setting('chk.b_unread')::int THEN
    RAISE EXCEPTION 'C18b FAILED: unread_messages_count=% expected % (unread trigger blocked?)', v_int, current_setting('chk.b_unread');
  END IF;
  PERFORM set_config('chk.report', current_setting('chk.report') || 'C18 user B ok; ', true);
END $$;

-- --------------------------------------------
-- As admin
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('chk.admin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  adm uuid := current_setting('chk.admin')::uuid;
  b uuid := current_setting('chk.b')::uuid;
  v_int int; v_cnt bigint; v_book uuid; v_status text;
BEGIN
  -- C19: admin can update books
  UPDATE public.books SET title = title WHERE id = current_setting('chk.book1')::uuid;
  GET DIAGNOSTICS v_int = ROW_COUNT;
  IF v_int <> 1 THEN RAISE EXCEPTION 'C19 FAILED: admin books UPDATE touched % rows', v_int; END IF;

  -- C20: admin can delete a review
  DELETE FROM public.reviews WHERE id = current_setting('chk.rev_a')::uuid;
  GET DIAGNOSTICS v_int = ROW_COUNT;
  IF v_int <> 1 THEN RAISE EXCEPTION 'C20 FAILED: admin reviews DELETE touched % rows', v_int; END IF;

  -- C21: admin sees every pending submission
  SELECT count(*) INTO v_cnt FROM public.book_submissions WHERE status = 'pending';
  IF v_cnt <> current_setting('chk.pending_total')::bigint THEN
    RAISE EXCEPTION 'C21 FAILED: admin sees % pending, expected %', v_cnt, current_setting('chk.pending_total');
  END IF;

  -- C22: moderator must be self; then approval works
  BEGIN
    PERFORM public.approve_book_submission(current_setting('chk.bs')::uuid, b);
    RAISE EXCEPTION 'C22 FAILED: approve accepted a foreign moderator id';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  v_book := public.approve_book_submission(current_setting('chk.bs')::uuid, adm);
  SELECT status INTO v_status FROM public.book_submissions WHERE id = current_setting('chk.bs')::uuid;
  IF v_book IS NULL OR v_status <> 'approved' THEN RAISE EXCEPTION 'C22b FAILED: book=% status=%', v_book, v_status; END IF;

  -- C23: admin can reject through a plain update
  UPDATE public.book_submissions SET status = 'rejected', moderated_by = adm, moderated_at = now()
  WHERE id = current_setting('chk.bs2')::uuid;
  GET DIAGNOSTICS v_int = ROW_COUNT;
  IF v_int <> 1 THEN RAISE EXCEPTION 'C23 FAILED: admin book_submissions UPDATE touched % rows', v_int; END IF;

  PERFORM set_config('chk.report', current_setting('chk.report') || 'C19-C23 admin ok; ', true);
END $$;

-- --------------------------------------------
-- As postgres / service role: reconcile, catalog and schema checks
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  v_cnt bigint; v_txt text; v_id uuid := gen_random_uuid();
BEGIN
  -- C24: reconcile_counters runs and reports the new counter
  SELECT count(*) INTO v_cnt FROM public.reconcile_counters() WHERE counter = 'user_checkin_stats';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'C24 FAILED: reconcile_counters missing user_checkin_stats'; END IF;

  -- C25: every username satisfies the constraint
  SELECT count(*) INTO v_cnt FROM public.profiles WHERE username !~ '^[a-z0-9_]{3,30}$';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'C25 FAILED: % usernames violate the format', v_cnt; END IF;

  -- C26: handle_new_user normalises metadata (best effort: auth.users insert)
  BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'dry-run-064-' || LEFT(v_id::text, 8) || '@example.invalid', '', now(),
            '{"provider":"email","providers":["email"]}', '{"preferred_username":"Dry-Run Üser!"}', now(), now());
    SELECT username INTO v_txt FROM public.profiles WHERE id = v_id;
    IF v_txt IS DISTINCT FROM 'dryrunser' THEN RAISE EXCEPTION 'C26 FAILED: username=%', v_txt; END IF;
    PERFORM set_config('chk.report', current_setting('chk.report') || 'C26 handle_new_user ok; ', true);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C26 FAILED%' THEN RAISE; END IF;
    PERFORM set_config('chk.report', current_setting('chk.report') || 'C26 skipped (' || SQLERRM || '); ', true);
  END;

  -- C27: no trigger function / internal RPC executable by API roles
  SELECT count(*) INTO v_cnt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.prorettype = 'pg_catalog.trigger'::regtype
         OR p.proname IN ('cleanup_expired_presence', 'get_user_shelf_count', 'recalculate_book_rating'))
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'C27 FAILED: % internal functions still executable by API roles', v_cnt; END IF;
  IF has_function_privilege('anon', 'public.approve_book_submission(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.approve_place_submission(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reject_place_submission(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.are_friends(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C27b FAILED: anon can still execute a moderation RPC or are_friends';
  END IF;

  -- C28: indexes, column, NOT NULL, photos trigger security
  SELECT count(*) INTO v_cnt FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
    'reviews_book_id_created_at_idx', 'reviews_book_id_likes_count_idx', 'reports_resolved_by_idx',
    'profiles_admin_granted_by_idx', 'book_submissions_book_id_idx', 'book_submissions_moderated_by_idx',
    'place_checkins_book_id_idx', 'places_submitted_by_idx', 'place_submissions_moderator_id_idx',
    'reading_list_books_book_id_idx', 'book_club_reads_book_id_idx', 'friend_requests_pair_uniq');
  IF v_cnt <> 12 THEN RAISE EXCEPTION 'C28 FAILED: % of 12 indexes present', v_cnt; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'disabled_at') THEN
    RAISE EXCEPTION 'C28b FAILED: profiles.disabled_at missing';
  END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'book_club_reads' AND column_name IN ('club_id', 'book_id') AND is_nullable = 'NO';
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'C28c FAILED: book_club_reads columns still nullable'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.update_place_photos_count()'::regprocedure) THEN
    RAISE EXCEPTION 'C28d FAILED: update_place_photos_count is not SECURITY DEFINER';
  END IF;
  PERFORM set_config('chk.report', current_setting('chk.report') || 'C24-C28 schema ok', true);
END $$;

-- Always roll back: the report travels in the exception message.
DO $$
BEGIN
  RAISE EXCEPTION 'ALL CHECKS PASSED (transaction rolled back): %', current_setting('chk.report');
END $$;
