-- Replace JS-side genre deduplication with SQL aggregation
-- Previously: fetched all books.genres then flatMap + Set in JavaScript
-- Now: SQL UNNEST + DISTINCT returns only unique genre strings

CREATE OR REPLACE FUNCTION get_distinct_genres()
RETURNS TABLE(genre text)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT UNNEST(genres) AS genre
  FROM books
  WHERE genres IS NOT NULL
  ORDER BY genre;
$$;
