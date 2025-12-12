-- =============================================
-- OhMyReads Database Schema Update
-- User Taste Profiles and Review Vibe Tags
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. USER TASTE PROFILES TABLE
-- Stores user reading preferences for personalized recommendations
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_taste_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- Genre preferences (array of genre slugs the user enjoys)
  preferred_genres TEXT[] DEFAULT '{}',
  -- Vibe preferences (what moods/styles they enjoy)
  preferred_vibes TEXT[] DEFAULT '{}',
  -- Pace preference: 'slow', 'medium', 'fast', or null for no preference
  preferred_pace TEXT CHECK (preferred_pace IS NULL OR preferred_pace IN ('slow', 'medium', 'fast')),
  -- Length preference: 'short' (<250 pages), 'medium' (250-500), 'long' (500+), or null
  preferred_length TEXT CHECK (preferred_length IS NULL OR preferred_length IN ('short', 'medium', 'long')),
  -- Seed books: books the user loved (used for initial taste calibration)
  seed_book_ids UUID[] DEFAULT '{}',
  -- Whether onboarding is complete
  onboarding_completed BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_taste_profiles
CREATE INDEX IF NOT EXISTS user_taste_profiles_user_id_idx ON public.user_taste_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_taste_profiles_preferred_genres_idx ON public.user_taste_profiles USING GIN(preferred_genres);
CREATE INDEX IF NOT EXISTS user_taste_profiles_preferred_vibes_idx ON public.user_taste_profiles USING GIN(preferred_vibes);

-- RLS for user_taste_profiles
ALTER TABLE public.user_taste_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own taste profile
CREATE POLICY "Users can view their own taste profile"
  ON public.user_taste_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own taste profile
CREATE POLICY "Users can create their own taste profile"
  ON public.user_taste_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own taste profile
CREATE POLICY "Users can update their own taste profile"
  ON public.user_taste_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own taste profile
CREATE POLICY "Users can delete their own taste profile"
  ON public.user_taste_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 2. ADD VIBE TAGS COLUMN TO REVIEWS TABLE
-- Stores mood/vibe tags users apply to their reviews
-- =============================================
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS vibe_tags TEXT[] DEFAULT '{}';

-- Index for searching reviews by vibe tags
CREATE INDEX IF NOT EXISTS reviews_vibe_tags_idx ON public.reviews USING GIN(vibe_tags);

-- =============================================
-- 3. TRIGGER: Auto-update updated_at for taste profiles
-- =============================================
DROP TRIGGER IF EXISTS user_taste_profiles_updated_at ON public.user_taste_profiles;
CREATE TRIGGER user_taste_profiles_updated_at
  BEFORE UPDATE ON public.user_taste_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 4. STANDARD VIBE TAGS REFERENCE
-- These are the suggested/allowed vibe tags:
-- 
-- Emotional tone:
--   heartwarming, dark, funny, emotional, intense, hopeful, melancholic, inspiring
-- 
-- Pacing/Style:
--   slow-burn, page-turner, atmospheric, immersive, thought-provoking, cozy, adventurous
-- 
-- Character focus:
--   character-driven, plot-driven, ensemble-cast, unreliable-narrator
-- 
-- Reading experience:
--   quick-read, dense, literary, accessible, challenging
--
-- Content warnings (optional, can be separate):
--   mature-content, violence, romance, lgbtq, mental-health
-- =============================================

