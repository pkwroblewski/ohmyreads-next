-- =============================================
-- Activity Feed for Community Page
-- Global feed of reviews + shelf events
-- =============================================

-- =============================================
-- 1. ACTIVITY_FEED TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('review', 'started_reading')) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast feed queries
CREATE INDEX IF NOT EXISTS activity_feed_created_at_desc_idx 
  ON public.activity_feed (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS activity_feed_type_created_at_idx 
  ON public.activity_feed (type, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_feed_user_created_at_idx 
  ON public.activity_feed (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can browse the feed)
CREATE POLICY "Activity feed is publicly readable"
  ON public.activity_feed FOR SELECT
  USING (true);

-- No direct inserts by clients (only triggers write)
-- No INSERT/UPDATE/DELETE policies for regular users

-- =============================================
-- 2. ADD PRIVACY FLAG TO PROFILES
-- =============================================
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_public_activity BOOLEAN DEFAULT TRUE;

-- =============================================
-- 3. TRIGGER: Insert activity on review created
-- =============================================
CREATE OR REPLACE FUNCTION public.on_review_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_feed (type, user_id, book_id, review_id, created_at)
  VALUES ('review', NEW.user_id, NEW.book_id, NEW.id, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS review_creates_activity ON public.reviews;
CREATE TRIGGER review_creates_activity
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.on_review_created();

-- =============================================
-- 4. TRIGGER: Insert activity on started reading
-- Only fires when status transitions to 'reading'
-- and user has public activity enabled
-- =============================================
CREATE OR REPLACE FUNCTION public.on_started_reading()
RETURNS TRIGGER AS $$
DECLARE
  is_public BOOLEAN;
BEGIN
  -- Only trigger on INSERT with status='reading' 
  -- OR UPDATE where status changed TO 'reading'
  IF (TG_OP = 'INSERT' AND NEW.status = 'reading') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'reading' AND (OLD.status IS NULL OR OLD.status <> 'reading')) THEN
    
    -- Check if user has public activity enabled
    SELECT is_public_activity INTO is_public
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Default to true if not set or profile not found
    IF is_public IS NULL OR is_public = TRUE THEN
      INSERT INTO public.activity_feed (type, user_id, book_id, created_at)
      VALUES ('started_reading', NEW.user_id, NEW.book_id, NOW());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS user_books_started_reading ON public.user_books;
CREATE TRIGGER user_books_started_reading
  AFTER INSERT OR UPDATE ON public.user_books
  FOR EACH ROW EXECUTE FUNCTION public.on_started_reading();

-- =============================================
-- 5. TRIGGER: Delete activity when review deleted
-- =============================================
CREATE OR REPLACE FUNCTION public.on_review_deleted()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.activity_feed
  WHERE review_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS review_deletes_activity ON public.reviews;
CREATE TRIGGER review_deletes_activity
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.on_review_deleted();

