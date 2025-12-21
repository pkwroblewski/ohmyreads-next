-- ============================================
-- 013: Place Check-ins Feature
-- ============================================
-- Users can check in at places, optionally associating
-- a book and note. Includes streak tracking and gamification.

-- ============================================
-- 1) Create place_checkins table
-- ============================================

CREATE TABLE IF NOT EXISTS public.place_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_checkins_place_id ON public.place_checkins(place_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON public.place_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON public.place_checkins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_user_place_recent ON public.place_checkins(user_id, place_id, created_at DESC);

-- ============================================
-- 2) User check-in stats (for streaks)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_checkin_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_checkins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3) Add checkins_count to places table
-- ============================================

ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS checkins_count INTEGER DEFAULT 0;

-- ============================================
-- 4) Add place_id and checkin_id to activity_feed
-- ============================================

ALTER TABLE public.activity_feed
ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS checkin_id UUID;

-- Make book_id nullable (check-ins may not have a book)
ALTER TABLE public.activity_feed
ALTER COLUMN book_id DROP NOT NULL;

-- ============================================
-- 5) Update activity_feed type constraint
-- ============================================

ALTER TABLE public.activity_feed
DROP CONSTRAINT IF EXISTS activity_feed_type_check;

ALTER TABLE public.activity_feed
ADD CONSTRAINT activity_feed_type_check
CHECK (type IN ('review', 'started_reading', 'checkin'));

-- ============================================
-- 6) RLS for place_checkins
-- ============================================

ALTER TABLE public.place_checkins ENABLE ROW LEVEL SECURITY;

-- Anyone can view check-ins
CREATE POLICY "Check-ins are publicly viewable"
  ON public.place_checkins FOR SELECT
  USING (true);

-- Authenticated users can create check-ins
CREATE POLICY "Authenticated users can create check-ins"
  ON public.place_checkins FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can delete their own check-ins
CREATE POLICY "Users can delete own check-ins"
  ON public.place_checkins FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 7) RLS for user_checkin_stats
-- ============================================

ALTER TABLE public.user_checkin_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view check-in stats
CREATE POLICY "Checkin stats are publicly viewable"
  ON public.user_checkin_stats FOR SELECT
  USING (true);

-- Stats are managed by triggers only (no direct writes)

-- ============================================
-- 8) Trigger: Update place checkins_count
-- ============================================

CREATE OR REPLACE FUNCTION public.update_place_checkins_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.places
    SET checkins_count = COALESCE(checkins_count, 0) + 1
    WHERE id = NEW.place_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.places
    SET checkins_count = GREATEST(COALESCE(checkins_count, 0) - 1, 0)
    WHERE id = OLD.place_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_place_checkins_count ON public.place_checkins;
CREATE TRIGGER trigger_update_place_checkins_count
  AFTER INSERT OR DELETE ON public.place_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_place_checkins_count();

-- ============================================
-- 9) Trigger: Update user streak stats
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_checkin_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_date DATE;
  today DATE := CURRENT_DATE;
  new_current_streak INTEGER;
  existing_streak INTEGER;
BEGIN
  -- Get or create user stats
  INSERT INTO public.user_checkin_stats (user_id, total_checkins, current_streak, longest_streak, last_checkin_date)
  VALUES (NEW.user_id, 0, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get last check-in date and current streak
  SELECT last_checkin_date, current_streak INTO last_date, existing_streak
  FROM public.user_checkin_stats
  WHERE user_id = NEW.user_id;

  -- Calculate new streak
  IF last_date IS NULL THEN
    -- First ever check-in
    new_current_streak := 1;
  ELSIF last_date = today THEN
    -- Same day check-in: no streak change, just increment count
    UPDATE public.user_checkin_stats
    SET
      total_checkins = total_checkins + 1,
      updated_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF last_date = today - INTERVAL '1 day' THEN
    -- Consecutive day: increment streak
    new_current_streak := existing_streak + 1;
  ELSE
    -- Gap > 1 day: reset streak to 1
    new_current_streak := 1;
  END IF;

  -- Update stats
  UPDATE public.user_checkin_stats
  SET
    total_checkins = total_checkins + 1,
    current_streak = new_current_streak,
    longest_streak = GREATEST(longest_streak, new_current_streak),
    last_checkin_date = today,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_user_checkin_stats ON public.place_checkins;
CREATE TRIGGER trigger_update_user_checkin_stats
  AFTER INSERT ON public.place_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_checkin_stats();

-- ============================================
-- 10) Trigger: Create activity feed entry
-- ============================================

CREATE OR REPLACE FUNCTION public.on_checkin_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_public BOOLEAN;
BEGIN
  -- Check if user has public activity enabled
  SELECT is_public_activity INTO is_public
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Default to true if not set
  IF is_public IS NULL OR is_public = TRUE THEN
    INSERT INTO public.activity_feed (type, user_id, book_id, place_id, checkin_id, created_at)
    VALUES ('checkin', NEW.user_id, NEW.book_id, NEW.place_id, NEW.id, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkin_creates_activity ON public.place_checkins;
CREATE TRIGGER checkin_creates_activity
  AFTER INSERT ON public.place_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.on_checkin_created();

-- ============================================
-- 11) Trigger: Delete activity when check-in deleted
-- ============================================

CREATE OR REPLACE FUNCTION public.on_checkin_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.activity_feed
  WHERE checkin_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS checkin_deletes_activity ON public.place_checkins;
CREATE TRIGGER checkin_deletes_activity
  AFTER DELETE ON public.place_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.on_checkin_deleted();
