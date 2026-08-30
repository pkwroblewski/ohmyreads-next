-- Migration: RPC hardening — search_path on SECURITY DEFINER functions,
-- and abuse-proofing the review-like counters.
--
-- PART 1 fixes 26 SECURITY DEFINER functions that lack `SET search_path`.
-- A SECURITY DEFINER function runs with the definer's privileges, so if its
-- unqualified table references can be redirected (by a schema earlier on the
-- caller's search_path), the caller executes their own SQL as the definer.
-- Note: the comment in 044 claiming handle_new_user was "the only SECURITY
-- DEFINER function without SET search_path" was wrong by 25.
--
-- PART 2 makes increment/decrement_review_likes non-abusable. They are
-- SECURITY DEFINER, granted to `authenticated`, and had no auth check at all:
-- any logged-in user could call them directly via supabase.rpc() and inflate
-- (or deflate) the like count on any review without a corresponding
-- review_likes row.

-- =============================================
-- PART 1: SET search_path on every SECURITY DEFINER function
-- =============================================

-- Driven off the catalog rather than a hand-written list of 26 signatures:
-- it cannot get an argument signature wrong, it is idempotent (functions that
-- already have search_path are skipped), it handles overloads, and it also
-- catches any function added later that forgets the setting.
DO $$
DECLARE
  fn record;
  fixed_count integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef                                  -- SECURITY DEFINER only
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
      -- Never touch functions owned by an installed extension
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.signature);
    fixed_count := fixed_count + 1;
    RAISE NOTICE 'search_path set on %', fn.signature;
  END LOOP;

  RAISE NOTICE 'PART 1 complete: % function(s) hardened', fixed_count;
END $$;

-- =============================================
-- PART 2: Make review-like counters self-correcting
-- =============================================

-- Rather than blindly incrementing, both functions now RECOMPUTE likes_count
-- from review_likes, which is the source of truth. Consequences:
--   * Abuse is pointless — calling either function repeatedly just recalculates
--     the same correct value instead of inflating a counter.
--   * They become idempotent, so the non-atomic
--     "INSERT review_likes then RPC" sequence in lib/actions/reviews.ts can no
--     longer leave permanent counter drift (the case its own comment at :336
--     explicitly accepted).
-- review_likes(review_id) is indexed (002_..._structured_reviews.sql:88), so
-- the COUNT is an index scan.

CREATE OR REPLACE FUNCTION public.increment_review_likes(review_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.reviews r
  SET likes_count = (
    SELECT COUNT(*) FROM public.review_likes rl WHERE rl.review_id = r.id
  )
  WHERE r.id = increment_review_likes.review_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrement_review_likes(review_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.reviews r
  SET likes_count = (
    SELECT COUNT(*) FROM public.review_likes rl WHERE rl.review_id = r.id
  )
  WHERE r.id = decrement_review_likes.review_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.increment_review_likes(UUID) IS
  'Recomputes reviews.likes_count from review_likes. Recompute rather than increment so direct rpc() calls cannot inflate the counter.';
COMMENT ON FUNCTION public.decrement_review_likes(UUID) IS
  'Recomputes reviews.likes_count from review_likes. Recompute rather than decrement so direct rpc() calls cannot deflate the counter.';

-- =============================================
-- PART 3: Tighten add_club_creator_as_admin
-- =============================================

-- This function already verified that p_user_id is the club's creator, so it
-- was never an arbitrary-admin-grant vector. Tightened one step further to
-- require that the caller is acting as themselves, so it cannot be used to act
-- on another user's behalf. The sole caller (lib/actions/clubs.ts) already
-- passes the authenticated user's own id.
CREATE OR REPLACE FUNCTION public.add_club_creator_as_admin(p_club_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Callers may only act as themselves (service_role bypasses this).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot add another user as club admin';
  END IF;

  -- Verify the user is actually the club creator
  IF NOT EXISTS (
    SELECT 1 FROM public.book_clubs
    WHERE id = p_club_id AND created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is not the creator of this club';
  END IF;

  INSERT INTO public.book_club_members (club_id, user_id, role)
  VALUES (p_club_id, p_user_id, 'admin')
  ON CONFLICT (club_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- Verification helper (run manually after applying)
-- =============================================
-- Expect zero rows:
--   SELECT p.oid::regprocedure
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef
--     AND NOT EXISTS (
--       SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
--       WHERE c LIKE 'search_path=%'
--     );
