-- 074: RLS holes and integrity fixes (full audit 2026-09-24, Task 2)
--
-- Every definition below was re-derived from the LIVE database
-- (pg_policies / pg_get_functiondef on 2026-09-24), not from older files.
--
--   A1  friend_requests INSERT only pinned sender_id, so a user could insert
--       status='accepted' and become "friends" with anyone (friends-only DMs,
--       friends_count underflow on unfriend). Now INSERT must be 'pending'.
--   A2  book_club_members INSERT public branch had no role check, so anyone
--       could join a public club as 'admin'. Public joins are now 'member'
--       only; the creator-as-admin branch is unchanged (the app uses the
--       add_club_creator_as_admin RPC anyway).
--   B1  protect_admin_columns() had no INSERT branch (066 rewrite); on INSERT
--       OLD is NULL, so the columns were only protected by accident. Non
--       service_role inserts now get the safe defaults explicitly.
--   B2  book_submissions.book_id FK had no ON DELETE, so admins could not
--       delete a book that came from an approved submission (23503).
--   B3  get_top_reviewers() (anon, SECURITY DEFINER) listed disabled users and
--       took an uncapped limit. Now hides disabled users, caps at 50.
--   C3  club admins could PATCH book_clubs.member_count / created_by. Frozen
--       for API roles with a trigger (same is_api_role() pattern as 064).
--   C5  shelf_books INSERT/UPDATE did not check user_book_id belongs to the
--       caller, so someone else's user_book could be put on your shelf.
--   C6  update_list_likes_count() decrement had no zero floor.
--
-- Live checks before applying: 0 forged accepted friendships, 0 non-creator
-- club admins, 0 NULL status/role rows, 0 negative likes_count.

BEGIN;

-- ---------------------------------------------------------------------------
-- A1: friend requests can only be created as pending
-- ---------------------------------------------------------------------------
UPDATE public.friend_requests SET status = 'pending' WHERE status IS NULL;
ALTER TABLE public.friend_requests ALTER COLUMN status SET NOT NULL;

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- A2: public joins are member-only
-- ---------------------------------------------------------------------------
UPDATE public.book_club_members SET role = 'member' WHERE role IS NULL;
ALTER TABLE public.book_club_members ALTER COLUMN role SET NOT NULL;

DROP POLICY IF EXISTS "Users can join public clubs or create their own club as admin" ON public.book_club_members;
CREATE POLICY "Users can join public clubs or create their own club as admin" ON public.book_club_members
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      (
        role = 'member'
        AND EXISTS (
          SELECT 1 FROM public.book_clubs
          WHERE book_clubs.id = book_club_members.club_id
            AND book_clubs.visibility = 'public'
        )
      )
      OR (
        role = 'admin'
        AND EXISTS (
          SELECT 1 FROM public.book_clubs
          WHERE book_clubs.id = book_club_members.club_id
            AND book_clubs.created_by = (SELECT auth.uid())
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- B1: protect_admin_columns() with an explicit INSERT branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only service_role can set or modify admin columns.
  -- auth.jwt() ->> 'role' reads from request-scoped JWT claims (reliable with
  -- connection pooling). No JWT (direct DB connection) also protects them.
  IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_admin := false;
      NEW.admin_granted_at := NULL;
      NEW.admin_granted_by := NULL;
      NEW.disabled_at := NULL;
    ELSIF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
          (OLD.admin_granted_at IS DISTINCT FROM NEW.admin_granted_at) OR
          (OLD.admin_granted_by IS DISTINCT FROM NEW.admin_granted_by) OR
          (OLD.disabled_at IS DISTINCT FROM NEW.disabled_at) THEN
      -- Silently revert to the previous values
      NEW.is_admin := OLD.is_admin;
      NEW.admin_granted_at := OLD.admin_granted_at;
      NEW.admin_granted_by := OLD.admin_granted_by;
      NEW.disabled_at := OLD.disabled_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- B2: deleting a book keeps its submission history
-- ---------------------------------------------------------------------------
ALTER TABLE public.book_submissions
  DROP CONSTRAINT book_submissions_book_id_fkey,
  ADD CONSTRAINT book_submissions_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- B3: top reviewers hides disabled users, limit capped at 50
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_reviewers(limit_count integer DEFAULT 5)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, review_count bigint)
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
    COUNT(r.id) AS review_count
  FROM public.reviews r
  INNER JOIN public.profiles p ON r.user_id = p.id
  WHERE p.disabled_at IS NULL
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  ORDER BY review_count DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 5), 0), 50);
$$;

-- Same grants as 073.
REVOKE EXECUTE ON FUNCTION public.get_top_reviewers(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_top_reviewers(integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- C3: member_count and created_by are not writable through the API
-- ---------------------------------------------------------------------------
-- update_club_member_count() is SECURITY DEFINER, so its writes run as the
-- owner and pass through; only anon/authenticated writes are frozen.
CREATE OR REPLACE FUNCTION public.freeze_book_club_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.member_count := 0;
    ELSE
      NEW.member_count := OLD.member_count;
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.freeze_book_club_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS book_clubs_freeze_columns ON public.book_clubs;
CREATE TRIGGER book_clubs_freeze_columns
  BEFORE INSERT OR UPDATE ON public.book_clubs
  FOR EACH ROW EXECUTE FUNCTION public.freeze_book_club_columns();

-- ---------------------------------------------------------------------------
-- C5: shelf_books rows must reference the caller's own user_books
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can add to own shelves" ON public.shelf_books;
CREATE POLICY "Users can add to own shelves" ON public.shelf_books
  FOR INSERT
  WITH CHECK (
    shelf_id IN (
      SELECT user_shelves.id FROM public.user_shelves
      WHERE user_shelves.user_id = (SELECT auth.uid())
    )
    AND user_book_id IN (
      SELECT user_books.id FROM public.user_books
      WHERE user_books.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own shelf books" ON public.shelf_books;
CREATE POLICY "Users can update own shelf books" ON public.shelf_books
  FOR UPDATE
  USING (
    shelf_id IN (
      SELECT user_shelves.id FROM public.user_shelves
      WHERE user_shelves.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    shelf_id IN (
      SELECT user_shelves.id FROM public.user_shelves
      WHERE user_shelves.user_id = (SELECT auth.uid())
    )
    AND user_book_id IN (
      SELECT user_books.id FROM public.user_books
      WHERE user_books.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- C6: list likes count never goes below zero
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_list_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reading_lists SET likes_count = likes_count + 1 WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reading_lists SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.list_id;
  END IF;
  RETURN NULL;
END;
$$;

COMMIT;
