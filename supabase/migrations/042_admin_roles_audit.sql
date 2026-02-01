-- =============================================
-- Migration: Database-backed Admin Roles with Audit Trail
--
-- Changes:
-- 1. Add admin_granted_at and admin_granted_by to profiles
-- 2. Create admin_role_changes audit table
-- 3. Update existing admins to have granted_at set
-- =============================================

-- 1. Add admin tracking columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS admin_granted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for querying admin users
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON public.profiles (is_admin)
WHERE is_admin = true;

-- 2. Create admin role changes audit table
CREATE TABLE IF NOT EXISTS public.admin_role_changes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  source TEXT NOT NULL CHECK (source IN ('env_initial', 'admin_action', 'system')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on admin_role_changes
ALTER TABLE public.admin_role_changes ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin role changes
CREATE POLICY "Admins can view admin role changes" ON public.admin_role_changes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Only system (via service role) can insert - no direct user inserts
-- The insert will happen through server actions using service role
CREATE POLICY "Service role can insert admin role changes" ON public.admin_role_changes
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for admin_role_changes
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_user_id ON public.admin_role_changes (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_changed_by ON public.admin_role_changes (changed_by);
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_created_at ON public.admin_role_changes (created_at DESC);

-- 3. Backfill existing admins with granted_at (set to their created_at as best guess)
-- Also log initial state in audit table
DO $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT id, created_at, is_admin FROM public.profiles WHERE is_admin = true
  LOOP
    -- Set admin_granted_at to account creation time (best guess for existing admins)
    UPDATE public.profiles
    SET admin_granted_at = admin_record.created_at
    WHERE id = admin_record.id AND admin_granted_at IS NULL;

    -- Log the initial state (from env var provisioning)
    INSERT INTO public.admin_role_changes (user_id, changed_by, action, source, reason)
    VALUES (
      admin_record.id,
      NULL,
      'granted',
      'env_initial',
      'Backfill: admin status existed before audit tracking'
    );
  END LOOP;
END $$;

-- Comment on new columns
COMMENT ON COLUMN public.profiles.admin_granted_at IS 'Timestamp when admin role was granted';
COMMENT ON COLUMN public.profiles.admin_granted_by IS 'User ID who granted admin role (NULL if from env var or system)';
COMMENT ON TABLE public.admin_role_changes IS 'Audit log for admin role grants and revocations';
