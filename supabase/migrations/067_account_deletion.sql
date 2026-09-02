-- 067: Account deletion (Phase 2, Task 11)
--
-- `auth.admin.deleteUser()` cascades from auth.users into profiles and from
-- there into everything a reader owns. Two references stood in the way of
-- the promise the privacy page makes:
--
--   * reports.reporter_id cascaded, which would erase a report the moment
--     the reporter left. Moderation history must survive the reporter, so the
--     row now stays and the reporter becomes NULL (the admin queue already
--     renders a missing reporter as "Unknown").
--   * book_submissions.moderated_by had no ON DELETE clause (NO ACTION), so
--     deleting an account that had ever moderated a submission would fail
--     with a foreign-key error. It now sets NULL like place_submissions does.
--
-- Everything else already cascades or sets NULL (inventoried 2026-09-02 from
-- pg_constraint: 44 FKs to profiles / auth.users). audit_logs.user_id already
-- sets NULL, so the `user.delete_account` row written before deletion remains.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.reports
  ALTER COLUMN reporter_id DROP NOT NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.book_submissions
  DROP CONSTRAINT IF EXISTS book_submissions_moderated_by_fkey;

ALTER TABLE public.book_submissions
  ADD CONSTRAINT book_submissions_moderated_by_fkey
  FOREIGN KEY (moderated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.reports.reporter_id IS
  'NULL once the reporter deleted their account; the report itself is kept for moderation history.';

-- Found by the live deletion check: deleting auth.users cascades into
-- user_books and reviews, whose statement-level triggers call
-- sync_reading_stats() for the departed user. The upsert into reading_stats
-- then fails its FK to auth.users (23503) and the whole deletion rolls back.
-- Nothing needs stats for an account that no longer exists, so skip those.
CREATE OR REPLACE FUNCTION public.sync_reading_stats(p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    CONTINUE WHEN v_user_id IS NULL;
    -- Mid-deletion (or already gone): the row would violate the FK.
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id);

    -- Lock an existing stats row before reading the source tables.
    PERFORM 1 FROM public.reading_stats WHERE user_id = v_user_id FOR UPDATE;

    INSERT INTO public.reading_stats AS rs (
      user_id, books_read, pages_read, reviews_count, updated_at
    )
    SELECT
      v_user_id,
      COUNT(*) FILTER (WHERE ub.status = 'read'),
      COALESCE(SUM(b.page_count) FILTER (WHERE ub.status = 'read'), 0),
      (SELECT COUNT(*) FROM public.reviews r WHERE r.user_id = v_user_id),
      NOW()
    FROM public.user_books ub
    LEFT JOIN public.books b ON b.id = ub.book_id
    WHERE ub.user_id = v_user_id
    ON CONFLICT (user_id) DO UPDATE
    SET books_read    = EXCLUDED.books_read,
        pages_read    = EXCLUDED.pages_read,
        reviews_count = EXCLUDED.reviews_count,
        updated_at    = EXCLUDED.updated_at;
  END LOOP;
END;
$$;
