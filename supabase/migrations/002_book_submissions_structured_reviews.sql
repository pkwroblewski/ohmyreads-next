-- =============================================
-- OhMyReads Database Schema Update
-- Book Submissions, Structured Reviews, Review Likes
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. BOOK SUBMISSIONS TABLE (for user-submitted books with moderation)
-- =============================================
CREATE TABLE IF NOT EXISTS public.book_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  slug TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  genres TEXT[] DEFAULT '{}',
  published_date DATE,
  page_count INTEGER,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  moderated_by UUID REFERENCES auth.users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  book_id UUID REFERENCES public.books(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS book_submissions_slug_idx ON public.book_submissions(slug);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS book_submissions_status_idx ON public.book_submissions(status);

-- Create index for user's submissions
CREATE INDEX IF NOT EXISTS book_submissions_submitted_by_idx ON public.book_submissions(submitted_by);

-- RLS Policies for book_submissions
ALTER TABLE public.book_submissions ENABLE ROW LEVEL SECURITY;

-- Everyone can view approved submissions
CREATE POLICY "Anyone can view approved submissions"
  ON public.book_submissions FOR SELECT
  USING (status = 'approved');

-- Submitters can view their own submissions (any status)
CREATE POLICY "Users can view their own submissions"
  ON public.book_submissions FOR SELECT
  USING (auth.uid() = submitted_by);

-- Authenticated users can create submissions
CREATE POLICY "Authenticated users can submit books"
  ON public.book_submissions FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- Submitters can update pending submissions
CREATE POLICY "Users can update their pending submissions"
  ON public.book_submissions FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending');

-- =============================================
-- 2. ADD is_admin COLUMN TO PROFILES
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- =============================================
-- 3. ADD STRUCTURED REVIEW COLUMNS TO REVIEWS TABLE
-- =============================================
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS liked TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS disliked TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS takeaway TEXT;

-- =============================================
-- 4. REVIEW LIKES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Indexes for review_likes
CREATE INDEX IF NOT EXISTS review_likes_review_id_idx ON public.review_likes(review_id);
CREATE INDEX IF NOT EXISTS review_likes_user_id_idx ON public.review_likes(user_id);

-- RLS for review_likes
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view review likes
CREATE POLICY "Anyone can view review likes"
  ON public.review_likes FOR SELECT
  USING (true);

-- Users can add their own likes
CREATE POLICY "Users can like reviews"
  ON public.review_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can unlike reviews"
  ON public.review_likes FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 5. FUNCTIONS FOR LIKE COUNT UPDATES
-- =============================================

-- Function to increment review likes
CREATE OR REPLACE FUNCTION increment_review_likes(review_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.reviews
  SET likes_count = likes_count + 1
  WHERE id = review_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement review likes
CREATE OR REPLACE FUNCTION decrement_review_likes(review_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.reviews
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = review_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. TRIGGER FOR book_submissions updated_at
-- =============================================
DROP TRIGGER IF EXISTS book_submissions_updated_at ON public.book_submissions;
CREATE TRIGGER book_submissions_updated_at
  BEFORE UPDATE ON public.book_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

