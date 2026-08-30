-- Migration: bring the untracked event tables into version control.
--
-- `book_events` and `book_events_summaries` exist in the live database and in
-- `types/database.generated.ts`, and are read by `lib/queries/events.ts`, but
-- they were created outside `supabase/migrations/` — so a fresh environment
-- built from this directory has no events tables, no RLS on them, and no
-- indexes. This file reproduces the live definitions exactly.
--
-- Everything below is idempotent and was written from a live introspection
-- (`information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_policies`,
-- `pg_trigger`) on 2026-08-29, including the auto-generated constraint and
-- index names, so applying it to production is a no-op.
--
-- Note on `reading_progress_history`: earlier notes listed it as a third
-- untracked table. It does not exist — not in the live database, not in the
-- generated types, and not referenced anywhere in the codebase. Reading
-- progress lives on `user_books` (migration 050). Nothing to back.

-- =============================================
-- book_events
-- =============================================
CREATE TABLE IF NOT EXISTS public.book_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL CONSTRAINT book_events_event_type_check
    CHECK (event_type = ANY (ARRAY['signing', 'reading', 'festival', 'club', 'workshop', 'other'])),
  venue_name text NOT NULL,
  venue_address text,
  city text,
  country text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  geohash text,
  start_date date NOT NULL,
  start_time time without time zone,
  end_date date,
  url text,
  image_url text,
  source text DEFAULT 'manual' CONSTRAINT book_events_source_check
    CHECK (source = ANY (ARRAY['manual', 'ai_scan', 'api'])),
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_events_geohash ON public.book_events (geohash);
CREATE INDEX IF NOT EXISTS idx_book_events_start_date ON public.book_events (start_date);
CREATE INDEX IF NOT EXISTS idx_book_events_city ON public.book_events (city);

ALTER TABLE public.book_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- book_events_summaries (weekly AI digest per region)
-- =============================================
CREATE TABLE IF NOT EXISTS public.book_events_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geohash_prefix text NOT NULL,
  week_start date NOT NULL,
  summary text NOT NULL,
  event_count integer DEFAULT 0,
  generated_at timestamptz DEFAULT now(),
  CONSTRAINT book_events_summaries_geohash_prefix_week_start_key
    UNIQUE (geohash_prefix, week_start)
);

CREATE INDEX IF NOT EXISTS idx_book_events_summaries_prefix
  ON public.book_events_summaries (geohash_prefix);

ALTER TABLE public.book_events_summaries ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Policies
--
-- Both tables are public read / service-role write: events are curated
-- content, not user-generated, and `lib/queries/events.ts` reads them through
-- the anon client on the public map. Guarded rather than DROP/CREATEd so a
-- re-run against production changes nothing.
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'book_events'
      AND policyname = 'Anyone can read events'
  ) THEN
    CREATE POLICY "Anyone can read events" ON public.book_events
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'book_events'
      AND policyname = 'Service role can manage events'
  ) THEN
    CREATE POLICY "Service role can manage events" ON public.book_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'book_events_summaries'
      AND policyname = 'Anyone can read summaries'
  ) THEN
    CREATE POLICY "Anyone can read summaries" ON public.book_events_summaries
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'book_events_summaries'
      AND policyname = 'Service role can manage summaries'
  ) THEN
    CREATE POLICY "Service role can manage summaries" ON public.book_events_summaries
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================
-- updated_at trigger (function from 001_initial_schema.sql)
-- =============================================
DROP TRIGGER IF EXISTS update_book_events_updated_at ON public.book_events;
CREATE TRIGGER update_book_events_updated_at
  BEFORE UPDATE ON public.book_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
