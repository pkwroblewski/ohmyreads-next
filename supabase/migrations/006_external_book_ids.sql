-- =============================================
-- External Book IDs for improved covers + metadata
-- =============================================

-- Add external ID columns to books table
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS open_library_id TEXT,
  ADD COLUMN IF NOT EXISTS open_library_cover_id INTEGER,
  ADD COLUMN IF NOT EXISTS cover_source TEXT CHECK (cover_source IN ('google', 'openlibrary', 'user', 'other'));

-- Add external ID columns to book_submissions table
ALTER TABLE public.book_submissions
  ADD COLUMN IF NOT EXISTS open_library_id TEXT,
  ADD COLUMN IF NOT EXISTS open_library_cover_id INTEGER,
  ADD COLUMN IF NOT EXISTS cover_source TEXT CHECK (cover_source IN ('google', 'openlibrary', 'user', 'other'));

-- Create index for deduplication by Open Library ID
CREATE INDEX IF NOT EXISTS books_open_library_id_idx ON public.books (open_library_id) WHERE open_library_id IS NOT NULL;

-- Create index for deduplication by Google Books ID (already exists google_books_id column)
CREATE INDEX IF NOT EXISTS books_google_books_id_idx ON public.books (google_books_id) WHERE google_books_id IS NOT NULL;

-- Create index for deduplication by ISBN
CREATE INDEX IF NOT EXISTS books_isbn_idx ON public.books (isbn) WHERE isbn IS NOT NULL;

