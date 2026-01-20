-- Migration: Fix RLS infinite recursion on book_club_members
-- Problem: "Club admins can add members" policy queries book_club_members during INSERT,
-- which triggers RLS again, causing infinite recursion.
-- Solution: Drop the problematic policy. Club creation works with just the creator policy.
-- Admin invite functionality will need a different approach (e.g., SECURITY DEFINER function).

DROP POLICY IF EXISTS "Club admins can add members" ON public.book_club_members;
