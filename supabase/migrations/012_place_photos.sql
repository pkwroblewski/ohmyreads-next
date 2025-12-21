-- ============================================
-- PLACE PHOTOS
-- Users can upload photos of places
-- ============================================

-- Create place_photos table
CREATE TABLE IF NOT EXISTS public.place_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  is_approved BOOLEAN DEFAULT true, -- Auto-approve for now, can add moderation later
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add photos_count to places table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'places'
    AND column_name = 'photos_count'
  ) THEN
    ALTER TABLE public.places ADD COLUMN photos_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_place_photos_place_id ON public.place_photos(place_id);
CREATE INDEX IF NOT EXISTS idx_place_photos_user_id ON public.place_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_place_photos_approved ON public.place_photos(is_approved) WHERE is_approved = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.place_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved photos
CREATE POLICY "Approved photos are viewable by everyone"
  ON public.place_photos
  FOR SELECT
  USING (is_approved = true);

-- Users can view their own photos (even if not approved)
CREATE POLICY "Users can view their own photos"
  ON public.place_photos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can upload photos
CREATE POLICY "Authenticated users can upload photos"
  ON public.place_photos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own photos"
  ON public.place_photos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: Update photos_count on places
-- ============================================

CREATE OR REPLACE FUNCTION update_place_photos_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.places
    SET photos_count = COALESCE(photos_count, 0) + 1
    WHERE id = NEW.place_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.places
    SET photos_count = GREATEST(COALESCE(photos_count, 0) - 1, 0)
    WHERE id = OLD.place_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_place_photos_count ON public.place_photos;
CREATE TRIGGER trigger_update_place_photos_count
AFTER INSERT OR DELETE ON public.place_photos
FOR EACH ROW
EXECUTE FUNCTION update_place_photos_count();
