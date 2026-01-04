-- =============================================
-- Custom User Shelves (like Goodreads)
-- Run this in Supabase SQL Editor
-- =============================================

-- Custom user shelves table
CREATE TABLE IF NOT EXISTS public.user_shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  color VARCHAR(7), -- hex color for UI (e.g., '#FF5733')
  icon VARCHAR(50), -- optional icon name
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only have one shelf with a given name
  UNIQUE(user_id, name)
);

-- Junction table for books in shelves (many-to-many)
CREATE TABLE IF NOT EXISTS public.shelf_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id UUID REFERENCES public.user_shelves(id) ON DELETE CASCADE NOT NULL,
  user_book_id UUID REFERENCES public.user_books(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT, -- optional notes specific to this shelf placement
  -- A book can only be on a shelf once
  UNIQUE(shelf_id, user_book_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS user_shelves_user_id_idx ON public.user_shelves(user_id);
CREATE INDEX IF NOT EXISTS user_shelves_sort_order_idx ON public.user_shelves(user_id, sort_order);
CREATE INDEX IF NOT EXISTS shelf_books_shelf_id_idx ON public.shelf_books(shelf_id);
CREATE INDEX IF NOT EXISTS shelf_books_user_book_id_idx ON public.shelf_books(user_book_id);

-- RLS for user_shelves
ALTER TABLE public.user_shelves ENABLE ROW LEVEL SECURITY;

-- Users can view their own shelves
CREATE POLICY "Users can view own shelves"
  ON public.user_shelves FOR SELECT
  USING (auth.uid() = user_id);

-- Public shelves are viewable by everyone
CREATE POLICY "Public shelves are viewable"
  ON public.user_shelves FOR SELECT
  USING (is_public = true);

-- Users can create their own shelves
CREATE POLICY "Users can create own shelves"
  ON public.user_shelves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own shelves
CREATE POLICY "Users can update own shelves"
  ON public.user_shelves FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own shelves
CREATE POLICY "Users can delete own shelves"
  ON public.user_shelves FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for shelf_books
ALTER TABLE public.shelf_books ENABLE ROW LEVEL SECURITY;

-- Users can view books in their own shelves
CREATE POLICY "Users can view own shelf books"
  ON public.shelf_books FOR SELECT
  USING (
    shelf_id IN (SELECT id FROM public.user_shelves WHERE user_id = auth.uid())
  );

-- Anyone can view books in public shelves
CREATE POLICY "Public shelf books are viewable"
  ON public.shelf_books FOR SELECT
  USING (
    shelf_id IN (SELECT id FROM public.user_shelves WHERE is_public = true)
  );

-- Users can add books to their own shelves
CREATE POLICY "Users can add to own shelves"
  ON public.shelf_books FOR INSERT
  WITH CHECK (
    shelf_id IN (SELECT id FROM public.user_shelves WHERE user_id = auth.uid())
  );

-- Users can update their own shelf book entries
CREATE POLICY "Users can update own shelf books"
  ON public.shelf_books FOR UPDATE
  USING (
    shelf_id IN (SELECT id FROM public.user_shelves WHERE user_id = auth.uid())
  );

-- Users can remove books from their own shelves
CREATE POLICY "Users can remove from own shelves"
  ON public.shelf_books FOR DELETE
  USING (
    shelf_id IN (SELECT id FROM public.user_shelves WHERE user_id = auth.uid())
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS user_shelves_updated_at ON public.user_shelves;
CREATE TRIGGER user_shelves_updated_at
  BEFORE UPDATE ON public.user_shelves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Helper function to get shelf count for a user
CREATE OR REPLACE FUNCTION get_user_shelf_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.user_shelves WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER;
