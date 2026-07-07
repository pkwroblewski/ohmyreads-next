-- Reading-progress storage on user_books.
-- The progress UI shipped without these columns ever existing; this backs
-- the updateReadingProgress action (feature-wireups plan, Task 2).

ALTER TABLE user_books
  ADD COLUMN IF NOT EXISTS current_page integer,
  ADD COLUMN IF NOT EXISTS total_pages integer,
  ADD COLUMN IF NOT EXISTS progress_percentage integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_books_current_page_check'
  ) THEN
    ALTER TABLE user_books
      ADD CONSTRAINT user_books_current_page_check
        CHECK (current_page IS NULL OR (current_page >= 0 AND current_page <= 50000));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_books_total_pages_check'
  ) THEN
    ALTER TABLE user_books
      ADD CONSTRAINT user_books_total_pages_check
        CHECK (total_pages IS NULL OR (total_pages > 0 AND total_pages <= 50000));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_books_progress_percentage_check'
  ) THEN
    ALTER TABLE user_books
      ADD CONSTRAINT user_books_progress_percentage_check
        CHECK (progress_percentage IS NULL OR (progress_percentage BETWEEN 0 AND 100));
  END IF;
END $$;
