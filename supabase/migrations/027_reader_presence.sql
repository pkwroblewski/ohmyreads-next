-- ============================================
-- 027: Reader Presence System
-- ============================================
-- Adds presence type to profiles for temporary location sharing.
-- - static: permanent home location (current behavior)
-- - temporary: "I'm here now" with auto-expiry (1-4 hours)
-- - recommended: "Great reading spot" with longer expiry (7 days)

-- ============================================
-- 1) Add presence fields to profiles
-- ============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS presence_type text DEFAULT 'static'
  CHECK (presence_type IN ('static', 'temporary', 'recommended')),
ADD COLUMN IF NOT EXISTS presence_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS presence_note text;

-- Add constraint for note length (140 chars max)
ALTER TABLE public.profiles
ADD CONSTRAINT presence_note_length CHECK (char_length(presence_note) <= 140);

-- ============================================
-- 2) Index for filtering active presence
-- ============================================

-- Index for finding users with active temporary/recommended presence
CREATE INDEX IF NOT EXISTS idx_profiles_presence_active
ON public.profiles (presence_type, presence_expires_at)
WHERE presence_type != 'static';

-- ============================================
-- 3) Function to clean up expired presence
-- ============================================

-- This function resets expired temporary/recommended presence back to static
CREATE OR REPLACE FUNCTION public.cleanup_expired_presence()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.profiles
  SET
    presence_type = 'static',
    presence_expires_at = NULL,
    presence_note = NULL
  WHERE
    presence_type != 'static'
    AND presence_expires_at IS NOT NULL
    AND presence_expires_at < NOW();

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- Comment explaining the function
COMMENT ON FUNCTION public.cleanup_expired_presence IS
  'Resets expired temporary/recommended presence back to static. Can be called periodically via cron or on-demand.';
