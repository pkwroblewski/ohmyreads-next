-- Migration 062: User reporting for user-generated content
--
-- The platform carries reviews, comments, place photos, DMs, clubs and lists,
-- and had no way for a reader to flag any of it: moderation was
-- proactive-browse only. `lib/utils/audit-log.ts` already declared
-- `moderation.*` actions with nothing implementing them.
--
-- One generic table rather than one per content type. `target_type` +
-- `target_id` deliberately carry no foreign key: a single column cannot
-- reference three tables, and per-type nullable FKs would trade one problem for
-- five. The cost is that a report can outlive its target, which the admin queue
-- handles by rendering "content no longer exists" rather than hiding the row —
-- a report whose content vanished is still evidence about the reporter and the
-- author.

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References profiles, not auth.users. Every other user column in this schema
  -- does the same (`reviews_user_profile_fkey`, `place_photos_user_id_fkey`,
  -- `book_submissions_submitted_by_profiles_fkey`) because PostgREST can only
  -- embed across a declared FK, and the queue needs the reporter's username.
  -- `profiles_id_fkey` cascades from auth.users, so account deletion still
  -- reaches this table.
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  target_type TEXT NOT NULL
    CHECK (target_type IN ('review', 'comment', 'place_photo')),
  target_id UUID NOT NULL,

  reason TEXT NOT NULL
    CHECK (reason IN (
      'spam',
      'harassment',
      'hate',
      'sexual_content',
      'violence',
      'misinformation',
      'off_topic',
      'other'
    )),

  -- Free text is bounded here as well as in Zod, so a direct PostgREST call
  -- cannot store more than the form allows (same approach as migration 059).
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),

  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
    CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One report per person per item. This is the de-duplication: a second
  -- attempt raises 23505, which the action turns into "you already reported
  -- this" without a read-then-write race.
  CONSTRAINT reports_one_per_reporter_per_target
    UNIQUE (reporter_id, target_type, target_id)
);

-- The queue reads open reports newest-first. PostgREST's bare
-- `order(..., { ascending: false })` emits DESC NULLS FIRST, which is what a
-- plain `DESC` index provides — task 19's lesson: a btree only satisfies a sort
-- whose NULLS ordering matches.
CREATE INDEX IF NOT EXISTS reports_status_created_at_idx
  ON public.reports (status, created_at DESC);

-- "How many people reported this item?" — the UNIQUE index above leads with
-- reporter_id and cannot answer it.
CREATE INDEX IF NOT EXISTS reports_target_idx
  ON public.reports (target_type, target_id);

-- ============================================
-- Reporters must not be able to file a pre-resolved report
--
-- The INSERT policy below can only constrain `reporter_id`; without this, a
-- direct PostgREST call could insert `status = 'dismissed'` and hide the report
-- from the queue it was meant to enter.
-- ============================================

CREATE OR REPLACE FUNCTION public.force_new_report_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.status := 'open';
  NEW.resolved_by := NULL;
  NEW.resolved_at := NULL;
  NEW.resolution_note := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_force_open ON public.reports;
CREATE TRIGGER reports_force_open
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.force_new_report_open();

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may report, but only as themselves.
DROP POLICY IF EXISTS "Users can file their own reports" ON public.reports;
CREATE POLICY "Users can file their own reports"
ON public.reports FOR INSERT
WITH CHECK ((SELECT auth.uid()) = reporter_id);

-- A reporter can see what they filed, and nothing else. This is what keeps one
-- reader from enumerating what others have flagged.
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
ON public.reports FOR SELECT
USING ((SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports"
ON public.reports FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can resolve reports" ON public.reports;
CREATE POLICY "Admins can resolve reports"
ON public.reports FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  )
);

-- No DELETE policy on purpose. A report is a moderation record; it is closed by
-- resolving or dismissing it, never by removing the evidence.
