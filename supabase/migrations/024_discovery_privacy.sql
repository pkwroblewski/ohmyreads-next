-- ============================================
-- Migration 024: Discovery Privacy Settings
-- Add opt-out option for reader discovery
-- ============================================

-- Add discovery_visible column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discovery_visible BOOLEAN DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.discovery_visible IS 'When false, user is hidden from discovery pages and "who read this" lists';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS profiles_discovery_visible_idx ON public.profiles(discovery_visible) WHERE discovery_visible = true;
