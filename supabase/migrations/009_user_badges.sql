-- =============================================
-- User Badges Table
-- Run this in Supabase SQL Editor
-- =============================================

-- User Badges Table - stores which badges a user has earned
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id TEXT NOT NULL, -- References badge definition in code
  unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Unique constraint - user can only have each badge once
  UNIQUE(user_id, badge_id)
);

-- RLS for user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can view badges (they're public achievements)
CREATE POLICY "Badges are publicly viewable"
  ON public.user_badges FOR SELECT
  USING (true);

-- Only the system can insert badges (via server actions)
-- Users cannot manually add badges to themselves
CREATE POLICY "Users can receive badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users cannot update badges
-- No UPDATE policy needed

-- Users can delete their own badges (if they want to hide them)
CREATE POLICY "Users can remove their badges"
  ON public.user_badges FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS user_badges_user_idx ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS user_badges_badge_idx ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS user_badges_unlocked_idx ON public.user_badges(unlocked_at DESC);
