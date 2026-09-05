-- ============================================
-- Migration 070: strip Open Library wiki markup from imported blurbs
--
-- UX fixes plan (2026-09-04) task 12, found on the production walk. The
-- descriptions task 10 pulled from Open Library's works endpoint are wiki
-- text: a "---" rule introduces "also published as" boilerplate, links are
-- markdown, "[source](…)" / "[**PDF**](…)" links are noise, and "**" marks
-- bold. The helper (`getOpenLibraryDescription`) now strips all of that on
-- the way in; this cleans the 8 rows written before it did. Data only,
-- idempotent — the final SELECT is 0 when nothing is left to clean.
--
-- Usage:
--   npx supabase db query --linked -f supabase/migrations/070_clean_ol_descriptions.sql
-- ============================================

UPDATE public.books
SET description = btrim(replace(regexp_replace(regexp_replace(regexp_replace(
      split_part(description, E'\n---', 1),
      '\(?\[[^\]]*(source|pdf)[^\]]*\]\([^)]*\)\)?', '', 'gi'),   -- drop source / pdf links outright
      '\[([^\]]+)\]\([^)]*\)', '\1', 'g'),                         -- other links keep their label
      '\(?\s*source:?\s*\)?\s*$', '', 'i'),                        -- a trailing bare "Source"
      '**', ''))
WHERE description ~ '\]\(https?://'
   OR description ~ E'\n---'
   OR description ~ '\*\*';

SELECT count(*) AS residue_rows
FROM public.books
WHERE description ~ '\]\(https?://'
   OR description ~ E'\n---'
   OR description ~ '\*\*';
