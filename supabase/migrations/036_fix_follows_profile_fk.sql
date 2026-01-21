-- =============================================
-- Fix Follows -> Profiles Foreign Keys
-- =============================================
-- Issue: follows table has FKs to auth.users, but queries try to join with profiles
-- Solution: Add FKs from follows to profiles (profiles.id = auth.users.id)
-- This allows Supabase PostgREST to properly resolve the join syntax

-- Add FK from follower_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'follows_follower_profile_fkey'
  ) THEN
    ALTER TABLE public.follows
    ADD CONSTRAINT follows_follower_profile_fkey
    FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from following_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'follows_following_profile_fkey'
  ) THEN
    ALTER TABLE public.follows
    ADD CONSTRAINT follows_following_profile_fkey
    FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
