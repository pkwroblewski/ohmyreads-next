-- ============================================
-- Migration 056: Reader privacy for shelves and stats
--
-- Migration 029 opened `user_books` and `reading_stats` to
-- `SELECT USING (true)` so that "who read this book" and reader
-- discovery could work. The side effect is that every user's entire
-- shelf -- including want-to-read, currently-reading and ratings --
-- is world-readable and enumerable by anonymous callers.
--
-- `profiles.discovery_visible` (migration 024) already exists and is
-- documented as "when false, user is hidden from discovery pages and
-- 'who read this' lists", but nothing enforced it at the RLS layer;
-- only `lib/queries/discover.ts` filtered on it in application code.
--
-- This migration makes the flag real:
--   * owners always see their own rows,
--   * everyone else sees a user's rows only while that user's profile
--     has `discovery_visible` true (NULL is treated as true, matching
--     the column default and the `?? true` fallback in app code),
--   * admins retain full visibility so the admin panel keeps working.
-- ============================================

-- ============================================
-- 1. user_books
-- ============================================

DROP POLICY IF EXISTS "User books are publicly viewable" ON public.user_books;

CREATE POLICY "Shelves are viewable by owner or when discoverable"
ON public.user_books FOR SELECT
USING (
  (SELECT auth.uid()) = user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_books.user_id
      AND COALESCE(p.discovery_visible, true)
  )
);

CREATE POLICY "Admins can view all user books"
ON public.user_books FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  )
);

-- ============================================
-- 2. reading_stats
--
-- "Users can view their own stats" (auth.uid() = user_id) already
-- exists and is left in place; permissive policies are OR'd, so the
-- owner path stays covered even though it is also covered below.
-- ============================================

DROP POLICY IF EXISTS "Public can view reading stats" ON public.reading_stats;

CREATE POLICY "Reading stats are viewable by owner or when discoverable"
ON public.reading_stats FOR SELECT
USING (
  (SELECT auth.uid()) = user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = reading_stats.user_id
      AND COALESCE(p.discovery_visible, true)
  )
);

CREATE POLICY "Admins can view all reading stats"
ON public.reading_stats FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  )
);

-- ============================================
-- 3. Documentation
-- ============================================

COMMENT ON COLUMN public.profiles.discovery_visible IS
  'When false, the user is hidden from discovery pages and "who read this" lists, and their user_books / reading_stats rows are readable only by themselves and admins (enforced by RLS, migration 056).';
