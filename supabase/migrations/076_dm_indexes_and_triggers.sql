-- 076: DM indexes and triggers, place-review freeze, disabled users' feed
-- (full audit 2026-09-24, Task 18; schema review C1, C2, C4, C7)
--
-- Every definition below was re-derived from the LIVE database
-- (pg_indexes / pg_get_functiondef / pg_policies on 2026-09-25).
--
--   C1  dm_conversation_idx is on LEAST/GREATEST(sender, receiver), which no
--       query uses (getMessages filters two sender/receiver pairs). Replaced
--       by (sender_id, receiver_id, created_at DESC), which also makes the
--       single-column dm_sender_idx redundant (dropped). Unread lookups
--       (receiver_id = me AND read_at IS NULL) get a partial index.
--   C2  The DM freeze ran on UPDATE only, so API inserts could backdate
--       created_at or arrive with read_at already set (the counter then went
--       up and never came down). The receiver could also reset read_at to
--       NULL and re-read, decrementing twice. The unread counter had no
--       DELETE branch, so a sender deleting an unread message left the
--       receiver's badge stuck. With the counter now exact per row,
--       markMessagesAsRead drops its count-then-write reconcile, which lost
--       a message that arrived between the count and the write.
--   C4  place_reviews UPDATE could move a review to another place; the rating
--       trigger only recomputes NEW.place_id, leaving the old place's
--       average and count stale. place_id/user_id are frozen for API roles.
--   C7  Disabled users' activity_feed rows stayed public (066 hid their
--       reviews, comments and lists). Same visibility rule as 066 now.
--
-- Live checks before applying: 0 profiles with unread_messages_count drift,
-- 16 DMs, 10 feed rows, 0 disabled users.

BEGIN;

-- ---------------------------------------------------------------------------
-- C1: DM indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.dm_conversation_idx;
DROP INDEX IF EXISTS public.dm_sender_idx;

CREATE INDEX IF NOT EXISTS dm_pair_created_at_idx
  ON public.direct_messages (sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dm_unread_receiver_idx
  ON public.direct_messages (receiver_id)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- C2: DM freeze on INSERT and UPDATE (SECURITY INVOKER, see 064)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.freeze_direct_message_immutables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_at := now();
      NEW.read_at := NULL;
    ELSE
      NEW.content := OLD.content;
      NEW.sender_id := OLD.sender_id;
      NEW.receiver_id := OLD.receiver_id;
      NEW.created_at := OLD.created_at;
      -- read_at only moves NULL -> now(); it can't be reset or rewritten
      IF OLD.read_at IS NOT NULL THEN
        NEW.read_at := OLD.read_at;
      ELSIF NEW.read_at IS NOT NULL THEN
        NEW.read_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS direct_messages_freeze_immutables ON public.direct_messages;
CREATE TRIGGER direct_messages_freeze_immutables
  BEFORE INSERT OR UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.freeze_direct_message_immutables();

-- Unread counter: every transition of an unread row, floored at zero
CREATE OR REPLACE FUNCTION public.update_unread_messages_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta integer := 0;
  target uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := NEW.receiver_id;
    IF NEW.read_at IS NULL THEN delta := 1; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    target := NEW.receiver_id;
    IF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
      delta := -1;
    ELSIF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
      delta := 1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    target := OLD.receiver_id;
    IF OLD.read_at IS NULL THEN delta := -1; END IF;
  END IF;

  IF delta <> 0 THEN
    UPDATE public.profiles
    SET unread_messages_count = GREATEST(COALESCE(unread_messages_count, 0) + delta, 0)
    WHERE id = target;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_direct_message_delete ON public.direct_messages;
CREATE TRIGGER on_direct_message_delete
  AFTER DELETE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_unread_messages_count();

-- ---------------------------------------------------------------------------
-- C4: place_reviews can't move to another place or user (SECURITY INVOKER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.freeze_place_review_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_api_role() THEN
    NEW.place_id := OLD.place_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS place_reviews_freeze_columns ON public.place_reviews;
CREATE TRIGGER place_reviews_freeze_columns
  BEFORE UPDATE ON public.place_reviews
  FOR EACH ROW EXECUTE FUNCTION public.freeze_place_review_columns();

-- ---------------------------------------------------------------------------
-- C7: hide disabled authors' feed rows from everyone but them and admins
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Activity feed is publicly readable" ON public.activity_feed;
DROP POLICY IF EXISTS "Activity feed visible unless author disabled" ON public.activity_feed;
CREATE POLICY "Activity feed visible unless author disabled"
ON public.activity_feed FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = activity_feed.user_id AND p.disabled_at IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_admin = true
  )
);

-- ---------------------------------------------------------------------------
-- Trigger functions are not callable over the API (064 section 9)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.freeze_direct_message_immutables() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_unread_messages_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_place_review_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_direct_message_immutables() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_unread_messages_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.freeze_place_review_columns() TO service_role;

COMMIT;
