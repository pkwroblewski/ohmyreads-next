-- Migration: Fix RLS policy chain that causes infinite recursion
-- Problem: book_clubs SELECT → book_club_members SELECT → book_clubs SELECT = recursion
-- Solution: Use SECURITY DEFINER helper functions to break the cycle

-- Helper function to check if user is a member of a club (bypasses RLS)
CREATE OR REPLACE FUNCTION is_club_member(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get club visibility (bypasses RLS)
CREATE OR REPLACE FUNCTION get_club_visibility(p_club_id UUID)
RETURNS TEXT AS $$
  SELECT visibility FROM public.book_clubs WHERE id = p_club_id
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view public book clubs" ON public.book_clubs;
DROP POLICY IF EXISTS "Members can view club memberships" ON public.book_club_members;

-- Recreate book_clubs SELECT policy using helper function
CREATE POLICY "Anyone can view public book clubs"
ON public.book_clubs FOR SELECT
USING (
  visibility = 'public'
  OR created_by = auth.uid()
  OR is_club_member(id)
);

-- Recreate book_club_members SELECT policy using helper function
CREATE POLICY "Members can view club memberships"
ON public.book_club_members FOR SELECT
USING (
  user_id = auth.uid()
  OR get_club_visibility(club_id) = 'public'
  OR is_club_member(club_id)
);
