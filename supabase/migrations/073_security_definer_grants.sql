-- 073: SECURITY DEFINER execute grants
--
-- Closes Supabase advisor lints 0028 (anon can execute a SECURITY DEFINER
-- function) and 0029 (authenticated can execute one) for every function that
-- does not need the grant. Bodies and search_path are untouched (054 fixed
-- search_path). Each REVOKE also drops PUBLIC so a default grant cannot
-- silently re-expose a function; kept roles are re-granted explicitly.
--
-- Classification (2026-09-12, from pg_policies, pg_trigger and a grep of
-- app/, lib/, scripts/ for .rpc("name")):
--
-- (a) RLS helpers, evaluated as the calling role inside policies
--   is_club_member(uuid)       book_clubs SELECT + book_club_members SELECT;
--                              /clubs is public, so anon KEEPS execute
--   get_club_visibility(uuid)  book_club_members SELECT; same, anon KEEPS
--   is_club_admin(uuid)        book_club_members DELETE only -> revoke anon
--   are_friends(uuid,uuid)     direct_messages INSERT -> authenticated only
--
-- (b) App RPCs called through the session client by signed-in users
--     (keep authenticated, revoke anon). Admin-only ones guard inside.
--   add_club_creator_as_admin   lib/actions/clubs.ts (self-check inside)
--   generate_club_slug          lib/actions/clubs.ts
--   get_my_profile              layouts, dashboard, require-user
--   set_book_shelves            lib/actions/shelves.ts
--   approve_book_submission     lib/actions/book-submissions.ts (admin guard)
--   approve_place_submission    lib/actions/places.ts (admin guard)
--   reject_place_submission     lib/actions/places.ts (admin guard)
--
-- (c) Public read RPCs called from anonymous pages (keep anon + authenticated)
--   get_top_reviewers(int)          lib/queries/community.ts -> /community
--   get_nearby_readers(text[],int)  lib/queries/geo.ts -> /api/geo/readers
--
-- (d) Internal / maintenance, no app caller and no trigger (revoke both;
--     postgres and service_role keep execute)
--   increment_review_likes(uuid)   superseded by trigger sync_review_likes_count
--   decrement_review_likes(uuid)   same
--   reconcile_counters()           admin/cron maintenance, run as postgres
--   reconcile_book_local_ratings() same (063)
--
-- Remaining 0028/0029 entries after this migration are exactly (a) minus
-- is_club_admin/are_friends for anon, plus (b) and (c); each is justified above.

BEGIN;

-- (d) internal: nobody through the API
REVOKE EXECUTE ON FUNCTION public.increment_review_likes(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_review_likes(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_counters()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_book_local_ratings() FROM PUBLIC, anon, authenticated;

-- (a) RLS helpers
REVOKE EXECUTE ON FUNCTION public.is_club_admin(uuid)     FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_club_admin(uuid)     TO authenticated;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid)       FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_club_member(uuid)       TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_club_visibility(uuid)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_club_visibility(uuid)  TO anon, authenticated;

-- (b) signed-in app RPCs
REVOKE EXECUTE ON FUNCTION public.add_club_creator_as_admin(uuid, uuid)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.add_club_creator_as_admin(uuid, uuid)  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_club_slug(text)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_club_slug(text)               TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_profile()                       FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_profile()                       TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_book_shelves(uuid, uuid[])         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_book_shelves(uuid, uuid[])         TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_book_submission(uuid, uuid)    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_book_submission(uuid, uuid)    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_place_submission(uuid, text)   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_place_submission(uuid, text)   TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_place_submission(uuid, text)    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reject_place_submission(uuid, text)    TO authenticated;

-- (c) public read RPCs: pin the grant explicitly, drop the PUBLIC default
REVOKE EXECUTE ON FUNCTION public.get_top_reviewers(integer)          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_top_reviewers(integer)          TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_nearby_readers(text[], integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_nearby_readers(text[], integer) TO anon, authenticated;

COMMIT;
