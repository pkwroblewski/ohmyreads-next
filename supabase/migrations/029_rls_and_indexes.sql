-- ============================================
-- RLS Fixes and Performance Indexes
-- ============================================

-- ============================================
-- 1. reading_stats: Allow public SELECT
-- Issue: Anonymous users can't see stats on public profiles
-- ============================================

CREATE POLICY "Public can view reading stats"
ON public.reading_stats FOR SELECT
USING (true);

-- ============================================
-- 2. user_books: Allow public SELECT
-- Issue: "Who read this book" feature blocked
-- ============================================

CREATE POLICY "User books are publicly viewable"
ON public.user_books FOR SELECT
USING (true);

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own books" ON public.user_books;

-- ============================================
-- 3. friend_requests: Add WITH CHECK on UPDATE
-- Issue: UPDATE policy lacks status transition validation
-- ============================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Receivers can respond to friend requests" ON public.friend_requests;

-- Create new policy with WITH CHECK clause
CREATE POLICY "Receivers can respond to friend requests"
ON public.friend_requests FOR UPDATE
USING (auth.uid() = receiver_id AND status = 'pending')
WITH CHECK (status IN ('accepted', 'rejected'));

-- ============================================
-- 4. Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON public.activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- ============================================
-- 5. Audit Columns for comments and books
-- ============================================

-- Add updated_at to comments if not exists
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at to books if not exists
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger for comments updated_at
DROP TRIGGER IF EXISTS comments_updated_at ON public.comments;
CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create trigger for books updated_at
DROP TRIGGER IF EXISTS books_updated_at ON public.books;
CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 6. Optional Improvements
-- ============================================

-- Message content length constraint (10KB max)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dm_content_length'
  ) THEN
    ALTER TABLE public.direct_messages
    ADD CONSTRAINT dm_content_length CHECK (length(content) <= 10000);
  END IF;
END $$;

-- Social links unique per platform per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_links_user_platform_unique'
  ) THEN
    ALTER TABLE public.social_links
    ADD CONSTRAINT social_links_user_platform_unique UNIQUE(user_id, platform);
  END IF;
END $$;
