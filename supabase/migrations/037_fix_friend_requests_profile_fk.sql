-- =============================================
-- Fix Friend Requests -> Profiles Foreign Keys
-- =============================================
-- Issue: friend_requests table has FKs to auth.users, but queries try to join with profiles
-- Migration 028 attempted to add FKs but used same names as existing constraints
-- Solution: Add FKs with NEW names from friend_requests to profiles
-- This allows Supabase PostgREST to properly resolve the join syntax

-- Add FK from sender_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_sender_profile_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
    ADD CONSTRAINT friend_requests_sender_profile_fkey
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from receiver_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_receiver_profile_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
    ADD CONSTRAINT friend_requests_receiver_profile_fkey
    FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
