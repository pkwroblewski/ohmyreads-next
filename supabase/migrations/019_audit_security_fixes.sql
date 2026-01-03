-- =============================================
-- 019: Audit Security Fixes
-- Addresses findings from GPT 5.2 Codex High audit
-- =============================================

-- =============================================
-- 1. CRITICAL: Fix RLS Self-Approval Bypass
-- Issue: Users could change submission status to 'approved'
-- Fix: Add WITH CHECK to enforce status remains 'pending'
-- =============================================

DROP POLICY IF EXISTS "Users can update their pending submissions" ON public.book_submissions;

CREATE POLICY "Users can update their pending submissions"
  ON public.book_submissions
  FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending')
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- =============================================
-- 2. HIGH: Restrict Books Table Inserts to Admins
-- Issue: Any authenticated user could insert books directly
-- Fix: Only admins or service role can insert
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can insert books" ON public.books;

CREATE POLICY "Admins can insert books"
  ON public.books
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =============================================
-- 3. MEDIUM: Rating Recalculation RPC Function
-- Issue: JS code fetched all reviews per update (O(n))
-- Fix: SQL aggregate function for efficiency
-- =============================================

CREATE OR REPLACE FUNCTION public.recalculate_book_rating(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_rating numeric;
  v_count integer;
BEGIN
  SELECT
    ROUND(AVG(rating)::numeric, 1),
    COUNT(*)
  INTO v_avg_rating, v_count
  FROM public.reviews
  WHERE book_id = p_book_id;

  IF v_count = 0 THEN
    UPDATE public.books
    SET average_rating = NULL, ratings_count = 0
    WHERE id = p_book_id;
  ELSE
    UPDATE public.books
    SET average_rating = v_avg_rating, ratings_count = v_count
    WHERE id = p_book_id;
  END IF;
END;
$$;

-- =============================================
-- 4. MEDIUM: Atomic Book Approval Function
-- Issue: Book insert and submission update were separate (non-atomic)
-- Fix: Single transaction for both operations
-- =============================================

CREATE OR REPLACE FUNCTION public.approve_book_submission(
  p_submission_id uuid,
  p_moderator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission record;
  v_new_book_id uuid;
BEGIN
  -- Get the submission (lock row to prevent concurrent approval)
  SELECT * INTO v_submission
  FROM public.book_submissions
  WHERE id = p_submission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;

  -- Insert the book
  INSERT INTO public.books (
    title,
    author,
    slug,
    description,
    cover_url,
    isbn,
    genres,
    published_date,
    page_count,
    google_books_id,
    open_library_id,
    open_library_cover_id,
    cover_source
  )
  VALUES (
    v_submission.title,
    v_submission.author,
    v_submission.slug,
    v_submission.description,
    v_submission.cover_url,
    v_submission.isbn,
    v_submission.genres,
    v_submission.published_date,
    v_submission.page_count,
    v_submission.google_books_id,
    v_submission.open_library_id,
    v_submission.open_library_cover_id,
    v_submission.cover_source
  )
  RETURNING id INTO v_new_book_id;

  -- Update submission status
  UPDATE public.book_submissions
  SET
    status = 'approved',
    moderated_by = p_moderator_id,
    moderated_at = now(),
    book_id = v_new_book_id
  WHERE id = p_submission_id;

  RETURN v_new_book_id;
END;
$$;
