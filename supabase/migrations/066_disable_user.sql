-- ============================================
-- Migration 066: disable user (phase-2 plan, Task 7)
--
-- profiles.disabled_at exists since 064 and is readable by the API roles
-- since 065. Until now nothing enforced it. This migration makes it mean
-- something at the database:
--
--   1. protect_admin_columns() also freezes disabled_at for every JWT role
--      except service_role. The owner UPDATE policy plus the table-level
--      UPDATE grant would otherwise let a disabled account with a still-valid
--      session clear the flag through PostgREST. The admin actions write it
--      through the service-role client, exactly like is_admin.
--
--   2. The public SELECT policies on reviews, comments and reading_lists hide
--      rows whose author is disabled. The author still sees their own rows
--      (so re-enabling restores everything untouched) and admins see all of
--      them (the moderation pages read through the session client).
--      Cost: one primary-key lookup on profiles per candidate row, the same
--      shape 064 uses for the admin policies. With the current data (single
--      digit thousands of rows at most) EXPLAIN shows sub-millisecond plans.
--
-- Every section is idempotent so the file can be re-run.
-- ============================================

-- --------------------------------------------
-- 1. Freeze disabled_at for non-service roles
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_admin_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role can modify admin columns.
  -- auth.jwt() ->> 'role' reads from request-scoped JWT claims (reliable with
  -- connection pooling). No JWT (direct DB connection) also protects them.
  IF COALESCE(auth.jwt() ->> 'role', '') != 'service_role' THEN
    IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
       (OLD.admin_granted_at IS DISTINCT FROM NEW.admin_granted_at) OR
       (OLD.admin_granted_by IS DISTINCT FROM NEW.admin_granted_by) OR
       (OLD.disabled_at IS DISTINCT FROM NEW.disabled_at) THEN
      -- Silently revert to the previous values
      NEW.is_admin := OLD.is_admin;
      NEW.admin_granted_at := OLD.admin_granted_at;
      NEW.admin_granted_by := OLD.admin_granted_by;
      NEW.disabled_at := OLD.disabled_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.protect_admin_columns() IS
  'Prevents non-service-role operations from modifying admin columns (is_admin, admin_granted_at, admin_granted_by) and disabled_at on profiles. Uses auth.jwt() for reliable role detection with connection pooling.';

-- --------------------------------------------
-- 2. Hide content of disabled authors from everyone but the author and admins
-- --------------------------------------------
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Reviews visible unless author disabled" ON public.reviews;
CREATE POLICY "Reviews visible unless author disabled"
ON public.reviews FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = reviews.user_id AND p.disabled_at IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Comments visible unless author disabled" ON public.comments;
CREATE POLICY "Comments visible unless author disabled"
ON public.comments FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = comments.user_id AND p.disabled_at IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Anyone can view public lists" ON public.reading_lists;
DROP POLICY IF EXISTS "Public lists visible unless author disabled" ON public.reading_lists;
CREATE POLICY "Public lists visible unless author disabled"
ON public.reading_lists FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR (
    visibility = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = reading_lists.user_id AND p.disabled_at IS NOT NULL
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);
