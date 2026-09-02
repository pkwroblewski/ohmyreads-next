-- ============================================
-- Migration 065: profiles column privacy
--
-- Closes audit finding S4 (.claude/plans/phase2-audit-findings-2026-09-01.md).
-- The profiles SELECT policy is `USING (true)` (001), so with the public anon
-- key anyone could read every user's location_geohash (up to 8 chars, ~19 m),
-- presence note, unread-message count and email preferences, expired
-- presence and discovery_visible=false rows included. The "active presence
-- only" rules lived only in JavaScript.
--
--   1. Column privileges: anon/authenticated keep SELECT on the public
--      columns only. Everything about location, presence, inbox, email and
--      admin provenance is now unreadable through PostgREST -- for the owner
--      too, which is why (2) exists. UPDATE privileges are untouched: the
--      owner still writes those columns through the existing RLS policy.
--   2. get_my_profile(): SECURITY DEFINER, returns the caller's own full row.
--   3. get_nearby_readers(prefixes, limit): SECURITY DEFINER, returns only
--      readers with an unexpired check-in who are location-enabled,
--      discoverable and not disabled. Replaces the client-side filter in
--      lib/queries/geo.ts. Anon may call it because the reader map is public;
--      the rules are now enforced here instead of in the caller.
--
-- Public columns kept readable and why:
--   is_admin            20 RLS policies inline `profiles.is_admin` and are
--                       evaluated for anon reads; the review card also shows
--                       an admin badge. Rewriting the policies is Task 24.
--   discovery_visible   referenced by the user_books / reading_stats policies.
--   is_public_activity  a public toggle; used by on_review_created().
--   disabled_at         needed by the proxy / layout in Task 7.
--   *_count             public profile counters.
--
-- Every section is idempotent so the file can be re-run.
-- ============================================

-- --------------------------------------------
-- 1. Column privileges
-- --------------------------------------------
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  website,
  created_at,
  updated_at,
  followers_count,
  following_count,
  friends_count,
  is_admin,
  discovery_visible,
  is_public_activity,
  disabled_at
) ON public.profiles TO anon, authenticated;

-- --------------------------------------------
-- 2. Owner read of the full row
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_my_profile() IS
  'The caller''s own profiles row including the private location / presence / email / inbox columns that migration 065 revoked from direct SELECT. Returns nothing for anon.';

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated, service_role;

-- --------------------------------------------
-- 3. Nearby readers with the visibility rules in SQL
-- --------------------------------------------
-- p_prefixes: geohash cell prefixes (the caller passes the searched cell plus
-- its surrounding cells). Each prefix must be 2-8 base32-geohash characters;
-- anything else is ignored, so LIKE wildcards cannot be smuggled in.
-- location_geohash is returned as stored (capped at 8 chars): a check-in is an
-- explicit consent to show that position, and the map needs it for the pin.
CREATE OR REPLACE FUNCTION public.get_nearby_readers(
  p_prefixes text[],
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  location_label text,
  location_geohash text,
  presence_type text,
  presence_expires_at timestamptz,
  presence_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.location_label,
    LEFT(p.location_geohash, 8),
    p.presence_type,
    p.presence_expires_at,
    p.presence_note
  FROM public.profiles p
  WHERE p.location_enabled = true
    AND p.location_geohash IS NOT NULL
    AND p.presence_type IN ('temporary', 'recommended')
    AND p.presence_expires_at > now()
    AND COALESCE(p.discovery_visible, true)
    AND p.disabled_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_prefixes, '{}'::text[])) AS pref
      WHERE pref ~ '^[0-9b-hjkmnp-z]{2,8}$'
        AND p.location_geohash LIKE pref || '%'
    )
  ORDER BY p.presence_expires_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

COMMENT ON FUNCTION public.get_nearby_readers(text[], integer) IS
  'Readers with an active (unexpired) check-in in any of the given geohash cells, restricted to location-enabled, discoverable, non-disabled profiles. The only way to read location / presence columns of other users.';

REVOKE ALL ON FUNCTION public.get_nearby_readers(text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_readers(text[], integer) TO anon, authenticated, service_role;
