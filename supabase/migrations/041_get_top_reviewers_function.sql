-- Migration: Add get_top_reviewers function for efficient SQL aggregation
-- Replaces JavaScript-side aggregation in getCommunitySidebar

-- Function to get top reviewers with review counts
-- Returns user profiles with their total review count, ordered by count desc
CREATE OR REPLACE FUNCTION public.get_top_reviewers(limit_count INT DEFAULT 5)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  review_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COUNT(r.id) AS review_count
  FROM public.reviews r
  INNER JOIN public.profiles p ON r.user_id = p.id
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  ORDER BY review_count DESC
  LIMIT limit_count;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_top_reviewers(INT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_reviewers(INT) TO authenticated;

COMMENT ON FUNCTION public.get_top_reviewers IS 'Returns top reviewers by review count for community sidebar';
