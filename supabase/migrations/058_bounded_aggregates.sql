-- ============================================
-- Migration 058: Bounded aggregates (row-cap correctness)
--
-- A cluster of queries pulled whole tables into JS to compute an aggregate,
-- and PostgREST silently truncates at 1000 rows. Past that row the data
-- simply disappears -- these are correctness bugs, not just slow queries:
--
--   * lib/queries/authors.ts   -- both functions scan the entire books table
--   * lib/queries/messages.ts  -- getConversations fetches every message the
--     user has ever sent or received, then groups in JS, so old conversations
--     vanish and unread counts go wrong past 1000 messages
--   * lib/queries/recommendations.ts -- trending counts every review and shelf
--     add in the window
--   * lib/queries/admin-analytics.ts -- whole reviews table for an average,
--     whole books table for genre counts, 30 days of rows for daily growth
--
-- The author page is the worst of these: getAuthorBySlug selected * from
-- books with no filter and matched the slug in JS, which has already been
-- observed failing production builds (prerender of /authors/sally-thorne
-- exceeded the 60s budget after ECONNRESET).
--
-- Everything below is SECURITY INVOKER on purpose. These are read paths, and
-- an RLS-bypassing SECURITY DEFINER would silently undo migration 056 --
-- get_trending_activity in particular must keep excluding the shelf rows of
-- users who opted out of discovery.
-- ============================================

-- ============================================
-- 1. books.author_slug -- generated, indexed
--
-- createAuthorSlug() in lib/queries/authors.ts is a JS function, so there was
-- no way to filter by slug in SQL. This reproduces it exactly:
--
--   name.toLowerCase()
--       .replace(/[^a-z0-9\s-]/g, "")
--       .replace(/\s+/g, "-")
--       .replace(/-+/g, "-")
--       .trim()
--
-- Verified against all 389 distinct authors in production: 0 mismatches.
-- Note the JS .trim() only strips whitespace, and by that point whitespace is
-- already hyphens, so leading/trailing hyphens are deliberately NOT trimmed
-- here either -- doing so would change existing URLs.
-- ============================================

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS author_slug TEXT
  GENERATED ALWAYS AS (
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(author), '[^a-z0-9[:space:]-]', '', 'g'),
          '[[:space:]]+', '-', 'g'),
        '-+', '-', 'g'),
      E' \t\n\r\f\v')
  ) STORED;

CREATE INDEX IF NOT EXISTS books_author_slug_idx ON public.books(author_slug);

COMMENT ON COLUMN public.books.author_slug IS
  'Generated URL slug for the author, mirroring createAuthorSlug() in lib/queries/authors.ts. Used to resolve /authors/[slug] with an indexed equality filter instead of a full-table scan.';

-- ============================================
-- 2. get_author_summaries() -- replaces the full books scan in fetchAllAuthors
--
-- avg_rating is the same ratings-weighted mean the JS computed:
-- SUM(average_rating * ratings_count) / SUM(ratings_count), rounded to 1dp.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_author_summaries()
RETURNS TABLE (
  name TEXT,
  slug TEXT,
  book_count BIGINT,
  avg_rating NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- Two spellings can share a slug (production has "Agatha Christie" and
    -- "AGATHA CHRISTIE"). Pick the same one the detail page shows: the author
    -- of the most-rated book.
    (array_agg(b.author ORDER BY b.ratings_count DESC NULLS LAST))[1]::TEXT AS name,
    b.author_slug AS slug,
    COUNT(*) AS book_count,
    CASE
      WHEN COALESCE(SUM(b.ratings_count), 0) > 0
      THEN ROUND(
        (SUM(COALESCE(b.average_rating, 0) * COALESCE(b.ratings_count, 0))
         / SUM(b.ratings_count))::numeric, 1)
      ELSE NULL
    END AS avg_rating
  FROM public.books b
  WHERE b.author_slug IS NOT NULL AND b.author_slug <> ''
  GROUP BY b.author_slug
  ORDER BY COUNT(*) DESC;
$$;

-- ============================================
-- 3. get_conversations() -- replaces fetching every message into JS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_conversations()
RETURNS TABLE (
  friend_id UUID,
  friend_username TEXT,
  friend_display_name TEXT,
  friend_avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  friends AS (
    SELECT CASE WHEN fr.sender_id = me.uid THEN fr.receiver_id ELSE fr.sender_id END AS partner_id
    FROM public.friend_requests fr, me
    WHERE fr.status = 'accepted'
      AND (fr.sender_id = me.uid OR fr.receiver_id = me.uid)
  ),
  convo AS (
    SELECT
      CASE WHEN dm.sender_id = me.uid THEN dm.receiver_id ELSE dm.sender_id END AS partner_id,
      dm.content,
      dm.created_at,
      dm.read_at,
      dm.receiver_id
    FROM public.direct_messages dm, me
    WHERE dm.sender_id = me.uid OR dm.receiver_id = me.uid
  ),
  filtered AS (
    SELECT c.* FROM convo c
    WHERE c.partner_id IN (SELECT partner_id FROM friends)
  ),
  last_msg AS (
    SELECT DISTINCT ON (f.partner_id) f.partner_id, f.content, f.created_at
    FROM filtered f
    ORDER BY f.partner_id, f.created_at DESC
  ),
  unread AS (
    SELECT f.partner_id, COUNT(*) AS cnt
    FROM filtered f, me
    WHERE f.receiver_id = me.uid AND f.read_at IS NULL
    GROUP BY f.partner_id
  )
  SELECT
    p.id,
    COALESCE(p.username, '')::TEXT,
    p.display_name::TEXT,
    p.avatar_url::TEXT,
    lm.content::TEXT,
    lm.created_at,
    COALESCE(u.cnt, 0)
  FROM last_msg lm
  JOIN public.profiles p ON p.id = lm.partner_id
  LEFT JOIN unread u ON u.partner_id = lm.partner_id
  ORDER BY lm.created_at DESC;
$$;

-- ============================================
-- 4. get_trending_activity() -- replaces two unbounded windowed scans
--
-- SECURITY INVOKER matters here: user_books SELECT is gated on
-- discovery_visible (migration 056), and trending must keep respecting that.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_trending_activity(p_since TIMESTAMPTZ)
RETURNS TABLE (
  book_id UUID,
  review_count BIGINT,
  add_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH r AS (
    SELECT rv.book_id, COUNT(*) AS cnt
    FROM public.reviews rv
    WHERE rv.created_at >= p_since
    GROUP BY rv.book_id
  ),
  a AS (
    SELECT ub.book_id, COUNT(*) AS cnt
    FROM public.user_books ub
    WHERE ub.updated_at >= p_since
    GROUP BY ub.book_id
  )
  SELECT
    COALESCE(r.book_id, a.book_id) AS book_id,
    COALESCE(r.cnt, 0) AS review_count,
    COALESCE(a.cnt, 0) AS add_count
  FROM r
  FULL OUTER JOIN a ON a.book_id = r.book_id;
$$;

-- ============================================
-- 5. Admin analytics aggregates
--
-- Each re-checks admin itself rather than trusting the caller, and anon is
-- revoked below.
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_rating_distribution()
RETURNS TABLE (rating_value INT, rating_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.rating::INT, COUNT(*)
  FROM public.reviews r
  WHERE r.rating IS NOT NULL
  GROUP BY r.rating
  ORDER BY r.rating;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_genre_distribution(p_limit INT DEFAULT 15)
RETURNS TABLE (genre TEXT, genre_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT g::TEXT, COUNT(*)
  FROM public.books b, unnest(b.genres) AS g
  WHERE b.genres IS NOT NULL
  GROUP BY g
  -- Deterministic tiebreak: production has two genres tied at 100, and an
  -- unstable ORDER BY made the admin chart reshuffle between loads.
  ORDER BY COUNT(*) DESC, g
  LIMIT GREATEST(p_limit, 1);
END;
$$;

-- Daily buckets use the UTC date, matching the JS the app used
-- (`new Date(created_at).toISOString().split("T")[0]`).
CREATE OR REPLACE FUNCTION public.admin_growth_daily(p_since TIMESTAMPTZ)
RETURNS TABLE (day DATE, user_count BIGINT, review_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH u AS (
    SELECT (pr.created_at AT TIME ZONE 'UTC')::DATE AS d, COUNT(*) AS cnt
    FROM public.profiles pr
    WHERE pr.created_at >= p_since
    GROUP BY 1
  ),
  rv AS (
    SELECT (r.created_at AT TIME ZONE 'UTC')::DATE AS d, COUNT(*) AS cnt
    FROM public.reviews r
    WHERE r.created_at >= p_since
    GROUP BY 1
  )
  SELECT
    COALESCE(u.d, rv.d) AS day,
    COALESCE(u.cnt, 0) AS user_count,
    COALESCE(rv.cnt, 0) AS review_count
  FROM u
  FULL OUTER JOIN rv ON rv.d = u.d
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rating_distribution() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_genre_distribution(INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_growth_daily(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rating_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_genre_distribution(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_growth_daily(TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.get_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;
