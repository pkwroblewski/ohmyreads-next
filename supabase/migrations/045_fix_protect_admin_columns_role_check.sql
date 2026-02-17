-- Migration: Fix protect_admin_columns role check
-- Replaces unreliable current_setting('role', true) with auth.jwt() ->> 'role'
-- current_setting reads a PostgreSQL GUC which may not be reliably set per-request
-- with Supabase's connection pooling (Supavisor). auth.jwt() reads from the
-- request-scoped JWT claims set by PostgREST, which is always correct.

CREATE OR REPLACE FUNCTION public.protect_admin_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role can modify admin columns
  -- auth.jwt() ->> 'role' reads from request-scoped JWT claims (reliable with connection pooling)
  -- When no JWT is present (direct DB connection), this returns NULL, which also protects columns
  IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' THEN
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

COMMENT ON FUNCTION public.protect_admin_columns() IS
  'Prevents non-service-role operations from modifying admin columns (is_admin, admin_granted_at, admin_granted_by) on profiles. Uses auth.jwt() for reliable role detection with connection pooling.';
