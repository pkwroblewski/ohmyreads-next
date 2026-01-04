-- ============================================
-- Migration 025: Book Clubs
-- Social book clubs for group reading
-- ============================================

-- Create book_clubs table
CREATE TABLE public.book_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create book_club_members table
CREATE TABLE public.book_club_members (
  club_id UUID REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

-- Create book_club_reads table (current/past books)
CREATE TABLE public.book_club_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'current' CHECK (status IN ('current', 'completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(club_id, book_id)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX book_clubs_slug_idx ON public.book_clubs(slug);
CREATE INDEX book_clubs_visibility_idx ON public.book_clubs(visibility) WHERE visibility = 'public';
CREATE INDEX book_clubs_created_by_idx ON public.book_clubs(created_by);
CREATE INDEX book_clubs_member_count_idx ON public.book_clubs(member_count DESC);

CREATE INDEX book_club_members_user_idx ON public.book_club_members(user_id);
CREATE INDEX book_club_members_club_idx ON public.book_club_members(club_id);

CREATE INDEX book_club_reads_club_idx ON public.book_club_reads(club_id);
CREATE INDEX book_club_reads_status_idx ON public.book_club_reads(status) WHERE status = 'current';

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_reads ENABLE ROW LEVEL SECURITY;

-- Book Clubs: Anyone can view public clubs, members can view private clubs
CREATE POLICY "Anyone can view public book clubs"
ON public.book_clubs FOR SELECT
USING (visibility = 'public' OR EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = id AND user_id = auth.uid()
));

-- Book Clubs: Authenticated users can create clubs
CREATE POLICY "Authenticated users can create book clubs"
ON public.book_clubs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Book Clubs: Admins can update their clubs
CREATE POLICY "Club admins can update their clubs"
ON public.book_clubs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = id AND user_id = auth.uid() AND role = 'admin'
));

-- Book Clubs: Admins can delete their clubs
CREATE POLICY "Club admins can delete their clubs"
ON public.book_clubs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = id AND user_id = auth.uid() AND role = 'admin'
));

-- Members: Anyone can view members of visible clubs
CREATE POLICY "Anyone can view members of visible clubs"
ON public.book_club_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.book_clubs
  WHERE id = club_id AND (visibility = 'public' OR EXISTS (
    SELECT 1 FROM public.book_club_members bcm
    WHERE bcm.club_id = id AND bcm.user_id = auth.uid()
  ))
));

-- Members: Users can join public clubs
CREATE POLICY "Users can join public clubs"
ON public.book_club_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.book_clubs WHERE id = club_id AND visibility = 'public')
);

-- Members: Users can leave clubs
CREATE POLICY "Users can leave clubs"
ON public.book_club_members FOR DELETE
USING (auth.uid() = user_id);

-- Members: Admins can remove members
CREATE POLICY "Admins can remove members"
ON public.book_club_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = book_club_members.club_id AND user_id = auth.uid() AND role = 'admin'
));

-- Reads: Anyone can view reads for visible clubs
CREATE POLICY "Anyone can view reads for visible clubs"
ON public.book_club_reads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.book_clubs
  WHERE id = club_id AND (visibility = 'public' OR EXISTS (
    SELECT 1 FROM public.book_club_members bcm
    WHERE bcm.club_id = id AND bcm.user_id = auth.uid()
  ))
));

-- Reads: Admins can manage reads
CREATE POLICY "Admins can manage club reads"
ON public.book_club_reads FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = book_club_reads.club_id AND user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can update club reads"
ON public.book_club_reads FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = book_club_reads.club_id AND user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can delete club reads"
ON public.book_club_reads FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.book_club_members
  WHERE club_id = book_club_reads.club_id AND user_id = auth.uid() AND role = 'admin'
));

-- ============================================
-- Triggers
-- ============================================

-- Update member count when members change
CREATE OR REPLACE FUNCTION update_club_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.book_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.book_clubs SET member_count = member_count - 1 WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_club_member_change
AFTER INSERT OR DELETE ON public.book_club_members
FOR EACH ROW EXECUTE FUNCTION update_club_member_count();

-- Update timestamp on club changes
CREATE OR REPLACE FUNCTION update_club_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_club_update
BEFORE UPDATE ON public.book_clubs
FOR EACH ROW EXECUTE FUNCTION update_club_timestamp();

-- ============================================
-- Helper function to generate slug
-- ============================================

CREATE OR REPLACE FUNCTION generate_club_slug(club_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(club_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Limit length
  base_slug := substring(base_slug from 1 for 50);

  final_slug := base_slug;

  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM public.book_clubs WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
