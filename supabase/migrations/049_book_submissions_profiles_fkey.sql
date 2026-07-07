-- =============================================
-- Add FK from book_submissions.submitted_by to public.profiles
-- =============================================
-- The original submitted_by FK references auth.users, which PostgREST cannot
-- use to embed profiles (`submitter:profiles!...` joins returned an error, so
-- the My Submissions and admin submissions pages received no data).
-- profiles.id is itself a CASCADE FK to auth.users.id, so this additive
-- constraint is semantically equivalent and enables the embed.

ALTER TABLE public.book_submissions
  ADD CONSTRAINT book_submissions_submitted_by_profiles_fkey
  FOREIGN KEY (submitted_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
