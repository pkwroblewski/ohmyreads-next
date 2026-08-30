-- ============================================
-- Migration 060: Batched reader taste data (kills the discover N+1)
--
-- lib/queries/discover.ts called getCachedReaderTasteData() once per candidate
-- profile inside a loop (getRecommendedReaders) and inside a Promise.all
-- (browseReaders). Each call ran two queries, so a single /discover render
-- issued up to 2 x 40 = 80 round trips just to score compatibility.
--
-- Aggregating in SQL turns that into one call. It also removes a latent
-- row-cap bug: batching the same work as two PostgREST selects with
-- .in("user_id", ids) would silently truncate at 1000 rows across all
-- candidates, dropping books from whoever sorted last.
--
-- SECURITY INVOKER, like the aggregates in migration 058: user_books SELECT is
-- gated on profiles.discovery_visible (migration 056) and this function must
-- keep respecting that. The cached caller reads as anon, which is exactly what
-- the per-user cached path already did.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_reader_taste_batch(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  book_ids UUID[],
  genres TEXT[],
  vibes TEXT[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ids AS (
    SELECT DISTINCT u AS uid
    FROM unnest(p_user_ids) AS u
    WHERE u IS NOT NULL
  ),
  bk AS (
    SELECT ub.user_id AS uid, array_agg(DISTINCT ub.book_id) AS book_ids
    FROM public.user_books ub
    JOIN ids ON ids.uid = ub.user_id
    WHERE ub.status IN ('read', 'reading')
    GROUP BY ub.user_id
  ),
  gn AS (
    SELECT ub.user_id AS uid, array_agg(DISTINCT g) AS genres
    FROM public.user_books ub
    JOIN ids ON ids.uid = ub.user_id
    JOIN public.books b ON b.id = ub.book_id
    CROSS JOIN LATERAL unnest(b.genres) AS g
    WHERE ub.status IN ('read', 'reading')
    GROUP BY ub.user_id
  ),
  vb AS (
    SELECT r.user_id AS uid, array_agg(DISTINCT v) AS vibes
    FROM public.reviews r
    JOIN ids ON ids.uid = r.user_id
    CROSS JOIN LATERAL unnest(r.vibe_tags) AS v
    GROUP BY r.user_id
  )
  -- Every requested id comes back, so a candidate with no visible rows scores
  -- as an empty taste profile rather than going missing from the result.
  SELECT
    ids.uid,
    COALESCE(bk.book_ids, '{}'::UUID[]),
    COALESCE(gn.genres, '{}'::TEXT[]),
    COALESCE(vb.vibes, '{}'::TEXT[])
  FROM ids
  LEFT JOIN bk ON bk.uid = ids.uid
  LEFT JOIN gn ON gn.uid = ids.uid
  LEFT JOIN vb ON vb.uid = ids.uid;
$$;

COMMENT ON FUNCTION public.get_reader_taste_batch(UUID[]) IS
  'Taste profile (shelved book ids, genres, review vibe tags) for a set of readers in one round trip. Backs the compatibility scoring in lib/queries/discover.ts. SECURITY INVOKER so discovery_visible gating still applies.';

-- Readable by anon on purpose: the cached discover path uses the public client
-- because unstable_cache forbids cookies. RLS still decides what it sees.
GRANT EXECUTE ON FUNCTION public.get_reader_taste_batch(UUID[]) TO anon, authenticated;
