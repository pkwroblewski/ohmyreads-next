-- Migration: Fix book_club_members RLS policies for club creation
-- Problem: Club creators cannot add themselves as admin because existing INSERT policy
-- only allows joining PUBLIC clubs. Private club creation fails.

-- Policy 1: Allow club creators to add themselves as admin
-- This enables the club creation flow where creator is added as first admin member
CREATE POLICY "Club creators can add themselves as admin"
ON public.book_club_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  role = 'admin' AND
  EXISTS (SELECT 1 FROM public.book_clubs WHERE id = club_id AND created_by = auth.uid())
);

-- Policy 2: Allow admins to add members to their clubs (for invites)
-- This enables admin functionality to invite users to private clubs
CREATE POLICY "Club admins can add members"
ON public.book_club_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.book_club_members existing
    WHERE existing.club_id = book_club_members.club_id
    AND existing.user_id = auth.uid()
    AND existing.role = 'admin'
  )
);
