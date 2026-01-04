-- ============================================
-- Migration 026: Reading Lists
-- User-created shareable book lists
-- ============================================

-- Create reading_lists table
CREATE TABLE public.reading_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Create reading_list_books table
CREATE TABLE public.reading_list_books (
  list_id UUID REFERENCES public.reading_lists(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  note TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (list_id, book_id)
);

-- Create reading_list_likes table
CREATE TABLE public.reading_list_likes (
  list_id UUID REFERENCES public.reading_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX reading_lists_user_idx ON public.reading_lists(user_id);
CREATE INDEX reading_lists_visibility_idx ON public.reading_lists(visibility) WHERE visibility = 'public';
CREATE INDEX reading_lists_likes_idx ON public.reading_lists(likes_count DESC);
CREATE INDEX reading_lists_created_idx ON public.reading_lists(created_at DESC);

CREATE INDEX reading_list_books_list_idx ON public.reading_list_books(list_id);
CREATE INDEX reading_list_books_position_idx ON public.reading_list_books(list_id, position);

CREATE INDEX reading_list_likes_list_idx ON public.reading_list_likes(list_id);
CREATE INDEX reading_list_likes_user_idx ON public.reading_list_likes(user_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.reading_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_list_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_list_likes ENABLE ROW LEVEL SECURITY;

-- Lists: Anyone can view public lists, owner can view their private lists
CREATE POLICY "Anyone can view public lists"
ON public.reading_lists FOR SELECT
USING (visibility = 'public' OR user_id = auth.uid());

-- Lists: Authenticated users can create lists
CREATE POLICY "Users can create their own lists"
ON public.reading_lists FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Lists: Owners can update their lists
CREATE POLICY "Users can update their own lists"
ON public.reading_lists FOR UPDATE
USING (auth.uid() = user_id);

-- Lists: Owners can delete their lists
CREATE POLICY "Users can delete their own lists"
ON public.reading_lists FOR DELETE
USING (auth.uid() = user_id);

-- List Books: Anyone can view books in visible lists
CREATE POLICY "Anyone can view books in visible lists"
ON public.reading_list_books FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.reading_lists
  WHERE id = list_id AND (visibility = 'public' OR user_id = auth.uid())
));

-- List Books: Owners can manage books in their lists
CREATE POLICY "Owners can add books to their lists"
ON public.reading_list_books FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.reading_lists
  WHERE id = list_id AND user_id = auth.uid()
));

CREATE POLICY "Owners can update books in their lists"
ON public.reading_list_books FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.reading_lists
  WHERE id = list_id AND user_id = auth.uid()
));

CREATE POLICY "Owners can remove books from their lists"
ON public.reading_list_books FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.reading_lists
  WHERE id = list_id AND user_id = auth.uid()
));

-- Likes: Anyone can view likes on visible lists
CREATE POLICY "Anyone can view likes on visible lists"
ON public.reading_list_likes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.reading_lists
  WHERE id = list_id AND (visibility = 'public' OR user_id = auth.uid())
));

-- Likes: Authenticated users can like public lists
CREATE POLICY "Users can like public lists"
ON public.reading_list_likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.reading_lists WHERE id = list_id AND visibility = 'public')
);

-- Likes: Users can remove their own likes
CREATE POLICY "Users can remove their own likes"
ON public.reading_list_likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- Triggers
-- ============================================

-- Update likes_count when likes change
CREATE OR REPLACE FUNCTION update_list_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reading_lists SET likes_count = likes_count + 1 WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reading_lists SET likes_count = likes_count - 1 WHERE id = OLD.list_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_list_like_change
AFTER INSERT OR DELETE ON public.reading_list_likes
FOR EACH ROW EXECUTE FUNCTION update_list_likes_count();

-- Update timestamp on list changes
CREATE OR REPLACE FUNCTION update_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_list_update
BEFORE UPDATE ON public.reading_lists
FOR EACH ROW EXECUTE FUNCTION update_list_timestamp();

-- ============================================
-- Helper function to generate slug
-- ============================================

CREATE OR REPLACE FUNCTION generate_list_slug(list_title TEXT, owner_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(list_title, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Limit length
  base_slug := substring(base_slug from 1 for 50);

  final_slug := base_slug;

  -- Check for uniqueness within user's lists and add counter if needed
  WHILE EXISTS (SELECT 1 FROM public.reading_lists WHERE slug = final_slug AND user_id = owner_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
