-- =============================================
-- Fix Reviews -> Profiles Foreign Key
-- =============================================
-- Issue: reviews.user_id has FK to auth.users, but getBookReviews query
-- needs to join with profiles using the syntax profile:profiles(...)
-- Solution: Add FK from reviews.user_id to profiles.id (profiles.id = auth.users.id)
-- This allows Supabase PostgREST to properly resolve the embedded resource join

-- Add FK from user_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_profile_fkey'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_user_profile_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
