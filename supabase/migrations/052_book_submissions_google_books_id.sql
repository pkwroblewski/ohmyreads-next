-- book_submissions was missing google_books_id, which BOTH the submitBook
-- insert (lib/actions/book-submissions.ts) and the approve_book_submission
-- function (migration 019) reference — every submission failed at INSERT and
-- any pending row would have failed at approval. Found during navigation-ia
-- plan QA, 2026-07-07.

ALTER TABLE book_submissions ADD COLUMN IF NOT EXISTS google_books_id text;
