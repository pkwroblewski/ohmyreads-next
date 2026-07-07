-- Fix infinite recursion (42P17) in book_club_members RLS and close an
-- authorization hole in the admin-delete policy.
--
-- Background: "Anyone can view members of visible clubs" self-referenced
-- book_club_members inside its own USING expression, so every SELECT on the
-- table raised 42P17 (member lists crashed on all club pages; any policy in
-- the permissive OR-chain recursing poisons the whole query). A non-recursive
-- replacement ("Members can view club memberships", built on SECURITY DEFINER
-- helpers) already existed but the old policy was never dropped.
--
-- "Admins can remove members" both self-referenced the table AND contained a
-- tautology (bcm.club_id = bcm.club_id), which authorized any admin of ANY
-- club to delete membership rows in every club.

-- 1. Drop the recursive SELECT policy; the helper-based policy grants the
--    intended access (own rows, public clubs, clubs you belong to).
DROP POLICY IF EXISTS "Anyone can view members of visible clubs" ON book_club_members;

-- 2. Non-recursive admin check (SECURITY DEFINER bypasses RLS inside).
CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_club_members
    WHERE club_id = p_club_id AND user_id = auth.uid() AND role = 'admin'
  )
$$;

-- 3. Recreate the delete policy, correctly scoped to the row's own club.
DROP POLICY IF EXISTS "Admins can remove members" ON book_club_members;
CREATE POLICY "Admins can remove members" ON book_club_members
  FOR DELETE USING (is_club_admin(club_id));
