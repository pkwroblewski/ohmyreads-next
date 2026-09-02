-- ============================================
-- Migration 064: Phase 2 security
--
-- Closes the database findings of the Sep 2026 audit
-- (.claude/plans/phase2-audit-findings-2026-09-01.md, S1 S2 S5 S6 S7 B1 B2
-- D1-D6). Every section is idempotent so the file can be re-run.
--
--   0. is_api_role() helper used by every freeze trigger below
--   1. Admin guards inside the three moderation RPCs
--   2. friend_requests: receiver can only flip status; parties are frozen;
--      one row per pair regardless of direction
--   3. direct_messages: recipient can only set read_at
--   4. Counter columns are trigger-owned: direct API writes are reverted
--   5. Admin RLS policies on books / reviews / comments / place_photos /
--      book_submissions (requireAdmin() uses the session client)
--   6. profiles: username format, length caps, disabled_at, hardened
--      handle_new_user()
--   7. Integrity: photos_count trigger, reconcile_counters() covers
--      user_checkin_stats, on_review_created() respects is_public_activity,
--      book_club_reads NOT NULL, member_count floor
--   8. Indexes: book review lists and nine unindexed foreign keys
--   9. Revoke direct EXECUTE on every trigger function and on the four
--      internal RPCs (catalog-driven, so it also covers the functions this
--      file creates)
--
-- On the freeze rule: the plan suggested `auth.jwt()->>'role' = 'service_role'`
-- as the escape hatch, but every counter is maintained by SECURITY DEFINER
-- trigger functions and RPCs that run *inside the user's request*, where the
-- JWT role is still `authenticated`. That rule would have reverted every
-- legitimate update. `current_user` is what changes: a direct PostgREST write
-- runs as `anon` / `authenticated`, while a SECURITY DEFINER function (and the
-- triggers it fires) runs as its owner (`postgres`), and the admin client runs
-- as `service_role`. So "freeze when current_user is an API role" blocks
-- exactly the direct writes and nothing else. The freeze trigger functions
-- must therefore stay SECURITY INVOKER.
-- ============================================

-- ============================================
-- 0. Helper
-- ============================================

CREATE OR REPLACE FUNCTION public.is_api_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT current_user IN ('anon', 'authenticated');
$$;

COMMENT ON FUNCTION public.is_api_role() IS
  'True when the current statement executes directly as a PostgREST API role (anon/authenticated). False inside SECURITY DEFINER functions and for service_role, so trigger-owned columns can be frozen against direct writes only.';

-- ============================================
-- 1. Admin guards inside the moderation RPCs
--
-- All three are SECURITY DEFINER (they write to tables the caller cannot)
-- and were callable by anon and by any signed-in user, who could approve
-- their own submission. The guard mirrors reconcile_counters() (057).
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_book_submission(
  p_submission_id uuid,
  p_moderator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission record;
  v_new_book_id uuid;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin = true
     )
  THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  -- A caller may only record themselves as the moderator.
  IF auth.uid() IS NOT NULL AND p_moderator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Moderator must be the calling user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_submission
  FROM public.book_submissions
  WHERE id = p_submission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;

  INSERT INTO public.books (
    title, author, slug, description, cover_url, isbn, genres,
    published_date, page_count, google_books_id, open_library_id,
    open_library_cover_id, cover_source
  )
  VALUES (
    v_submission.title, v_submission.author, v_submission.slug,
    v_submission.description, v_submission.cover_url, v_submission.isbn,
    v_submission.genres, v_submission.published_date, v_submission.page_count,
    v_submission.google_books_id, v_submission.open_library_id,
    v_submission.open_library_cover_id, v_submission.cover_source
  )
  RETURNING id INTO v_new_book_id;

  UPDATE public.book_submissions
  SET status = 'approved',
      moderated_by = p_moderator_id,
      moderated_at = now(),
      book_id = v_new_book_id
  WHERE id = p_submission_id;

  RETURN v_new_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_place_submission(
  submission_id uuid,
  admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_place_id uuid;
  submission_record record;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin = true
     )
  THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO submission_record
  FROM public.place_submissions
  WHERE id = submission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;

  INSERT INTO public.places (
    name, place_type, address, city, country,
    lat, lng, geohash, website, description, submitted_by
  )
  VALUES (
    submission_record.name, submission_record.place_type,
    submission_record.address, submission_record.city,
    submission_record.country, submission_record.lat, submission_record.lng,
    submission_record.geohash, submission_record.website,
    submission_record.description, submission_record.submitted_by
  )
  RETURNING id INTO new_place_id;

  UPDATE public.place_submissions
  SET status = 'approved',
      moderator_id = auth.uid(),
      moderator_notes = admin_notes,
      reviewed_at = now()
  WHERE id = submission_id;

  RETURN new_place_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_place_submission(
  submission_id uuid,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin = true
     )
  THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.place_submissions
  SET status = 'rejected',
      moderator_id = auth.uid(),
      moderator_notes = admin_notes,
      reviewed_at = now()
  WHERE id = submission_id AND status = 'pending';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_book_submission(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_place_submission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_place_submission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_book_submission(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_place_submission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_place_submission(uuid, text) TO authenticated, service_role;

-- ============================================
-- 2. friend_requests
--
-- The UPDATE policy's WITH CHECK (029) pinned only `status`, so the
-- receiver could rewrite `sender_id` to any user and thereby satisfy
-- are_friends() -- the only gate on direct_messages INSERT.
-- ============================================

DROP POLICY IF EXISTS "Receivers can respond to friend requests" ON public.friend_requests;
CREATE POLICY "Receivers can respond to friend requests"
ON public.friend_requests FOR UPDATE
USING ((SELECT auth.uid()) = receiver_id AND status = 'pending')
WITH CHECK ((SELECT auth.uid()) = receiver_id AND status IN ('accepted', 'rejected'));

CREATE OR REPLACE FUNCTION public.freeze_friend_request_parties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    NEW.sender_id := OLD.sender_id;
    NEW.receiver_id := OLD.receiver_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_requests_freeze_parties ON public.friend_requests;
CREATE TRIGGER friend_requests_freeze_parties
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.freeze_friend_request_parties();

-- One relationship per pair. UNIQUE(sender_id, receiver_id) (022) is
-- directional, so A->B and B->A could both exist. Resolve any duplicates
-- first (keep the accepted row, else the earliest), then add the index.
-- Live check on 2026-09-01: 0 duplicate pairs.
DELETE FROM public.friend_requests fr
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
           ORDER BY (status = 'accepted') DESC, created_at ASC, id ASC
         ) AS rn
  FROM public.friend_requests
) d
WHERE fr.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pair_uniq
  ON public.friend_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id));

-- ============================================
-- 3. direct_messages
--
-- The recipient could rewrite `content` and `sender_id` on messages they
-- received. Only `read_at` is theirs to change.
-- ============================================

DROP POLICY IF EXISTS "Users can mark messages read" ON public.direct_messages;
CREATE POLICY "Users can mark messages read"
ON public.direct_messages FOR UPDATE
USING ((SELECT auth.uid()) = receiver_id)
WITH CHECK ((SELECT auth.uid()) = receiver_id);

CREATE OR REPLACE FUNCTION public.freeze_direct_message_immutables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    NEW.content := OLD.content;
    NEW.sender_id := OLD.sender_id;
    NEW.receiver_id := OLD.receiver_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS direct_messages_freeze_immutables ON public.direct_messages;
CREATE TRIGGER direct_messages_freeze_immutables
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.freeze_direct_message_immutables();

-- ============================================
-- 4. Trigger-owned counters
--
-- profiles.followers_count / following_count / friends_count /
-- unread_messages_count, reviews.likes_count, reading_lists.likes_count and
-- every reading_stats counter are maintained by SECURITY DEFINER triggers
-- (010, 022, 023, 026, 054, 057). Owners could still write them directly
-- through the REST API. On INSERT they start at 0; on UPDATE they keep the
-- previous value. Application code that recomputed them through the session
-- client has been moved to the service-role client or removed.
-- ============================================

CREATE OR REPLACE FUNCTION public.freeze_profile_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.followers_count := 0;
      NEW.following_count := 0;
      NEW.friends_count := 0;
      NEW.unread_messages_count := 0;
    ELSE
      NEW.followers_count := OLD.followers_count;
      NEW.following_count := OLD.following_count;
      NEW.friends_count := OLD.friends_count;
      NEW.unread_messages_count := OLD.unread_messages_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_freeze_counters ON public.profiles;
CREATE TRIGGER profiles_freeze_counters
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.freeze_profile_counters();

CREATE OR REPLACE FUNCTION public.freeze_review_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.likes_count := 0;
    ELSE
      NEW.likes_count := OLD.likes_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_freeze_counters ON public.reviews;
CREATE TRIGGER reviews_freeze_counters
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.freeze_review_counters();

CREATE OR REPLACE FUNCTION public.freeze_reading_list_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.likes_count := 0;
    ELSE
      NEW.likes_count := OLD.likes_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reading_lists_freeze_counters ON public.reading_lists;
CREATE TRIGGER reading_lists_freeze_counters
  BEFORE INSERT OR UPDATE ON public.reading_lists
  FOR EACH ROW EXECUTE FUNCTION public.freeze_reading_list_counters();

CREATE OR REPLACE FUNCTION public.freeze_reading_stats_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.books_read := 0;
      NEW.pages_read := 0;
      NEW.reviews_count := 0;
      NEW.current_streak := 0;
    ELSE
      NEW.books_read := OLD.books_read;
      NEW.pages_read := OLD.pages_read;
      NEW.reviews_count := OLD.reviews_count;
      NEW.current_streak := OLD.current_streak;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reading_stats_freeze_counters ON public.reading_stats;
CREATE TRIGGER reading_stats_freeze_counters
  BEFORE INSERT OR UPDATE ON public.reading_stats
  FOR EACH ROW EXECUTE FUNCTION public.freeze_reading_stats_counters();

-- A user has no reason to delete their stats row; the triggers expect it.
DROP POLICY IF EXISTS "Users can delete their own stats" ON public.reading_stats;

-- Badges are awarded by lib/queries/badges.ts (now through the service-role
-- client). With this policy a user could self-grant any badge_id.
DROP POLICY IF EXISTS "Users can receive badges" ON public.user_badges;

-- The owner UPDATE policy on profiles had no WITH CHECK at all.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================
-- 5. Admin policies
--
-- requireAdmin() returns the session client, so every admin write needs a
-- matching policy. books had no UPDATE/DELETE policy at all; reviews,
-- comments and place_photos were owner-delete only; book_submissions had no
-- admin SELECT/UPDATE (the moderation queue was always empty).
-- ============================================

DROP POLICY IF EXISTS "Admins can update books" ON public.books;
CREATE POLICY "Admins can update books"
ON public.books FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can delete books" ON public.books;
CREATE POLICY "Admins can delete books"
ON public.books FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;
CREATE POLICY "Admins can delete reviews"
ON public.reviews FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can delete comments" ON public.comments;
CREATE POLICY "Admins can delete comments"
ON public.comments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can delete place photos" ON public.place_photos;
CREATE POLICY "Admins can delete place photos"
ON public.place_photos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can view all book submissions" ON public.book_submissions;
CREATE POLICY "Admins can view all book submissions"
ON public.book_submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can moderate book submissions" ON public.book_submissions;
CREATE POLICY "Admins can moderate book submissions"
ON public.book_submissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

-- ============================================
-- 6. profiles: format constraints, disabled_at, handle_new_user()
--
-- The app validates usernames as ^[a-z0-9_]{3,30}$ (lib/validation/profile.ts)
-- but handle_new_user() copied signup metadata unchecked and nothing
-- enforced it at the database. Live check on 2026-09-01: one row violated
-- it ("fabfashion-bianca"); it is normalised below before the constraint is
-- added.
-- ============================================

DO $$
DECLARE
  r record;
  v_new text;
BEGIN
  FOR r IN
    SELECT id, username FROM public.profiles
    WHERE username !~ '^[a-z0-9_]{3,30}$'
  LOOP
    v_new := LEFT(regexp_replace(lower(r.username), '[^a-z0-9_]', '', 'g'), 30);
    IF length(v_new) < 3
       OR EXISTS (SELECT 1 FROM public.profiles WHERE username = v_new AND id <> r.id)
    THEN
      v_new := 'user_' || LEFT(replace(r.id::text, '-', ''), 8);
    END IF;
    UPDATE public.profiles SET username = v_new WHERE id = r.id;
    RAISE NOTICE 'profiles.username normalised: % -> % (%)', r.username, v_new, r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_]{3,30}$');

-- display_name is capped at 100 to match updateProfileSchema (the plan said
-- 80; 100 is what the app already accepts, so nothing valid today breaks).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 100);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_length
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_website_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_website_length
  CHECK (website IS NULL OR char_length(website) <= 2048);

-- Task 7 (disable user) needs this; added here so there is one migration.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
COMMENT ON COLUMN public.profiles.disabled_at IS
  'When set, the account is disabled by an admin and the app refuses to serve it (enforced in proxy.ts / app layout).';

-- handle_new_user(): normalise the username to the same rule, cap the
-- length-limited columns, and drop over-long avatar URLs rather than
-- truncating them into something that no longer resolves.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_display text;
  v_avatar text;
BEGIN
  v_base := LEFT(
    regexp_replace(
      lower(COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'preferred_username',
        NEW.raw_user_meta_data->>'user_name',
        NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
        ''
      )),
      '[^a-z0-9_]', '', 'g'
    ),
    30
  );
  IF length(v_base) < 3 THEN
    v_base := 'user_' || LEFT(replace(NEW.id::text, '-', ''), 8);
  END IF;

  v_display := LEFT(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name'
  ), 100);

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  IF char_length(v_avatar) > 2048 THEN
    v_avatar := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (NEW.id, v_base, v_display, v_avatar);
  EXCEPTION WHEN unique_violation THEN
    -- Username taken: append a short random suffix (stays within 30 chars).
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      NEW.id,
      LEFT(v_base, 25) || '_' || LEFT(md5(random()::text), 4),
      v_display,
      v_avatar
    );
  END;

  INSERT INTO public.reading_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup on a profile problem; the app's ensureUserProfile()
  -- fallback repairs it on first request.
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================
-- 7. Integrity
-- ============================================

-- places.photos_count never incremented: the trigger ran as the uploading
-- user, who has no UPDATE policy on places.
ALTER FUNCTION public.update_place_photos_count()
  SECURITY DEFINER SET search_path = public;

-- book_club_members delete could push member_count below zero.
CREATE OR REPLACE FUNCTION public.update_club_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.book_clubs
    SET member_count = COALESCE(member_count, 0) + 1
    WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.book_clubs
    SET member_count = GREATEST(0, COALESCE(member_count, 0) - 1)
    WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$;

-- on_review_created() ignored profiles.is_public_activity; on_started_reading
-- and on_checkin_created already honour it.
CREATE OR REPLACE FUNCTION public.on_review_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_public boolean;
BEGIN
  SELECT is_public_activity INTO is_public
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF is_public IS NULL OR is_public = true THEN
    INSERT INTO public.activity_feed (type, user_id, book_id, review_id, created_at)
    VALUES ('review', NEW.user_id, NEW.book_id, NEW.id, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

-- A club read without a club or a book is meaningless. Live check
-- 2026-09-01: 0 null rows.
ALTER TABLE public.book_club_reads
  ALTER COLUMN club_id SET NOT NULL,
  ALTER COLUMN book_id SET NOT NULL;

-- reconcile_counters(): same body as 057 plus a user_checkin_stats block.
-- update_user_checkin_stats() only fires on INSERT, so deleting a check-in
-- left total_checkins and the streaks stale with no way to repair them.
CREATE OR REPLACE FUNCTION public.reconcile_counters()
RETURNS TABLE (counter TEXT, rows_fixed BIGINT) AS $$
DECLARE
  v_fixed BIGINT;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin = true
     )
  THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  -- NOTE: books.average_rating / ratings_count are Open Library values and are
  -- deliberately NOT reconciled here (see 057 and 063).

  -- reviews.likes_count
  UPDATE public.reviews r
  SET likes_count = src.cnt
  FROM (
    SELECT r2.id, (SELECT COUNT(*) FROM public.review_likes rl WHERE rl.review_id = r2.id) AS cnt
    FROM public.reviews r2
  ) src
  WHERE r.id = src.id AND COALESCE(r.likes_count, 0) IS DISTINCT FROM src.cnt;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'reviews.likes_count'; rows_fixed := v_fixed; RETURN NEXT;

  -- reading_lists.likes_count
  UPDATE public.reading_lists l
  SET likes_count = src.cnt
  FROM (
    SELECT l2.id, (SELECT COUNT(*) FROM public.reading_list_likes ll WHERE ll.list_id = l2.id) AS cnt
    FROM public.reading_lists l2
  ) src
  WHERE l.id = src.id AND COALESCE(l.likes_count, 0) IS DISTINCT FROM src.cnt;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'reading_lists.likes_count'; rows_fixed := v_fixed; RETURN NEXT;

  -- book_clubs.member_count
  UPDATE public.book_clubs c
  SET member_count = src.cnt
  FROM (
    SELECT c2.id, (SELECT COUNT(*) FROM public.book_club_members m WHERE m.club_id = c2.id) AS cnt
    FROM public.book_clubs c2
  ) src
  WHERE c.id = src.id AND COALESCE(c.member_count, 0) IS DISTINCT FROM src.cnt;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'book_clubs.member_count'; rows_fixed := v_fixed; RETURN NEXT;

  -- places.checkins_count / photos_count / reviews_count / average_rating
  UPDATE public.places pl
  SET checkins_count = src.checkins,
      photos_count   = src.photos,
      reviews_count  = src.reviews,
      average_rating = src.avg_rating
  FROM (
    SELECT p2.id,
           (SELECT COUNT(*) FROM public.place_checkins pc WHERE pc.place_id = p2.id) AS checkins,
           (SELECT COUNT(*) FROM public.place_photos pp   WHERE pp.place_id = p2.id) AS photos,
           (SELECT COUNT(*) FROM public.place_reviews pr  WHERE pr.place_id = p2.id) AS reviews,
           (SELECT ROUND(AVG(pr.rating)::numeric, 2) FROM public.place_reviews pr WHERE pr.place_id = p2.id) AS avg_rating
    FROM public.places p2
  ) src
  WHERE pl.id = src.id
    AND (COALESCE(pl.checkins_count, 0) IS DISTINCT FROM src.checkins
      OR COALESCE(pl.photos_count, 0)   IS DISTINCT FROM src.photos
      OR COALESCE(pl.reviews_count, 0)  IS DISTINCT FROM src.reviews
      OR pl.average_rating              IS DISTINCT FROM src.avg_rating);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'places.counts'; rows_fixed := v_fixed; RETURN NEXT;

  -- profiles.followers_count / following_count / friends_count /
  -- unread_messages_count
  UPDATE public.profiles p
  SET followers_count       = src.followers,
      following_count       = src.following,
      friends_count         = src.friends,
      unread_messages_count = src.unread
  FROM (
    SELECT p2.id,
           (SELECT COUNT(*) FROM public.follows f WHERE f.following_id = p2.id) AS followers,
           (SELECT COUNT(*) FROM public.follows f WHERE f.follower_id  = p2.id) AS following,
           (SELECT COUNT(*) FROM public.friend_requests fr
             WHERE fr.status = 'accepted'
               AND (fr.sender_id = p2.id OR fr.receiver_id = p2.id))            AS friends,
           (SELECT COUNT(*) FROM public.direct_messages dm
             WHERE dm.receiver_id = p2.id AND dm.read_at IS NULL)               AS unread
    FROM public.profiles p2
  ) src
  WHERE p.id = src.id
    AND (COALESCE(p.followers_count, 0)       IS DISTINCT FROM src.followers
      OR COALESCE(p.following_count, 0)       IS DISTINCT FROM src.following
      OR COALESCE(p.friends_count, 0)         IS DISTINCT FROM src.friends
      OR COALESCE(p.unread_messages_count, 0) IS DISTINCT FROM src.unread);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'profiles.social_counts'; rows_fixed := v_fixed; RETURN NEXT;

  -- reading_stats.books_read / pages_read / reviews_count
  UPDATE public.reading_stats rs
  SET books_read    = src.books_read,
      pages_read    = src.pages_read,
      reviews_count = src.reviews_count,
      updated_at    = NOW()
  FROM (
    SELECT rs2.user_id,
           (SELECT COUNT(*) FROM public.user_books ub
             WHERE ub.user_id = rs2.user_id AND ub.status = 'read')            AS books_read,
           (SELECT COALESCE(SUM(b.page_count), 0) FROM public.user_books ub
              JOIN public.books b ON b.id = ub.book_id
             WHERE ub.user_id = rs2.user_id AND ub.status = 'read')            AS pages_read,
           (SELECT COUNT(*) FROM public.reviews r WHERE r.user_id = rs2.user_id) AS reviews_count
    FROM public.reading_stats rs2
  ) src
  WHERE rs.user_id = src.user_id
    AND (COALESCE(rs.books_read, 0)    IS DISTINCT FROM src.books_read
      OR COALESCE(rs.pages_read, 0)    IS DISTINCT FROM src.pages_read
      OR COALESCE(rs.reviews_count, 0) IS DISTINCT FROM src.reviews_count);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'reading_stats'; rows_fixed := v_fixed; RETURN NEXT;

  -- user_checkin_stats.total_checkins / current_streak / longest_streak /
  -- last_checkin_date, recomputed from place_checkins with the same rules as
  -- update_user_checkin_stats(): a streak is a run of consecutive calendar
  -- days with at least one check-in, and it is still "current" if the last
  -- day of the run is today or yesterday.
  WITH days AS (
    SELECT user_id, d,
           d - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d))::int AS grp
    FROM (SELECT DISTINCT user_id, created_at::date AS d FROM public.place_checkins) x
  ),
  runs AS (
    SELECT user_id, MAX(d) AS run_end, COUNT(*)::int AS len
    FROM days GROUP BY user_id, grp
  ),
  computed AS (
    SELECT s.user_id,
           (SELECT COUNT(*) FROM public.place_checkins pc WHERE pc.user_id = s.user_id)::int AS total,
           COALESCE((SELECT MAX(len) FROM runs r WHERE r.user_id = s.user_id), 0) AS longest,
           COALESCE((SELECT MAX(len) FROM runs r
                      WHERE r.user_id = s.user_id
                        AND r.run_end >= CURRENT_DATE - 1), 0) AS current,
           (SELECT MAX(created_at)::date FROM public.place_checkins pc WHERE pc.user_id = s.user_id) AS last_date
    FROM public.user_checkin_stats s
  )
  UPDATE public.user_checkin_stats s
  SET total_checkins    = c.total,
      current_streak    = c.current,
      longest_streak    = c.longest,
      last_checkin_date = c.last_date,
      updated_at        = NOW()
  FROM computed c
  WHERE s.user_id = c.user_id
    AND (COALESCE(s.total_checkins, 0) IS DISTINCT FROM c.total
      OR COALESCE(s.current_streak, 0) IS DISTINCT FROM c.current
      OR COALESCE(s.longest_streak, 0) IS DISTINCT FROM c.longest
      OR s.last_checkin_date           IS DISTINCT FROM c.last_date);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'user_checkin_stats'; rows_fixed := v_fixed; RETURN NEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reconcile_counters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_counters() TO authenticated, service_role;

-- ============================================
-- 8. Indexes
-- ============================================

-- The book page lists reviews by (book_id) ordered by created_at DESC or
-- likes_count DESC; only single-column indexes existed.
CREATE INDEX IF NOT EXISTS reviews_book_id_created_at_idx
  ON public.reviews (book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_book_id_likes_count_idx
  ON public.reviews (book_id, likes_count DESC);

-- Unindexed foreign keys (every ON DELETE cascade / set-null scans the
-- child table without these).
CREATE INDEX IF NOT EXISTS reports_resolved_by_idx            ON public.reports (resolved_by);
CREATE INDEX IF NOT EXISTS profiles_admin_granted_by_idx      ON public.profiles (admin_granted_by);
CREATE INDEX IF NOT EXISTS book_submissions_book_id_idx       ON public.book_submissions (book_id);
CREATE INDEX IF NOT EXISTS book_submissions_moderated_by_idx  ON public.book_submissions (moderated_by);
CREATE INDEX IF NOT EXISTS place_checkins_book_id_idx         ON public.place_checkins (book_id);
CREATE INDEX IF NOT EXISTS places_submitted_by_idx            ON public.places (submitted_by);
CREATE INDEX IF NOT EXISTS place_submissions_moderator_id_idx ON public.place_submissions (moderator_id);
CREATE INDEX IF NOT EXISTS reading_list_books_book_id_idx     ON public.reading_list_books (book_id);
CREATE INDEX IF NOT EXISTS book_club_reads_book_id_idx        ON public.book_club_reads (book_id);

-- ============================================
-- 9. Revoke direct EXECUTE on internal functions
--
-- Trigger functions do not need EXECUTE to fire (Postgres checks that at
-- CREATE TRIGGER time only), but with the default PUBLIC grant every
-- SECURITY DEFINER trigger body was callable through rpc(). Same for the
-- four internal RPCs. are_friends() must stay callable by `authenticated`
-- because the direct_messages INSERT policy evaluates it as the caller.
-- Catalog-driven, like 054, so it also covers functions added later.
-- ============================================

DO $$
DECLARE
  fn record;
  revoked integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.prorettype = 'pg_catalog.trigger'::regtype
        OR p.oid::regprocedure::text IN (
          'cleanup_expired_presence()',
          'get_user_shelf_count(uuid)',
          'recalculate_book_rating(uuid)'
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
    revoked := revoked + 1;
  END LOOP;
  RAISE NOTICE 'Section 9: direct EXECUTE revoked on % function(s)', revoked;
END $$;

REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

-- is_api_role() is called from SECURITY INVOKER triggers, so the API roles
-- need EXECUTE on it (it reveals nothing).
GRANT EXECUTE ON FUNCTION public.is_api_role() TO anon, authenticated, service_role;

-- ============================================
-- Verification helper (run manually after applying)
-- ============================================
-- Expect zero rows:
--   SELECT p.oid::regprocedure
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND (p.prorettype = 'pg_catalog.trigger'::regtype
--          OR p.proname IN ('cleanup_expired_presence','get_user_shelf_count','recalculate_book_rating'))
--     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
--          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
