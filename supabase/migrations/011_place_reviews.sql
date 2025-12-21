-- ============================================
-- 011: Place Reviews System
-- ============================================
-- Adds user reviews for places with ratings,
-- content, and atmosphere tags.

-- ============================================
-- 1) Add rating columns to places table
-- ============================================

ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- ============================================
-- 2) Create place_reviews table
-- ============================================

CREATE TABLE IF NOT EXISTS public.place_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  atmosphere_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One review per user per place
  UNIQUE(place_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_place_reviews_place ON public.place_reviews (place_id);
CREATE INDEX IF NOT EXISTS idx_place_reviews_user ON public.place_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_place_reviews_rating ON public.place_reviews (rating);
CREATE INDEX IF NOT EXISTS idx_place_reviews_created ON public.place_reviews (created_at DESC);

-- ============================================
-- 3) Enable RLS
-- ============================================

ALTER TABLE public.place_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Anyone can read place reviews"
ON public.place_reviews FOR SELECT
USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews"
ON public.place_reviews FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON public.place_reviews FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
ON public.place_reviews FOR DELETE
USING (user_id = auth.uid());

-- ============================================
-- 4) Function to update place rating stats
-- ============================================

CREATE OR REPLACE FUNCTION public.update_place_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_place_id UUID;
BEGIN
  -- Get the place_id from the appropriate record
  IF TG_OP = 'DELETE' THEN
    target_place_id := OLD.place_id;
  ELSE
    target_place_id := NEW.place_id;
  END IF;

  -- Update the place's rating stats
  UPDATE public.places
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.place_reviews
      WHERE place_id = target_place_id
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM public.place_reviews
      WHERE place_id = target_place_id
    ),
    updated_at = now()
  WHERE id = target_place_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- 5) Triggers for auto-updating stats
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_place_rating_on_insert ON public.place_reviews;
CREATE TRIGGER trigger_update_place_rating_on_insert
  AFTER INSERT ON public.place_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_place_rating_stats();

DROP TRIGGER IF EXISTS trigger_update_place_rating_on_update ON public.place_reviews;
CREATE TRIGGER trigger_update_place_rating_on_update
  AFTER UPDATE ON public.place_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_place_rating_stats();

DROP TRIGGER IF EXISTS trigger_update_place_rating_on_delete ON public.place_reviews;
CREATE TRIGGER trigger_update_place_rating_on_delete
  AFTER DELETE ON public.place_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_place_rating_stats();

-- ============================================
-- 6) Predefined atmosphere tags
-- ============================================
-- These are suggestions for the UI, not enforced in DB:
-- 'cozy', 'quiet', 'busy', 'well-lit', 'good-coffee',
-- 'great-selection', 'helpful-staff', 'good-for-reading',
-- 'power-outlets', 'wifi', 'outdoor-seating', 'pet-friendly'
