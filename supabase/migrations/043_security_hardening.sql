-- Migration: Security hardening for profiles and admin_role_changes
-- Fixes privilege escalation vulnerabilities:
-- 1. Users updating is_admin on their own profile via browser console
-- 2. Users inserting fake audit records into admin_role_changes

-- =============================================
-- PART 1: Protect admin columns on profiles
-- =============================================

-- Create function to prevent non-service-role users from modifying admin columns
CREATE OR REPLACE FUNCTION public.protect_admin_columns()
RETURNS TRIGGER AS $$
DECLARE
  db_role TEXT;
BEGIN
  -- Get the current database role
  db_role := current_setting('role', true);

  -- Only service_role can modify admin columns
  -- For all other roles (authenticated, anon), silently reset admin columns to old values
  IF db_role != 'service_role' THEN
    -- Check if any admin column was modified
    IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
       (OLD.admin_granted_at IS DISTINCT FROM NEW.admin_granted_at) OR
       (OLD.admin_granted_by IS DISTINCT FROM NEW.admin_granted_by) THEN
      -- Silently revert admin columns to their previous values
      NEW.is_admin := OLD.is_admin;
      NEW.admin_granted_at := OLD.admin_granted_at;
      NEW.admin_granted_by := OLD.admin_granted_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create BEFORE UPDATE trigger on profiles
DROP TRIGGER IF EXISTS protect_admin_columns_trigger ON public.profiles;
CREATE TRIGGER protect_admin_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_columns();

-- =============================================
-- PART 2: Fix admin_role_changes INSERT policy
-- =============================================

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert admin role changes" ON public.admin_role_changes;

-- Create new policy: Only admins can insert audit records
-- This assumes that legitimate inserts come from server actions where requireAdmin() validates is_admin
CREATE POLICY "Admins can insert admin role changes" ON public.admin_role_changes
  FOR INSERT
  WITH CHECK (
    -- Verify the user inserting is an admin
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Add comment explaining the security model
COMMENT ON POLICY "Admins can insert admin role changes" ON public.admin_role_changes IS
  'Only admin users can insert audit records. Server actions using service_role bypass RLS entirely and can always insert.';

COMMENT ON FUNCTION public.protect_admin_columns() IS
  'Prevents non-service-role operations from modifying admin columns (is_admin, admin_granted_at, admin_granted_by) on profiles. Service role operations bypass RLS entirely and are not affected by this trigger.';
