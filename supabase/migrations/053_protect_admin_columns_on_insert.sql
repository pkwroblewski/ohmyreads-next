-- Migration: Extend admin-column protection to INSERT (privilege-escalation fix)
--
-- Problem: protect_admin_columns() was a BEFORE UPDATE trigger only. The
-- "Users can insert their own profile" policy (001_initial_schema.sql) has no
-- is_admin guard, so an authenticated user without a profile row could INSERT
-- { id: auth.uid(), is_admin: true } with the anon key and self-grant admin.
-- The narrow window is real: the app's own fallback provisioning paths
-- (callback/route.ts, ensureUserProfile) prove self-insert is reachable, and
-- the handle_new_user trigger has failed before (migrations 018/044).
--
-- Fix: the function now also runs BEFORE INSERT and forces the admin columns to
-- safe defaults for any JWT role other than service_role. Legitimate admin
-- provisioning from ADMIN_EMAILS is moved to the service-role client in the
-- application layer (callback/route.ts, lib/actions/user.ts), which this trigger
-- correctly permits. handle_new_user never sets is_admin, so it is unaffected.

CREATE OR REPLACE FUNCTION public.protect_admin_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role may set or modify admin columns.
  -- auth.jwt() ->> 'role' reads request-scoped JWT claims (reliable with
  -- Supavisor pooling). NULL (direct DB connection / no JWT) also protects.
  IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      -- A non-privileged insert can never self-assign admin.
      NEW.is_admin := false;
      NEW.admin_granted_at := NULL;
      NEW.admin_granted_by := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Revert any attempt to change admin columns to their previous values.
      IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
         (OLD.admin_granted_at IS DISTINCT FROM NEW.admin_granted_at) OR
         (OLD.admin_granted_by IS DISTINCT FROM NEW.admin_granted_by) THEN
        NEW.is_admin := OLD.is_admin;
        NEW.admin_granted_at := OLD.admin_granted_at;
        NEW.admin_granted_by := OLD.admin_granted_by;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Keep the existing BEFORE UPDATE trigger and add a BEFORE INSERT trigger
-- bound to the same function.
DROP TRIGGER IF EXISTS protect_admin_columns_insert_trigger ON public.profiles;
CREATE TRIGGER protect_admin_columns_insert_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_columns();

COMMENT ON FUNCTION public.protect_admin_columns() IS
  'Prevents non-service-role operations from setting (INSERT) or modifying (UPDATE) admin columns (is_admin, admin_granted_at, admin_granted_by) on profiles. Service role bypasses RLS and is permitted. Legitimate ADMIN_EMAILS provisioning uses the service-role client.';
