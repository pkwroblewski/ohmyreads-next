-- Migration: Make review rating optional
-- Allows text-only reviews (without star rating)
-- PostgreSQL AVG() already ignores NULLs, but we update recalculate_book_rating
-- to use COUNT(rating) instead of COUNT(*) for accurate ratings_count

-- 1. Drop NOT NULL constraint and update CHECK
ALTER TABLE public.reviews ALTER COLUMN rating DROP NOT NULL;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- 2. Update recalculate_book_rating to handle NULL ratings
-- AVG() already ignores NULLs, but COUNT(*) would count all reviews
-- We want ratings_count to reflect only reviews WITH ratings
CREATE OR REPLACE FUNCTION public.recalculate_book_rating(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rating numeric;
  v_count integer;
BEGIN
  SELECT
    ROUND(AVG(rating)::numeric, 1),
    COUNT(rating)
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
