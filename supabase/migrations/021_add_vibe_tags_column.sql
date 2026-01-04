-- Add vibe_tags column to reviews table if not exists
-- This fixes the "Could not find the 'vibe_tags' column" error

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS vibe_tags TEXT[] DEFAULT '{}';

-- Index for searching reviews by vibe tags
CREATE INDEX IF NOT EXISTS reviews_vibe_tags_idx ON public.reviews USING GIN(vibe_tags);
