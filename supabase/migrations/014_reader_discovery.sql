-- ============================================
-- Phase 5: Reader Discovery
-- ============================================
-- Adds text search indexes for user discovery
-- ============================================

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text search indexes for profile username and display_name
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON public.profiles USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING GIN (display_name gin_trgm_ops);

-- Index for faster user_books queries (user + book combination)
CREATE INDEX IF NOT EXISTS user_books_user_book_idx
  ON public.user_books(user_id, book_id);

-- Index for faster review queries by user
CREATE INDEX IF NOT EXISTS reviews_user_id_idx
  ON public.reviews(user_id);
