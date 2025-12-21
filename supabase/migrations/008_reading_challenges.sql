-- =============================================
-- Reading Challenges Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Challenge type enum
CREATE TYPE challenge_type AS ENUM ('books_count', 'pages_count', 'genre_books');

-- Challenge status enum
CREATE TYPE challenge_status AS ENUM ('active', 'completed', 'failed', 'abandoned');

-- Reading Challenges Table
CREATE TABLE IF NOT EXISTS public.reading_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Challenge definition
  name TEXT NOT NULL,
  description TEXT,
  challenge_type challenge_type NOT NULL DEFAULT 'books_count',
  target_value INTEGER NOT NULL,
  genre TEXT, -- Only used for genre_books type

  -- Time period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Progress tracking
  current_value INTEGER NOT NULL DEFAULT 0,
  status challenge_status NOT NULL DEFAULT 'active',
  completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date > start_date),
  CONSTRAINT valid_target CHECK (target_value > 0),
  CONSTRAINT genre_required_for_type CHECK (
    (challenge_type != 'genre_books') OR (genre IS NOT NULL)
  )
);

-- RLS for reading_challenges
ALTER TABLE public.reading_challenges ENABLE ROW LEVEL SECURITY;

-- Users can view their own challenges
CREATE POLICY "Users can view their own challenges"
  ON public.reading_challenges FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own challenges
CREATE POLICY "Users can create their own challenges"
  ON public.reading_challenges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own challenges
CREATE POLICY "Users can update their own challenges"
  ON public.reading_challenges FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own challenges
CREATE POLICY "Users can delete their own challenges"
  ON public.reading_challenges FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS reading_challenges_user_idx ON public.reading_challenges(user_id);
CREATE INDEX IF NOT EXISTS reading_challenges_status_idx ON public.reading_challenges(user_id, status);
CREATE INDEX IF NOT EXISTS reading_challenges_dates_idx ON public.reading_challenges(start_date, end_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS reading_challenges_updated_at ON public.reading_challenges;
CREATE TRIGGER reading_challenges_updated_at
  BEFORE UPDATE ON public.reading_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
