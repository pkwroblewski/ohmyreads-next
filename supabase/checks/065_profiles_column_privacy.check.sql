-- ============================================
-- Verification for migration 065 (profiles column privacy)
--
-- Role-by-role matrix against the live schema; ALWAYS rolls back. The last
-- statement raises "ALL CHECKS PASSED ..." or the first failing check.
--
-- Usage (after 065 is applied):
--   npx supabase db query --linked -f supabase/checks/065_profiles_column_privacy.check.sql
--
-- Dry run (migration + checks in one transaction):
--   { echo "BEGIN;"; cat supabase/migrations/065_profiles_column_privacy.sql; \
--     cat supabase/checks/065_profiles_column_privacy.check.sql; } > /tmp/dry.sql
--   npx supabase db query --linked -f /tmp/dry.sql
--
-- Fixtures (non-admins, chosen dynamically, mutated inside the transaction):
--   A  active check-in at geohash u33dc1 (visible)
--   B  check-in expired an hour ago             (hidden)
--   C  active check-in but discovery_visible=false (hidden)
--   D  active check-in but disabled_at set        (hidden)
-- ============================================

BEGIN;

DO $$
DECLARE
  v_a uuid; v_b uuid; v_c uuid; v_d uuid;
BEGIN
  SELECT id INTO v_a FROM public.profiles WHERE is_admin IS NOT TRUE ORDER BY created_at OFFSET 0 LIMIT 1;
  SELECT id INTO v_b FROM public.profiles WHERE is_admin IS NOT TRUE ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_c FROM public.profiles WHERE is_admin IS NOT TRUE ORDER BY created_at OFFSET 2 LIMIT 1;
  -- D only needs disabled_at set; it may be an admin (the DB has few users)
  SELECT id INTO v_d FROM public.profiles WHERE id NOT IN (v_a, v_b, v_c) ORDER BY created_at LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL OR v_c IS NULL OR v_d IS NULL THEN
    RAISE EXCEPTION 'FIXTURES: need three non-admin profiles plus one more';
  END IF;

  -- Since 066 protect_admin_columns() reverts disabled_at unless the JWT role
  -- is service_role, so the fixture writes need that claim (D would otherwise
  -- stay enabled and C5d fails). Reset by the "As anon" section below.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE public.profiles SET location_enabled = true, location_geohash = 'u33dc1', location_label = 'Dry Run A',
    presence_type = 'temporary', presence_expires_at = now() + interval '1 hour', presence_note = 'dry-run-a',
    discovery_visible = true, disabled_at = NULL WHERE id = v_a;
  UPDATE public.profiles SET location_enabled = true, location_geohash = 'u33dc2', location_label = 'Dry Run B',
    presence_type = 'temporary', presence_expires_at = now() - interval '1 hour', presence_note = 'dry-run-b',
    discovery_visible = true, disabled_at = NULL WHERE id = v_b;
  UPDATE public.profiles SET location_enabled = true, location_geohash = 'u33dc3', location_label = 'Dry Run C',
    presence_type = 'recommended', presence_expires_at = now() + interval '1 day', presence_note = 'dry-run-c',
    discovery_visible = false, disabled_at = NULL WHERE id = v_c;
  UPDATE public.profiles SET location_enabled = true, location_geohash = 'u33dc4', location_label = 'Dry Run D',
    presence_type = 'temporary', presence_expires_at = now() + interval '1 hour', presence_note = 'dry-run-d',
    discovery_visible = true, disabled_at = now() WHERE id = v_d;

  PERFORM set_config('chk.a', v_a::text, true);
  PERFORM set_config('chk.b', v_b::text, true);
  PERFORM set_config('chk.c', v_c::text, true);
  PERFORM set_config('chk.d', v_d::text, true);
  PERFORM set_config('chk.report', '', true);
END $$;

-- --------------------------------------------
-- As anon
-- --------------------------------------------
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_n int; v_ids uuid[];
BEGIN
  -- C1: public columns still readable
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = current_setting('chk.a')::uuid
    AND username IS NOT NULL AND is_admin IS NOT NULL;
  IF v_n <> 1 THEN RAISE EXCEPTION 'C1 FAILED: anon cannot read public profile columns'; END IF;

  -- C2: each private column is denied
  BEGIN
    PERFORM location_geohash FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2a FAILED: anon read location_geohash';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM location_label, location_updated_at, location_precision, location_enabled FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2b FAILED: anon read location_* columns';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM presence_type, presence_note, presence_expires_at FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2c FAILED: anon read presence_* columns';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM unread_messages_count FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2d FAILED: anon read unread_messages_count';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM email_digest_enabled, email_digest_frequency, email_notifications_enabled, last_digest_sent_at FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2e FAILED: anon read email_* columns';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM admin_granted_at, admin_granted_by FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2f FAILED: anon read admin_granted_*';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'C2g FAILED: anon could SELECT *';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- C3: filtering on a private column is denied too (the audit's exact query)
  BEGIN
    PERFORM id FROM public.profiles WHERE location_enabled = true LIMIT 1;
    RAISE EXCEPTION 'C3 FAILED: anon filtered on location_enabled';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- C4: get_my_profile is not callable by anon
  BEGIN
    PERFORM public.get_my_profile();
    RAISE EXCEPTION 'C4 FAILED: anon could call get_my_profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- C5: get_nearby_readers returns exactly the active, visible reader
  SELECT array_agg(r.id) INTO v_ids FROM public.get_nearby_readers(ARRAY['u33d','u33e','u33f'], 50) r;
  IF v_ids IS NULL OR NOT (current_setting('chk.a')::uuid = ANY (v_ids)) THEN
    RAISE EXCEPTION 'C5a FAILED: active visible reader A missing from get_nearby_readers';
  END IF;
  IF current_setting('chk.b')::uuid = ANY (v_ids) THEN RAISE EXCEPTION 'C5b FAILED: expired reader B returned'; END IF;
  IF current_setting('chk.c')::uuid = ANY (v_ids) THEN RAISE EXCEPTION 'C5c FAILED: discovery_visible=false reader C returned'; END IF;
  IF current_setting('chk.d')::uuid = ANY (v_ids) THEN RAISE EXCEPTION 'C5d FAILED: disabled reader D returned'; END IF;

  -- C6: the RPC only honours well-formed prefixes (no LIKE wildcards)
  SELECT count(*) INTO v_n FROM public.get_nearby_readers(ARRAY['%', 'u_3', 'zz'], 50);
  IF v_n <> 0 THEN RAISE EXCEPTION 'C6 FAILED: wildcard prefixes matched % readers', v_n; END IF;

  -- C7: the RPC declares no column beyond its list
  SELECT count(*) INTO v_n FROM pg_proc p
    WHERE p.proname = 'get_nearby_readers'
      AND (pg_get_function_result(p.oid) ILIKE '%email%' OR pg_get_function_result(p.oid) ILIKE '%unread%');
  IF v_n <> 0 THEN RAISE EXCEPTION 'C7 FAILED: get_nearby_readers returns private columns'; END IF;

  -- C8: RLS policies on other tables that inline profiles.is_admin still plan
  PERFORM count(*) FROM public.user_books;
  PERFORM count(*) FROM public.reading_stats;
  PERFORM count(*) FROM public.reviews;

  PERFORM set_config('chk.report', current_setting('chk.report') || 'C1-C8 anon ok; ', true);
END $$;

-- --------------------------------------------
-- As authenticated A (owner)
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('chk.a'))::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_n int; v_geo text; v_id uuid;
BEGIN
  -- A1: even the owner cannot read a private column directly
  BEGIN
    PERFORM location_geohash FROM public.profiles WHERE id = auth.uid();
    RAISE EXCEPTION 'A1 FAILED: owner read location_geohash directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- A2: get_my_profile returns the caller's own full row
  SELECT id, location_geohash INTO v_id, v_geo FROM public.get_my_profile();
  IF v_id IS DISTINCT FROM auth.uid() OR v_geo <> 'u33dc1' THEN
    RAISE EXCEPTION 'A2 FAILED: get_my_profile returned id=% geohash=%', v_id, v_geo;
  END IF;
  SELECT count(*) INTO v_n FROM public.get_my_profile();
  IF v_n <> 1 THEN RAISE EXCEPTION 'A2b FAILED: get_my_profile returned % rows', v_n; END IF;

  -- A3: the owner can still write private columns (UPDATE privileges untouched)
  UPDATE public.profiles SET presence_note = 'dry-run-a-edited', location_precision = 7 WHERE id = auth.uid();
  SELECT presence_note INTO v_geo FROM public.get_my_profile();
  IF v_geo <> 'dry-run-a-edited' THEN RAISE EXCEPTION 'A3 FAILED: owner update of presence_note lost (%)', v_geo; END IF;

  -- A4: public read of another profile works, private read does not
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = current_setting('chk.b')::uuid AND username IS NOT NULL;
  IF v_n <> 1 THEN RAISE EXCEPTION 'A4a FAILED: authenticated cannot read another public profile'; END IF;
  BEGIN
    PERFORM presence_note FROM public.profiles WHERE id = current_setting('chk.b')::uuid;
    RAISE EXCEPTION 'A4b FAILED: authenticated read another user''s presence_note';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- A5: the admin-gated policies still evaluate for a signed-in non-admin
  PERFORM count(*) FROM public.user_books;
  PERFORM count(*) FROM public.reports;
  PERFORM count(*) FROM public.book_submissions;

  -- A6: nearby readers works for authenticated too and still hides B/C/D
  SELECT count(*) INTO v_n FROM public.get_nearby_readers(ARRAY['u33dc'], 10) r
    WHERE r.id IN (current_setting('chk.b')::uuid, current_setting('chk.c')::uuid, current_setting('chk.d')::uuid);
  IF v_n <> 0 THEN RAISE EXCEPTION 'A6 FAILED: hidden readers returned to authenticated'; END IF;

  PERFORM set_config('chk.report', current_setting('chk.report') || 'A1-A6 owner ok; ', true);
END $$;

-- --------------------------------------------
-- As authenticated B: get_my_profile never leaks another row
-- --------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('chk.b'))::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.get_my_profile();
  IF v_id IS DISTINCT FROM current_setting('chk.b')::uuid THEN
    RAISE EXCEPTION 'B1 FAILED: get_my_profile for B returned %', v_id;
  END IF;
  PERFORM set_config('chk.report', current_setting('chk.report') || 'B1 ok; ', true);
END $$;

-- --------------------------------------------
-- Schema checks (as postgres) and final verdict -- always raises
-- --------------------------------------------
RESET ROLE;

DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'profiles' AND privilege_type = 'SELECT'
      AND grantee IN ('anon', 'authenticated')
      AND column_name IN ('location_geohash','location_label','location_updated_at','location_precision','location_enabled',
                          'presence_type','presence_note','presence_expires_at','unread_messages_count',
                          'email_digest_enabled','email_digest_frequency','email_notifications_enabled','last_digest_sent_at',
                          'admin_granted_at','admin_granted_by');
  IF v_n <> 0 THEN RAISE EXCEPTION 'S1 FAILED: % private column SELECT grants remain for anon/authenticated', v_n; END IF;

  SELECT count(*) INTO v_n FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'profiles' AND privilege_type = 'SELECT' AND grantee = 'service_role';
  IF v_n < 30 THEN RAISE EXCEPTION 'S2 FAILED: service_role lost SELECT on profiles (% columns)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('get_my_profile', 'get_nearby_readers')
      AND p.prosecdef AND p.proconfig::text ILIKE '%search_path=public%';
  IF v_n <> 2 THEN RAISE EXCEPTION 'S3 FAILED: expected 2 SECURITY DEFINER functions with search_path, found %', v_n; END IF;

  RAISE EXCEPTION 'ALL CHECKS PASSED (rolled back): %S1-S3 schema ok', current_setting('chk.report');
END $$;

ROLLBACK;
