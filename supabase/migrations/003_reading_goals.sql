-- =============================================
-- Reading Goals Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Reading Goals Table
CREATE TABLE IF NOT EXISTS public.reading_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  target_books INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- RLS for reading_goals
ALTER TABLE public.reading_goals ENABLE ROW LEVEL SECURITY;

-- Users can view their own goals
CREATE POLICY "Users can view their own goals"
  ON public.reading_goals FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own goals
CREATE POLICY "Users can create their own goals"
  ON public.reading_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own goals
CREATE POLICY "Users can update their own goals"
  ON public.reading_goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS reading_goals_user_year_idx ON public.reading_goals(user_id, year);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS reading_goals_updated_at ON public.reading_goals;
CREATE TRIGGER reading_goals_updated_at
  BEFORE UPDATE ON public.reading_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

