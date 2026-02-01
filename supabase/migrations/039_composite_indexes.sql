-- ============================================
-- 039: Composite Database Indexes
-- ============================================
-- Performance optimization for common query patterns
-- Source: Code review audit 2026-02-01
-- ============================================

-- ============================================
-- 1. User Books Composite Index
-- ============================================
-- Optimizes shelf queries that:
-- - Filter by user_id (always)
-- - Filter by status (want_to_read, reading, read)
-- - Order by updated_at DESC (most recent first)
--
-- Example query pattern:
-- SELECT * FROM user_books
-- WHERE user_id = ? AND status = ?
-- ORDER BY updated_at DESC
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_books_user_status_updated
ON public.user_books (user_id, status, updated_at DESC);

-- ============================================
-- 2. Reviews User-Book Composite Index
-- ============================================
-- Note: UNIQUE(user_id, book_id) constraint already exists in reviews table
-- which creates an implicit unique index. This is sufficient for lookups.
-- No additional index needed.
-- ============================================

-- ============================================
-- 3. Activity Feed Index
-- ============================================
-- Note: activity_feed already has comprehensive indexes from migration 005:
-- - (created_at DESC, id DESC) - for global feed pagination
-- - (user_id, created_at DESC) - for user-specific feeds
-- - (type, created_at DESC) - for type-filtered feeds
-- Plus idx_activity_feed_user_id from migration 029
-- No additional indexes needed.
-- ============================================

-- ============================================
-- 4. Profiles Location Geohash Index
-- ============================================
-- Note: Partial index already exists from migration 007:
-- idx_profiles_location_geohash (location_geohash)
-- WHERE location_enabled = true AND location_geohash IS NOT NULL
-- This is optimal for the use case.
-- No additional index needed.
-- ============================================
