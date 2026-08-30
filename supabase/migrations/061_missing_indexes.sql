-- Migration 061: Add missing indexes on hot read paths
--
-- Findings (Aug 2026 platform review, task 19):
--   * `comments` had NO index other than its primary key, yet every review page
--     filters by review_id and orders by created_at.
--   * `activity_feed` FK columns (book_id/review_id/place_id/checkin_id) were
--     unindexed, so deleting a book/review/place/checkin forces a seq scan for
--     the referential-integrity check.
--   * No btree backing the `ORDER BY ... DESC` sorts used across discovery,
--     recommendations and community (books.ratings_count / books.average_rating /
--     books.created_at / reviews.likes_count / profiles.followers_count /
--     user_books.created_at).
--
-- NULLS ordering is chosen per column to match the ORDER BY the app actually
-- emits: a btree index only satisfies a sort whose NULLS FIRST/LAST matches.
--   ratings_count / average_rating -> DESC NULLS LAST (PostgREST nullsFirst:false)
--   followers_count / likes_count  -> DESC (NULLS FIRST, PostgREST default)
--
-- CREATE INDEX CONCURRENTLY is not used: the migration is applied through a
-- transaction-wrapped query path, and every table here is small enough that the
-- brief ACCESS EXCLUSIVE lock is sub-millisecond.

-- comments: no index at all before this migration
CREATE INDEX IF NOT EXISTS comments_review_id_created_at_idx
  ON public.comments (review_id, created_at);
CREATE INDEX IF NOT EXISTS comments_parent_id_idx
  ON public.comments (parent_id)
  WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_user_id_idx
  ON public.comments (user_id);

-- activity_feed: unindexed foreign keys (cascade/RI checks on parent delete)
CREATE INDEX IF NOT EXISTS activity_feed_book_id_idx
  ON public.activity_feed (book_id)
  WHERE book_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_feed_review_id_idx
  ON public.activity_feed (review_id)
  WHERE review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_feed_place_id_idx
  ON public.activity_feed (place_id)
  WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_feed_checkin_id_idx
  ON public.activity_feed (checkin_id)
  WHERE checkin_id IS NOT NULL;

-- books: popularity / recency sorts
CREATE INDEX IF NOT EXISTS books_ratings_count_desc_idx
  ON public.books (ratings_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS books_average_rating_desc_idx
  ON public.books (average_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS books_created_at_desc_idx
  ON public.books (created_at DESC);

-- reviews: "most helpful" sort
CREATE INDEX IF NOT EXISTS reviews_likes_count_desc_idx
  ON public.reviews (likes_count DESC);

-- profiles: discovery sorts on follower count
CREATE INDEX IF NOT EXISTS profiles_followers_count_desc_idx
  ON public.profiles (followers_count DESC);

-- user_books: recently-added shelf items
CREATE INDEX IF NOT EXISTS user_books_created_at_desc_idx
  ON public.user_books (created_at DESC);
