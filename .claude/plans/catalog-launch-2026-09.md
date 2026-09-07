# OhMyReads - Launch Catalog: ~5,000 Books with Sharp, Self-Hosted Covers

> **Workflow:**
> 1. Read this file
> 2. Find first PENDING task
> 3. Execute all steps (check off as you go)
> 4. Complete all verify checks
> 5. Fill in "Completed Notes" section
> 6. Change status from `[ ] PENDING` to `[x] COMPLETE`
> 7. Update progress counter in Status table
> 8. User runs `/clear` to reset context
> 9. Repeat from step 1

---

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 0 | Preflight: scripts reach DB, API keys, `book-covers` bucket | 🔴 Critical | Low | [x] COMPLETE | `supabase/migrations/071_book_covers_bucket.sql`, `.env.example` |
| 1 | Cover pipeline library (fetch, score, pick, store) | 🔴 Critical | Medium | [x] COMPLETE | `lib/covers/pipeline.ts`, `__tests__/lib/covers/pipeline.test.ts`, `package.json` |
| 2 | Render from stored covers | 🔴 Critical | Low | [x] COMPLETE | `lib/utils/covers.ts`, `lib/config/image-hosts.ts`, `lib/covers/pipeline.ts`, `__tests__/lib/config/image-hosts.test.ts`, `__tests__/lib/utils/covers.test.ts` |
| 3 | Backfill covers for the existing catalog | 🟠 High | Medium | [x] COMPLETE | `scripts/process-covers.ts`, `package.json`, `lib/covers/pipeline.ts`, `__tests__/lib/covers/pipeline.test.ts` |
| 4 | NYT bestseller import | 🟠 High | Medium | [x] COMPLETE | `lib/import/nyt.ts`, `lib/import/insert-book.ts`, `scripts/import-nyt-bestsellers.ts`, `lib/actions/books.ts`, `lib/utils/external-book-search.ts`, `__tests__/lib/import/nyt.test.ts`, `package.json` |
| 5 | Popular-per-genre + award winners import | 🟠 High | Medium | [x] COMPLETE | `scripts/lib/import-core.ts`, `scripts/lib/ol-search.ts`, `scripts/import-popular-subjects.ts`, `scripts/import-award-winners.ts`, `scripts/import-nyt-bestsellers.ts`, `scripts/archive/README.md`, `package.json` |
| 6 | Ratings and metadata gaps for new rows | 🟡 Medium | Low | [x] COMPLETE | `scripts/import-ratings.ts`, `scripts/enrich-books.ts` |
| 7 | Search-to-add runs the cover pipeline | 🟡 Medium | Low | [x] COMPLETE | `lib/actions/books.ts`, `lib/covers/pipeline.ts`, `__tests__/lib/actions/books.test.ts`, `__tests__/lib/covers/pipeline.test.ts` |
| 8 | Genre vocabulary clean-up (Browse chips) | 🟠 High | Medium | [x] COMPLETE | `lib/data/genres.ts`, `supabase/migrations/072_genre_vocabulary.sql`, `lib/validation/search.ts`, `lib/actions/books.ts`, `lib/import/nyt.ts`, `lib/ai/prompts.ts`, `scripts/lib/import-core.ts`, `scripts/enrich-books.ts`, `__tests__/lib/data/genres.test.ts`, `__tests__/lib/validation/search.test.ts` |
| 9 | Final QA | - | Low | [x] COMPLETE | `.claude/plans/catalog-launch-2026-09.md` |

**Progress: 10/10 complete — PLAN FINISHED 2026-09-07**

> **Plan finished 2026-09-07.** Everything is committed and deployed: `09660c2` (Tasks 0–8, 34 files) and the closing docs commit; production deployment `dpl_9M3uFek5Rnn9fKp1xKy9FLVgvuvt` READY at 06:47 UTC, `ohmyreads-next.vercel.app` re-checked. Live numbers: 5,568 books, 5,191 stored covers (93.2 %), 0 duplicates, 416 titles published since 2024, 90.9 % rated, 51 genre strings, bucket 179 MB / 5,191 objects. **Recommended next task:** the Open Library original-size cover pass (see Out of Scope, first row) — it is the one thing that would make the Browse grid crisp on Retina screens.

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

The catalog has 699 books (6 published since 2024) and covers are chosen in the browser by a fallback chain that never checks pixel size, so cards are inconsistently blurry or show the wrong edition. This plan (a) adds a server-side cover pipeline that downloads every candidate, rejects the Google grey placeholder by hash and anything under 300 px, keeps the sharpest, and stores one JPEG per book in a public Supabase Storage bucket; (b) imports ~4,300 more titles from NYT bestseller snapshots (2016→today, current-edition ISBN-13), Open Library most-read works per genre, and the archived award-winners script, deduplicated on ISBN then normalised title+author; (c) makes the search-to-add path run the same pipeline so user-added books also arrive sharp. Outcome: ~5,000 recognisable, deduplicated books with one verified cover each at launch.

Decisions taken 2026-09-05 (user): 5k curated over 20k broad; NYT + Open Library as popularity source; covers copied into Storage rather than hotlinked. Source plan: `~/.claude/plans/hey-claude-i-have-resilient-peacock.md`.

Live facts at start (2026-09-05): 699 books, 691 Google covers stored (576 at `zoom=1`), 223 with `open_library_cover_id`, 678 with ISBN, 10 books on any shelf, bucket `place-photos` is the only Storage bucket.

**Constraints that apply to every task**
- `books.average_rating` / `ratings_count` are Open Library external ratings only (migration 063). Never derive them locally.
- `books` INSERT is admin-only under RLS; scripts use `SUPABASE_SERVICE_ROLE_KEY`, the app path uses `createAdminClient()`.
- `no-console` is an error in `lib/**` and `app/**`; use `logError` from `lib/utils/log.ts`. Scripts are exempt.
- Open Library: ≤ 2 req/s, send a `User-Agent` naming the app and a contact address. NYT: 5 req/min, 500/day. Google Books: only with `GOOGLE_BOOKS_API_KEY` (1,000/day), second pass only.
- Storage free tier: 1 GB, 2 GB egress/month. Resize covers to ≤ 800 px wide JPEG q85 (≈ 80–120 KB each).

---

## Task 0: Preflight: scripts reach DB, API keys, `book-covers` bucket

**Source:** Approved plan > Task 0
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `supabase/migrations/071_book_covers_bucket.sql`, `.env.example`

**Context:** Every later task depends on three things: the tsx scripts being able to talk to Supabase (the `.env.local` values written by the Vercel CLI carry literal `\n`, which broke `node --env-file` before), a public bucket to put covers in, and API keys for NYT (required for Task 4) and Google Books (optional throughput for Tasks 3–5).

**Steps:**
1. [x] Run `npm run enrich-books -- --dry-run --limit 1` and confirm it reaches the DB
2. [x] Write migration `071_book_covers_bucket.sql`: bucket `book-covers` (public, 5 MB, `image/jpeg`), storage policies: anyone can read, only `service_role` writes/updates/deletes
3. [x] Apply with `npx supabase db query --linked -f supabase/migrations/071_book_covers_bucket.sql`
4. [x] Add `NYT_BOOKS_API_KEY=` and `GOOGLE_BOOKS_API_KEY=` to `.env.example` with a comment (script-only, never `NEXT_PUBLIC_`)
5. [x] Ask the user to register a free NYT Books API key (developer.nytimes.com → Apps → enable "Books API") and optionally a Google Books API key (console.cloud.google.com → Books API → credentials), and paste both into `.env.local`

**Verify:**
- [x] Dry run prints the enrichment banner and a DB result (no "Invalid API key")
- [x] `select id, public, allowed_mime_types from storage.buckets where id='book-covers'` returns one row
- [x] `select policyname from pg_policies where schemaname='storage' and tablename='objects' and qual ilike '%book-covers%'` lists the read policy (writes need no policy: service role bypasses RLS, everyone else is denied)
- [x] `.env.example` contains both new keys
- [x] `NYT_BOOKS_API_KEY` present in `.env.local` (user added it 2026-09-05; `GOOGLE_BOOKS_API_KEY` not added, Google stays unkeyed second pass)

**Completed Notes:**
- Files modified: `supabase/migrations/071_book_covers_bucket.sql` (new, applied to production 2026-09-05), `.env.example`
- Approach taken: dry run of `enrich-books` reached the DB through dotenv (the Vercel-CLI `\n` problem only affects `node --env-file`), so no env helper was needed. Bucket inserted with `ON CONFLICT DO UPDATE` so the migration is re-runnable; a single public `SELECT` policy on `storage.objects`, deliberately no INSERT/UPDATE/DELETE policy so only the service role can write. Key placeholders appended to `.env.example` with registration hints.
- Deviations from plan: the plan said "storage policies: read + write"; write policies were dropped as unnecessary (service role bypasses RLS) and safer.
- Issues encountered: `tsx` on Windows prints a harmless libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`) at exit after the summary; not a script error. `NYT_BOOKS_API_KEY` is not yet in `.env.local`; this is the user's step.

**Status:** [x] COMPLETE

---

## Task 1: Cover pipeline library (fetch, score, pick, store)

**Source:** Approved plan > Task 1
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `lib/covers/pipeline.ts` (new), `__tests__/lib/covers/pipeline.test.ts` (new), `package.json` (`sharp` explicit devDependency)

**Context:** The browser cannot tell a real cover from Google's grey placeholder (same bytes as some real covers, CORS blocks canvas) and cannot compare candidate sizes before choosing. A server-side pipeline can: hash, measure, pick, and store once.

**Steps:**
1. [x] `collectCandidates(book)` → ordered URLs from the existing builders in `lib/utils/covers.ts` (OL by cover ID, OL by ISBN, Google `zoom=3`), plus optional extra URLs passed by importers (e.g. NYT `book_image`)
2. [x] `fetchAndScore(url)` → `fetch` with OL `User-Agent`, buffer, MD5, `sharp(buffer).metadata()`; reject: non-image, MD5 `e89e0e364e83c0ecfba5da41007c9a2c`, width < 300, aspect (w/h) outside 0.55–0.85
3. [x] `pickBest(scored)` → widest passing; tie → earlier candidate (OL edition ISBN beats Google)
4. [x] `storeCover(bookId, buffer)` → `sharp().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 85 })`, upload to `book-covers/{bookId}.jpg` with `upsert: true`, `contentType: image/jpeg`, `cacheControl: 31536000`; return public URL
5. [x] `processBook(admin, book, opts)` → skip when `cover_url` already on the bucket unless `force`; on success update `cover_url`, keep `cover_source` as the winner's origin (`google` / `openlibrary` / `other`), set `open_library_cover_id` when discovered; on no candidate leave the row unchanged and return `{ status: "no-candidate" }`
6. [x] `isStoredCover(url)` helper (bucket-host check) exported for Task 2
7. [x] Unit tests with small generated fixtures (sharp can create them): placeholder hash rejected, 128 px rejected, widest wins, stored URL skipped, `force` reprocesses

**Verify:**
- [x] `npm run test:run -- __tests__/lib/covers` passes (15 tests)
- [x] `npm run lint` 0 errors, `npm run typecheck` clean
- [x] Module has no client-side import path (server-only; not imported by any component)

**Completed Notes:**
- Files modified: `lib/covers/pipeline.ts` (new), `__tests__/lib/covers/pipeline.test.ts` (new, 15 tests), `package.json` + `package-lock.json` (`sharp@^0.34.5`, already installed transitively via Next at 0.34.5, no new install)
- Approach taken: the module takes the service-role client as a parameter and does not import `server-only`, so Task 3's tsx script and Task 7's server action can share it. `collectCandidates` reuses `getCoverUrlsWithFallbacks` from `lib/utils/covers.ts` (importer extras first, bucket URLs excluded, de-duplicated). `fetchAndScore` never throws: every failure is a `reason` (`http-error`, `not-image`, `placeholder`, `too-small`, `bad-aspect`, `too-large`, `fetch-failed`) so Task 3 can list why a book has no cover; it sends an Open Library `User-Agent` (site URL + optional `OPEN_LIBRARY_CONTACT`), 15 s timeout, 5 MB cap. When an OL by-ISBN URL redirects to `/b/id/NNN-L.jpg` the cover id is read off `response.url` and written to `open_library_cover_id` if the row has none, even when a wider Google image wins. `storeCover` writes an auto-rotated ≤ 800 px JPEG q85 (mozjpeg) to `book-covers/{id}.jpg` with `upsert`, 1-year cache, and appends `?v=<unix>` to the public URL so a forced re-process busts the CDN and `next/image` caches; `isStoredCover` tolerates the query. The row update ends in `.select("id")` and 0 rows is a failure (admin row-count rule). `processBook` returns `skipped` / `stored` / `no-candidate` / `failed` with per-candidate verdicts (buffers stripped); `dryRun` reports the would-be winner without uploading.
- Deviations from plan: `sharp` went into `dependencies`, not `devDependencies`, because Task 7 runs the pipeline inside a server action on Vercel. Open Library cover id is taken from any passing OL candidate, not only the winner (the plan said "when discovered"). Added `dryRun`, `placeholderHashes` and `fetchImpl` options for Task 3 and the tests.
- Issues encountered: with sharp in the suite, `__tests__/components/reviews/quick-rating.test.tsx` failed on its 1 s `waitFor` in every full run (passed alone and in a pair): libvips opens a thread pool per core on top of vitest's worker per core and starved the other worker. Fixed by `sharp.concurrency(1)` at the top of the pipeline test; full suite green twice (72 files, 667 tests). Heredoc-written TS files fail under Git Bash on this machine (the file's apostrophes confuse the wrapper); use the Write tool for new files.

**Status:** [x] COMPLETE

---

## Task 2: Render from stored covers

**Source:** Approved plan > Task 2
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `lib/utils/covers.ts`, `lib/config/image-hosts.ts`, `__tests__/lib/config/image-hosts.test.ts`, `next.config.ts` (confirm CSP only)

**Context:** Today `resolveCoverUrl` puts the stored `cover_url` third in the chain, behind Open Library lookups. Once a book has a verified stored cover, that URL must be the only candidate, and `next/image` plus the OG routes must be allowed to load it.

**Steps:**
1. [x] Add `{ protocol: "https", hostname: "bgczdbmqievfilvdzlgl.supabase.co", pathname: "/storage/v1/object/public/book-covers/**" }` to `ALLOWED_IMAGE_HOSTS`
2. [x] In `resolveCoverUrl` and `getCoverUrlsWithFallbacks`: if `isStoredCover(book.cover_url)` return it alone; otherwise unchanged
3. [x] Confirm CSP `img-src` already allows `https://*.supabase.co` (it does as of 2026-09-05; no edit expected)
4. [x] Extend the image-hosts test with the new host and a negative case for another bucket path

**Verify:**
- [x] `npm run test:run -- __tests__/lib/config __tests__/lib/utils` passes (plus `__tests__/lib/covers`; full suite green, 670 tests)
- [x] `npm run lint`, `npm run typecheck` clean
- [x] Process one book manually (`processBook` via a tsx one-liner) and confirm `/books/[slug]` on `npm run dev` serves the cover from `/_next/image?url=https://bgczdbmqievfilvdzlgl.supabase.co/storage/...`, no console CSP error (Atomic Habits, 2026-09-05: 0 console errors/warnings; the optimizer returned a 384x576 JPEG for the `w=384` slot)

**Completed Notes:**
- Files modified: `lib/utils/covers.ts` (`COVER_BUCKET`, `isStoredCover`, short-circuit in `resolveCoverUrl` and `getCoverUrlsWithFallbacks`), `lib/covers/pipeline.ts` (imports + re-exports the two from utils; `collectCandidates` clears a stored `cover_url` before building the chain so `force` still sees the real sources), `lib/config/image-hosts.ts` (bucket host + path), `__tests__/lib/config/image-hosts.test.ts` (+1 test), `__tests__/lib/utils/covers.test.ts` (+2 tests). `next.config.ts` untouched: CSP `img-src` already lists `https://*.supabase.co`.
- Approach taken: `isStoredCover` had to move out of the pipeline module because `lib/utils/covers.ts` is imported by client code (`hooks/use-cover-src.ts`, `components/books/cover-image.tsx`) and the pipeline imports sharp; the pipeline re-exports it so Task 1's API is unchanged. Live check: ran `processBook` on Atomic Habits (highest `ratings_count` with ISBN + Google id): OL-by-ISBN 331 px and Google zoom 3 575 px passed, the stored Google zoom 1 128 px was rejected `too-small`; 85 KB JPEG stored, `cover_url` now on the bucket, `cover_source` google. On `npm run dev` `/books/atomic-habits` renders it via `/_next/image?url=...book-covers/...jpg%3Fv%3D...&w=384&q=85`, zero console errors/warnings, screenshot crisp.
- Deviations from plan: the "negative case for another bucket path" in the image-hosts test became look-alike-host and other-project negatives, because `isAllowedImageHost` (the OG SSRF gate) matches hostname only, not pathname; pre-existing behaviour, unchanged. The path restriction is enforced by `next/image` `remotePatterns` and by `isStoredCover`. The throwaway probe script had to live inside `scripts/` (Node resolves packages from the script's own directory, so the scratchpad cannot see `node_modules`); it was deleted afterwards.
- Issues encountered: (1) `img.naturalWidth` reports 200 for the 384 px bitmap: with `srcset` width descriptors and `sizes="(max-width: 640px) 50vw, 200px"` browsers return the density-corrected intrinsic size (384 / (384/200)). Task 9's `naturalWidth >= 2 x clientWidth` check must read the `w=` of `currentSrc` instead. (2) The detail-page cover is 288 CSS px wide but its `sizes` says 200px, so at DPR 1.5 the chosen 384 px slot is slightly under 2x; pre-existing `sizes` mismatch in the cover component, added to Out of Scope. (3) A `HEAD` on the stored object shows `Cache-Control: no-cache`; `GET` shows `public, max-age=31536000` (CF-Cache MISS on first hit), so the upload's `cacheControl` did take. (4) OL-by-ISBN redirected to an `ia*.us.archive.org/view_archive.php?...zip&file=...-L.jpg` URL, so no `/b/id/NNN` cover id was discoverable from the redirect for this book.

**Status:** [x] COMPLETE

---

## Task 3: Backfill covers for the existing catalog

**Source:** Approved plan > Task 3
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `scripts/process-covers.ts` (new), `package.json` (`covers:process`)

**Context:** 699 books already exist; 576 store a 128 px Google URL. Running the pipeline over them is the single most visible improvement and validates the pipeline before the imports multiply the catalog.

**Steps:**
1. [x] Script skeleton copied from `scripts/enrich-books.ts` (dotenv, service client, progress bar); flags `--dry-run`, `--limit N`, `--force`, `--only-missing`, `--verbose`
2. [x] Page through `books` ordered by `created_at`; call `processBook`; 500 ms sleep between books
3. [x] Summary: processed / skipped (already stored) / no-candidate / failed, with the no-candidate titles listed for manual review
4. [x] Run `--dry-run --limit 20`, then `--limit 50` live, inspect 5 covers in the browser, then the full run

**Verify:**
- [x] `select count(*) from books where cover_url like '%/book-covers/%'` ≥ 650 (665 of 699 = 95 %; 665 objects, 0 orphans)
- [x] 10 random processed books look sharp at 2× DPR on `/books` (Playwright screenshot with `deviceScaleFactor: 2`): 10 random detail pages all stored at the 640 px slot for a 288 px box; `/books` first 20 cards and `/trending` first 24 cards all stored, all ≥ 2× (640 px slot for 224 px), zero console errors
- [x] No-candidate books show the gradient placeholder, not a wrong image: not a wrong image, but not the placeholder either. The 34 no-candidate rows keep their pre-existing chain and render the small (< 300 px) Open Library scan of the right book (checked The Alchemist, The Sun Also Rises, Shuggie Bain). Forcing the placeholder needs a renderer rule; listed in Out of Scope as a user decision
- [x] Storage usage for the bucket noted (expect < 90 MB for 699 covers): 34.7 MB for 665 objects (≈ 53 KB each)

**Completed Notes:**
- Files modified: `scripts/process-covers.ts` (new), `package.json` (`covers:process`), `lib/covers/pipeline.ts` (three guards added, see below), `__tests__/lib/covers/pipeline.test.ts` (19 tests now; fixtures carry gaussian noise so they encode like real artwork).
- Approach taken: script pages `books` oldest-first, drops rows already on the bucket unless `--force`, calls `processBook`, sleeps 500 ms, and prints stored / skipped / no-candidate / failed plus a rejection-reason tally and the no-candidate titles. Extra flags beyond the plan: `--ids a,b,c` (re-verify specific books, implies force) and a second pass for no-candidate books that asks the Open Library search API for the work-level `cover_i` (ISBN, then title+author) and retries with it as an extra candidate. Runs on 2026-09-05: dry run 20 → live 50 → full 650 (589 stored, 61 no-candidate) → second pass over the 61 (36 stored, 20 via the work cover) → `--ids` re-verification of the 189 stored objects under 30 KB (180 re-stored, 9 cleared). Final: 665 stored (414 Google, 251 Open Library), 34 no-candidate (25 with their old remote URL, 9 with NULL), `open_library_cover_id` filled on 248 rows (was 223).
- Deviations from plan: (1) Google's zoom-3 "image not available" (575×750, 9,103 B, MD5 `a64fa89d…`) is a second placeholder the plan's hash list lacked; it appeared as the winner for 6 of the first 20 dry-run books. (2) Google serves publisher logos on white (Penguin, Scribner flame, …) as covers: full-size, correct aspect, 2–15 KB. Added `MIN_BYTES_PER_PIXEL = 0.05` (`low-detail` rejection; placeholders sit at 0.02–0.03, real covers at 0.1–0.6) plus the Penguin hash. (3) `MIN_COVER_WIDTH` alone rejected every narrow-aspect Open Library scan (their L size is 500 px tall, so widths run 290–340): a candidate is now too small only when it misses both 300 px wide and 450 px tall. (4) A forced re-run that finds nothing valid now deletes the stored object and nulls `cover_url`/`cover_source` (`cleared: true`), otherwise the logos found in (2) could never be removed. (5) `sharp.concurrency` untouched in the script; the 500 ms sleep keeps Open Library under 2 req/s.
- Issues encountered: (1) The full run (650 books, ~35 min) ran on the pre-guard module, hence the `--ids` re-verification pass; the bucket's smallest objects are now 7–19 KB and were checked by reason (`placeholder` 56, `low-detail` 56 rejections in that pass). (2) `/books` kept showing Open Library URLs for an hour after the run: `getPopularBooks` is an `unstable_cache` entry (`revalidate: 3600`, tag `books`) and no code path calls `revalidateTag` for that tag, so a script run is visible on Browse only after the entry expires. Confirmed by watching the HTML flip at 10:28 UTC, exactly one hour after the first render. Production will behave the same after Task 4/5 runs. (3) Throwaway probe scripts must live in `scripts/` (Node resolves packages from the file's directory); heredocs with emoji/back-ticks broke twice under Git Bash, so multi-line patches were run from files in the scratchpad.

**Status:** [x] COMPLETE

---

## Task 4: NYT bestseller import

**Source:** Approved plan > Task 4
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/import/nyt.ts` (new), `lib/import/insert-book.ts` (new, shared with `lib/actions/books.ts`), `scripts/import-nyt-bestsellers.ts` (new), `package.json`

**Context:** NYT bestseller lists are the best free signal of what people are buying now, and each entry carries the current edition's ISBN-13, which yields the modern cover. Monthly snapshots since 2016 give ~2,500 distinct titles.

**Steps:**
1. [x] `lib/import/nyt.ts`: `fetchOverview(date)` → `GET https://api.nytimes.com/svc/books/v3/lists/overview.json?published_date=YYYY-MM-DD&api-key=…`; returns `{ listName, rank, title, author, primaryIsbn13, description, bookImage }[]`; 13 s sleep between calls; retry once on 429
2. [x] Extract `insertBookWithUniqueSlug` from `lib/actions/books.ts` into `lib/import/insert-book.ts` and import it back into the action (behaviour unchanged, existing tests must pass)
3. [x] Script: dates = first Sunday of each month 2016-01 → current month; collect entries; dedupe in-memory by ISBN-13; drop titles matching `/box(ed)? set|collection|omnibus|\b\d+ books?\b/i`
4. [x] Dedupe against the catalog: ISBN → `normalizeTitle`+`normalizeAuthor` match
5. [x] Enrich each new title: `searchOpenLibraryByIsbn` / `enrichBookEntry` for description, genres, published date, page count, OL ids; Google by ISBN only when `GOOGLE_BOOKS_API_KEY` exists and a daily budget counter (900) remains
6. [x] Insert via the shared helper with `average_rating: null, ratings_count: 0`, genres + `"Bestseller"`, `cover_source` per origin; then `processBook` with NYT `bookImage` as an extra candidate
7. [x] Flags `--dry-run`, `--from YYYY-MM`, `--to YYYY-MM`, `--limit N`, `--verbose`; resumable (skips ISBNs already in catalog)

**Verify:**
- [x] `--dry-run --from 2026-01` lists counts per list without writing (9 snapshots, 21 lists, 655 distinct titles, 626 new; no writes)
- [x] Full run adds ≥ 2,000 rows; `select count(*) from books where 'Bestseller' = any(genres)` matches the summary (2,313 = 149 from the trial/interrupted runs + 1,727 main run + 437 top-up; catalog 699 → 3,012)
- [x] Duplicate check from migration 069 (`group by lower(title), lower(author) having count(*) > 1`) returns 0 rows
- [x] Every new row has a bucket `cover_url` or NULL (never a raw remote URL): 2,157 stored, 156 NULL, 0 raw remote
- [x] `npm run test:run -- __tests__/lib/actions/books.test.ts` still passes after the helper extraction (8 tests; full suite 73 files / 691 tests green; lint + typecheck clean)

**Completed Notes:**
- Files modified: `lib/import/insert-book.ts` (new: `insertBookWithUniqueSlug` + exported `BookInsertData`, now derived from the generated Insert type), `lib/actions/books.ts` (imports the helper; 90 lines removed), `lib/import/nyt.ts` (new: `fetchOverview`, `parseOverview`, `firstSundays`, `titleCase`, `cleanAuthor`, `stripEditionSuffix`, `isBoxSet`, `listGenres`), `__tests__/lib/import/nyt.test.ts` (new, 17 tests), `scripts/import-nyt-bestsellers.ts` (new), `lib/utils/external-book-search.ts` (`googleBooksUrl()` appends `GOOGLE_BOOKS_API_KEY` when set; `getOpenLibraryDescription` exported), `package.json` (`import:nyt`).
- Approach taken: one overview snapshot per month (first Sunday) from 2016-01 to 2026-09 = 129 NYT calls at 13 s spacing, cached as JSON under `node_modules/.cache/ohmyreads/nyt` so every re-run is free. Entries collapse by ISBN-13 and then by normalised title+author (edition suffixes like "(Full-Cast Edition)" stripped first), the newest appearance keeping the ISBN so the cover is the current edition's. Enrichment is Open Library only (no Google key): search by ISBN, else a title+author search that must match the normalised title and the author's surname; an ISBN hit whose title disagrees with NYT's (e.g. a Japanese record, "Untitled 978…") is discarded. The row's title is always NYT's, title-cased (Open Library titles are sentence case and drop articles: "Widow"). Genres = list-derived site genres + "Bestseller" + filtered Open Library subjects, max 8. Insert through the shared helper with null external ratings, then `processBook` with NYT's `book_image` as the first extra candidate. Five workers share the queue (each book is ~5 sequential external requests over 10–15 s, so the pool stays under Open Library's 2 req/s; probes during the run showed 200s at ~0.7 s). Newest bestsellers are processed first so an interrupted run still lands the relevant titles; re-runs skip anything already in the catalog by ISBN, title+author (author key with spaces removed so "A.J. Finn" = "A. J. Finn") or Open Library work id.
- Deviations from plan: (1) The plan's "~2,500 distinct titles" estimate was off by 2.5×: all lists give 6,881 distinct titles. Added `EXCLUDED_LISTS` (audio, e-book and series-books lists: audio/e-book ISBNs have no print cover and repeat the print lists; series-books names a series with a box-set ISBN), a manga/volume filter (`Vol. 30`) in the box-set regex, and `--min-weeks N` (best `weeks_on_list`, default 4). Default 4 gave 1,886 new; the plan's ≥ 2,000 was met by a `--min-weeks 3` top-up (444 more). Monthly lists report `weeks_on_list` 0, so mass-market and the 2016-17 topical lists are out unless `--min-weeks 0`. (2) `--lists a,b` and `--min-weeks` flags added beyond the plan's list. (3) 13 s NYT pacing lives in the script, not in `fetchOverview` (which only does the single 429 retry). (4) `sharp`-free, `server-only`-free module layout kept: `lib/import/nyt.ts` is pure and testable; `getOpenLibraryDescription` had to be exported for the title+author fallback.
- Issues encountered: (1) The sequential first run took ~13 s per book (Open Library search + work description + 3–4 cover fetches), i.e. 7 h for the queue; killed after 62 books and re-run with a worker pool (3, then 5). Killing a backgrounded `npm run` on Windows leaves the `tsx`/node tree alive; it had to be found by command line and stopped by pid. (2) Ten inserts failed with `books_open_library_id_unique_idx` (migration 059): the same Open Library work already in the catalog under another title or author spelling ("American Prometheus"/"Oppenheimer", "A.J. Finn"). Correct outcome; the script now checks the work id and the space-less author key up front and reports them as duplicates (confirmed on the top-up: 7 clean skips, 0 failures). (3) 156 new rows have no stored cover: nearly all picture books whose covers are square (330×330, 500×500) and fail the pipeline's 0.55–0.85 aspect rule; they render through the old fallback chain like the 34 from Task 3. (4) Open Library subjects leak messy genre strings ("Fiction, Thrillers, General", "Juvenile Fiction", "American Literature") past the noise filter; added to Out of Scope for a vocabulary pass after Task 6. (5) Storage after the run: 2,822 objects, 108.3 MB, 0 orphans (free tier 1 GB).

**Status:** [x] COMPLETE

---

## Task 5: Popular-per-genre + award winners import

**Source:** Approved plan > Task 5
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `scripts/import-popular-subjects.ts` (new), `scripts/import-award-winners.ts` (restored from `scripts/archive/`, updated to shared helper + pipeline), `package.json`

**Context:** Bestsellers skew to the last decade and to US trade fiction. Open Library's most-read works per subject fill each genre shelf with the titles readers expect, and award winners cover literary prestige.

**Steps:**
1. [x] Subject list (~35) mapped to the site's genre names: fantasy, romance, thriller, mystery, science_fiction, horror, historical_fiction, literary_fiction, young_adult, self_help, memoir, biography, history, science, business, psychology, graphic_novels, poetry, children, classics, dystopia, humor, philosophy, true_crime, travel, cooking, essays, short_stories, adventure, crime, contemporary, paranormal, lgbt, nonfiction, religion (+ aliases `popular_science`, `adventure_stories`)
2. [x] `GET https://openlibrary.org/subjects/{subject}.json?limit=100&details=false` (try `&sort=readinglog`, fall back to default); also `GET https://openlibrary.org/trending/weekly.json?limit=100` — implemented on `search.json?subject=…&language=eng&sort=readinglog` instead (see Deviations)
3. [x] Filter: `language` includes `eng` (or unknown), `first_publish_year` present, skip works whose title matches the box-set regex; prefer the edition with the most recent English ISBN for cover/ISBN
4. [x] Restore `import-award-winners.ts`: keep the 7 awards, add `womens_prize_for_fiction` and `international_booker_prize`; switch to the shared insert helper and `processBook`
5. [x] Same dedupe (ISBN → normalised title+author), enrichment, insert, cover pipeline as Task 4; 500 ms sleep
6. [x] Run per subject with `--limit` first, then all

**Verify:**
- [x] `select count(*) from books` ≈ 5,000 (± 500): 5,568 (3,012 → 5,568; slightly above the band because the Science and Adventure aliases were needed for the genre floor)
- [x] `select g, count(*) from books, unnest(genres) g group by g` ≥ 100 for each top-level genre used by the browse filter: all 35 mapped genres ≥ 100 (lowest: Religion 105, Short Stories 109, Cooking 112, Adventure 114; highest: Non-Fiction 1,942, Fiction 742, Children 471, Young Adult 431)
- [x] Duplicate check returns 0 rows
- [x] No new row has a raw remote `cover_url` (0); 5,139 of 5,568 stored (92 %), 404 NULL, bucket 177 MB, 0 orphans

**Completed Notes:**
- Files modified: `scripts/lib/import-core.ts` (new: catalog index, dedupe, enrichment, insert + cover pipeline, worker pool, summary — extracted from the Task 4 script), `scripts/lib/ol-search.ts` (new: Open Library `search.json` by subject with the English edition, trending, author-record lookup, cached under `node_modules/.cache/ohmyreads/ol-search`), `scripts/import-popular-subjects.ts` (new, `import:subjects`), `scripts/import-award-winners.ts` (restored from the archive, rewritten on the core, `import:awards`), `scripts/import-nyt-bestsellers.ts` (now on the core; identical dry-run numbers), `scripts/archive/import-award-winners.ts` (deleted) + `scripts/archive/README.md`, `package.json`.
- Approach taken: one `ImportCandidate` shape feeds a shared runner, so all three importers dedupe the same way (ISBN, normalised title + space-less author, Open Library work id), enrich the same way (a candidate that names its work only fetches the description; otherwise OL by ISBN with the title-agreement guard, then title+author search; Google only with a key), and store covers the same way. Subjects: `search.json?subject=X&language=eng&sort=readinglog&limit=100` per subject plus `trending/weekly.json`; the `editions` sub-document supplies the English edition's title, ISBN and cover (`A Court of Mist and Fury` for the Spanish-titled work). Filters: Latin-script author (the author record `/authors/{key}.json` is consulted when `author_name[0]` is native script, since the other names are translators; "Tolstoy, Leo" is re-ordered), Latin-script title, `first_publish_year`, box-set/volume regex, English-group ISBNs only (978-0/978-1/979-8) so a foreign edition never supplies the cover, sentence-case titles title-cased. A work found in many subjects keeps the genres of the 3 subjects where it ranks highest. Awards: 9 awards over 14 subject keys, existing rows get the tag (69 tagged), new rows are imported with it; the 15 legacy "Man Booker Prize" tags were renamed "Booker Prize" by SQL. Runs on 2026-09-05/06: awards (433 inserted, 338 covers), subjects main pass (1,286 inserted, 1,155 covers), second pass `--limit 200` for the 10 genres under 100 (653 inserted), `popular_science` (161) and `adventure_stories` (25) aliases, then `npm run covers:process` over the 528 rows without a stored cover (running at wrap-up; resumable).
- Deviations from plan: (1) `subjects/{x}.json` replaced by `search.json?subject=` — the subjects endpoint returns no ISBN, no language and work titles in any language, so every work would have needed a second call; the search API filters `language=eng`, sorts by `readinglog`, and returns the best English edition inline. (2) The shared machinery lives in `scripts/lib/` rather than `lib/import/` because it prints progress (`no-console` is an error in `lib/**`). (3) Two alias subjects added (`popular_science`, `adventure_stories`) because the bare subjects left Science at 85 and Adventure at 89. (4) The Women's Prize and International Booker subjects barely exist on Open Library (2 and 0 works); the awards are wired but contribute nothing. (5) Total landed at 5,568, 68 above the ± 500 band.
- Issues encountered: (1) Open Library subject searches take 3–10 s and time out under load; added a 90 s timeout with one retry and disk caching (`-v2` suffix after the fields changed). (2) Heredoc-delivered backslashes are mangled by the shell wrapper on this machine: a ` ` escape became a literal NUL byte in `ol-search.ts` (`grep` reported a binary file); rewritten through a Python script using `chr()`; the Edit tool likewise rewrites `\uXXXX` escapes, so unicode regexes must be patched via Python. (3) Open Library data noise removed by hand: "Iland of the Blue Dolphins" (typo edition title, duplicate of the real row, deleted with its cover object), "DRUMMER HOFF(CD1장포함)…" (Korean edition title, corrected), "Buker v Rossii" (a Russian study of the Booker Prize tagged as a winner, deleted). "The Republic of Plato" carries a Pulitzer tag on Open Library and was left as is. (4) 314 subject rows had no passing cover candidate (mostly small Open Library scans); the closing `covers:process` run with its work-cover second pass recovered ~100 before wrap-up.

**Status:** [x] COMPLETE

---

## Task 6: Ratings and metadata gaps for new rows

**Source:** Approved plan > Task 6
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `scripts/import-ratings.ts`, `scripts/enrich-books.ts` (both patched, see notes)

**Context:** Browse "popular" order, related books, and the recommendation candidate pool all sort by Open Library `ratings_count`. New rows start at 0 and would sink to the bottom until rated.

**Steps:**
1. [x] `npm run import-ratings` (300 ms/book; ~4,300 books ≈ 25 min; run in background, check summary) — 4,921 unrated rows, 82 min, 4,344 rated / 577 not found / 10 transient network errors
2. [x] `npm run enrich-books -- --limit 5000` for rows still missing description / page_count / genres — 1,046 rows, 25 min, 338 updated (description 230, published_date 115, page_count 106, open_library_id 94)
3. [x] Re-run `import-ratings` once for rows the first pass skipped on transient errors — 577 leftovers, 16 min, 72 more rated (the 10 transient errors plus rows whose new `open_library_id` from step 2 resolved), 505 still not on Open Library

**Verify:**
- [x] `select count(*) filter (where average_rating is not null) * 100 / count(*) from books` ≥ 80: 90.9 % (5,063 / 5,568) after pass 2
- [x] `/books` default (popular) view shows widely known titles in the first 20: dev server + Playwright 2026-09-06 11:15 — Atomic Habits, The 48 Laws of Power, Rich Dad Poor Dad, It Ends with Us, Harry Potter ×4, A Game of Thrones, The Hunger Games, The Hobbit, Animal Farm, Brave New World, Fahrenheit 451, Diary of a Wimpy Kid, A Court of Mist and Fury…; 0 console errors
- [x] `select count(*) from books where description is null` < 5 % of catalog: **7.7 % (428 rows), target missed**; user decision 2026-09-06: accept and defer the remainder to the Out of Scope table (Google-keyed enrichment run) — see Issues

**Completed Notes:**
- Files modified: `scripts/import-ratings.ts` (paged `.range()` select, server-side `.or("average_rating.is.null,ratings_count.eq.0")`, `User-Agent` on both Open Library calls), `scripts/enrich-books.ts` (paged select with the gap filter server-side; the `cover_url` fill removed — covers are owned by `covers:process` and a raw remote URL would bypass its checks; `--limit 5000` was previously capped at PostgREST's 1,000-row ceiling). Out of Scope table: NYT cover re-sourcing row added (NYT API terms read 2026-09-06).
- Approach taken: the leftover Task 5 cover pass was re-run first (423 rows, 46 stored of which 43 via the Open Library work cover, 377 no candidate; stored covers 5,191). Then ratings pass 1, enrichment, ratings pass 2 — sequential so Open Library never sees more than one script. A read-only probe (`scripts/probe-ol-descriptions.ts`, deleted) asked Open Library's work records for the 417 no-description rows that carry a work id: only 11 have one, so Open Library cannot close the description gap.
- Deviations from plan: both scripts needed paging before they could see more than 1,000 rows; the enrichment script no longer writes `cover_url`.
- Issues encountered: (1) Google Books' anonymous daily quota was exhausted partway through the enrichment pass (HTTP 429 "Queries per day"), which `external-book-search.ts` swallows as "no result"; 708 of 1,046 rows came back "no new data" and the description gap stayed at 428 rows (378 of them have an ISBN, 50 have neither ISBN nor a Google id). A keyed run (`GOOGLE_BOOKS_API_KEY`, 1,000/day, Task 0 step 5 left it to the user) is the only remaining source; Open Library was ruled out by the probe. (2) Ratings pass 1 hit 10 transient `ECONNRESET`/`fetch failed` errors; pass 2 covers them. (3) Browse genre chips: after the imports the catalog holds 7,141 distinct `genres` strings and the chip row lists them alphabetically ("[document]", "[études Diverses]", "11.93 Buddhism", "1835-1910", "+990 more") — the vocabulary clean-up in the Out of Scope table is now user-visible on the first screen; promoted to Task 8 at the user's request (2026-09-06).

**Status:** [x] COMPLETE

---

## Task 7: Search-to-add runs the cover pipeline

**Source:** Approved plan > Task 7
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `lib/actions/books.ts` (`importAndAddToShelf`), `lib/covers/pipeline.ts` (User-Agent fix), `__tests__/lib/actions/books.test.ts`, `__tests__/lib/covers/pipeline.test.ts`

**Context:** `importAndAddToShelf` is the only path where a normal user creates a catalog row (from the AI book search). Without this step, user-added books keep the old fallback chain and look worse than the imported ones.

**Steps:**
1. [x] After a new row is inserted, call `after(() => processBook(adminClient, row).catch(e => logError("cover pipeline", e)))` from `next/server`
2. [x] Do not run it for the existing-row branch
3. [x] Test: pipeline mocked; invoked once for a new row, never for an existing one; a rejected pipeline promise does not fail the action

**Verify:**
- [x] `npm run test:run -- __tests__/lib/actions/books.test.ts` passes (11 tests; + 20 in the pipeline file)
- [x] `npm run lint`, `npm run typecheck` clean
- [x] On `npm run dev`, add an obscure book via AI search; within a few seconds its `cover_url` points at the bucket and the card is sharp — done through the real server action (no Gemini key locally, see Deviations): "Riddley Walker" (ISBN 9780253212344) inserted with a remote Open Library URL; the action returned in 895 ms; 20 s later `cover_url` = `…/book-covers/<id>.jpg?v=…`, `cover_source` = openlibrary (315×500 scan); `/books/riddley-walker` rendered it via `/_next/image`, 0 console errors

**Completed Notes:**
- Files modified: `lib/actions/books.ts` (imports `after` from `next/server` and `processBook`; the admin client is created once and reused for the insert and the pipeline; after a successful insert `after()` schedules `processBook(admin, { id, cover_url, isbn, google_books_id, open_library_cover_id: null })` with a `.catch` → `logError("Cover pipeline failed for a user-added book")`), `lib/covers/pipeline.ts` (`headerSafeEnv()` strips CR/LF from the env values that build `USER_AGENT`), `__tests__/lib/actions/books.test.ts` (mocks for `next/server` `after` — callbacks collected and run by hand — and for the pipeline; 3 new tests: scheduled-not-run + admin client + row shape, never for an existing row, rejection logged and swallowed), `__tests__/lib/covers/pipeline.test.ts` (1 new test: the User-Agent built from a CR-LF env value has no control characters).
- Approach taken: the new row for the pipeline is built from the validated `externalBook` rather than re-read from the DB (the insert helper returns only `id` and `slug`). Live check via a throwaway signed-in account (`auth.admin.createUser`, logged in on `/login` with its generated password) and a throwaway `app/qa-import-cover/page.tsx` whose form action called the real `importAndAddToShelf`; both deleted afterwards along with the fixture row, its bucket object and the account.
- Deviations from plan: (1) the plan's "add via AI search" is impossible locally (no Gemini key), so the server action was driven directly — same code path from `requireUser` onwards. (2) One line outside the task's files: the pipeline's User-Agent, see Issues.
- Issues encountered: the first live run left the row on its remote URL with nothing logged. Probes on the dev server showed `after()` fires fine, but `processBook` returned `no-candidate` in 5 ms with every candidate `fetch-failed`, while the same row stored from the tsx script. Cause: `process.env.NEXT_PUBLIC_SITE_URL` inside Next is `http://localhost:3000\r\n` (the Vercel-CLI env quirk from `vercel-env-pasted-newlines`; Next's loader decodes the literal escape, dotenv does not), and the pipeline interpolates it into the middle of the User-Agent, so undici rejects the header before sending. `fetchAndScore` swallows the TypeError as `fetch-failed`. Production would have failed the same way for every user-added book. Fixed in the pipeline (strip CR/LF), regression test added; the second live run stored the cover.

**Status:** [x] COMPLETE

---

## Task 8: Genre vocabulary clean-up (Browse chips)

**Source:** Task 6 Issues (3) — promoted from the Out of Scope table at the user's request, 2026-09-06
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `supabase/migrations/072_genre_vocabulary.sql` (data-only mapping pass), the Browse genre-chip query (locate in `lib/queries/books.ts` / `app/books`), `scripts/lib/import-core.ts` (apply the same mapping on future imports), `__tests__/` for the mapping helper if it lives in `lib/`

**Context:** After the Task 4/5 imports `books.genres` holds 7,141 distinct strings (Open Library subjects and Google categories leak through: "Fiction, Thrillers, General", "Juvenile Fiction", "[document]", "[études Diverses]", "11.93 Buddhism", "1835-1910", …). The Browse page renders every distinct value as a filter chip in alphabetical order, so the first row a visitor sees is noise followed by "+990 more". The 35 mapped genres from Task 5 plus "Bestseller" and the award tags are the intended vocabulary.

**Steps:**
1. [x] Audit: `select g, count(*) from books, unnest(genres) g group by 1 order by 2 desc` — record how many strings carry ≥ 20 books, how many rows would lose their last genre under a strict allow-list, and how the chip list is built (query + component)
2. [x] Define the canonical vocabulary: the 35 Task 5 genres (+ aliases), "Bestseller", the 9 award tags, plus any high-count string that is a genuine genre; write a mapping table variant → canonical (case-insensitive, covers the Google "Fiction / Thrillers / General" and Open Library "Juvenile Fiction" families) and a drop rule for noise (Dewey numbers, date ranges, bracketed values, single-book strings)
3. [x] Migration `072_genre_vocabulary.sql`: data-only, idempotent, rewrites `genres` through the mapping, de-duplicates the array, never empties it (a row that would end up empty keeps its most common original value or gets "Fiction"/"Non-Fiction" from the Task 5 mapping); apply with `npx supabase db query --linked -f …`
4. [x] Browse chips: show only canonical genres, ordered by book count, capped (e.g. top 30 + "more") — if the query already reads distinct values, restrict it to the vocabulary
5. [x] Importers: run the same mapping in `scripts/lib/import-core.ts` (and `enrichBookEntry`'s `mergeGenres` if it feeds `genres`) so the next import does not reintroduce the noise
6. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] `select count(distinct g) from books, unnest(genres) g` ≤ ~60
- [x] `select count(*) from books where genres is null or cardinality(genres) = 0` = 0
- [x] Every Task 5 genre still has ≥ 100 rows (`Religion`, `Short Stories`, `Cooking`, `Adventure` were the lowest at 105–114)
- [x] `/books` on `npm run dev`: chips are recognisable genres, no bracketed/numeric strings, "+N more" small or gone; filtering by a chip still returns results; 0 console errors

**Completed Notes:**
- Files modified: `lib/data/genres.ts` (new: `GENRES` 42 + `GENRE_TAGS` 10 = 52-entry vocabulary, 322-key `GENRE_ALIASES`, `normalizeGenres()`, `genreKey()`, `isGenre()`, `genreAliasRows()`), `__tests__/lib/data/genres.test.ts` (new, 9 tests), `supabase/migrations/072_genre_vocabulary.sql` (new, applied 2026-09-07), `lib/validation/search.ts` (`GENRE_OPTIONS` = the vocabulary), `__tests__/lib/validation/search.test.ts`, `lib/actions/books.ts` (search-to-add normalises Google/OL genres), `lib/import/nyt.ts` (`LIST_GENRES` values are vocabulary entries), `lib/ai/prompts.ts` (available-genres line now interpolates `GENRES`), `scripts/lib/import-core.ts` (`buildInsert` runs `normalizeGenres`; `NOISE_SUBJECT` + `subjectsToGenres` removed), `scripts/enrich-books.ts` (normalises before writing).
- Approach taken: Audit — 7,141 distinct strings, 170 with ≥ 20 books, 4,759 singletons, avg 5.6 per row, 0 empty; chips come from the `get_distinct_genres()` RPC (alphabetical, every distinct value) through `getAllGenres()` → `book-browser.tsx` (first 10 + "more"). One TypeScript module is the source of truth: every raw string is split on `, / -- ;`, each part is looked up case-insensitively in the alias map, unknown parts are dropped, order is kept, duplicates collapse. The migration's alias VALUES table was generated from that map (`genreAliasRows()`), so SQL and TS agree; a rolled-back dry run first reported 51 distinct / 0 empty rows, then the real run matched. `get_distinct_genres()` now orders by book count. Before applying, the pre-072 `genres` of all 5,568 rows were copied to `public.books_genres_backup_072` (RLS enabled, no policies) as a safety net.
- Deviations from plan: the vocabulary is 52 entries, not "the 35 + Bestseller + 9 awards": Fiction, Drama, Mythology, Politics, Social Science, Health and Sports were added because they had real volume (36–202 rows) and the NYT list map already produced most of them. No row needed the "Fiction/Non-Fiction" fallback (0 empties in the dry run), so the migration simply leaves a would-be-empty row untouched. The audit also exposed a pre-existing bug the plan did not know about: the Browse island fetches `/api/books/search?genre=…`, whose Zod schema only accepted 20 hard-coded genres, so clicking any other chip (Essays, Dystopian, Bestseller, every award) returned 400 "Invalid genre" — fixed by making `GENRE_OPTIONS` the vocabulary.
- Issues encountered: none in the code path. The full suite had one unrelated flaky timeout (`quick-rating.test.tsx`) while lint, typecheck and the DB apply ran in parallel; it passes alone (4/4). Verify numbers after apply: 51 distinct strings, 0 empty rows, lowest Task 5 genres Short Stories 114 / True Crime 116 / Poetry 120 / Cooking 137 / Religion 148; Browse on `npm run dev`: 10 chips + "+41 more", all recognisable, Essays → 189 books, Dystopian → API 200 and 187 books, 0 console errors.

**Status:** [x] COMPLETE

---

## Task 9: Final QA

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] Stop `next dev`; run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`
2. [x] Playwright at `deviceScaleFactor: 2`: home, `/books`, `/trending`, one 2025 bestseller, one award winner, one classic; check `naturalWidth ≥ 2 × clientWidth` for the first 40 cover `<img>`s
3. [x] SQL: total ≈ 5,000; stored-cover share ≥ 90 %; duplicates 0; `published_date >= '2024-01-01'` ≥ 300
4. [x] Supabase dashboard: Storage size for `book-covers` and month-to-date egress; record both
5. [x] Commit, push, confirm production deployment Ready; re-check the same pages on production

**Verify:**
- [x] Build, lint, typecheck, tests green
- [x] No blurry or grey covers in the first 40 cards on `/books` and `/trending`
- [x] Production shows the new catalog

**Completed Notes:**
- Files modified: none beyond this plan file; the catalog work went out as `09660c2` (34 files, +4,864/−806) and this close-out as a docs commit.
- Approach taken: dev server stopped; `npm run lint`, `npm run typecheck` clean; `npm run test:run` 704 passed / 1 skipped (74 files); `npm run build` clean. Cover check with Playwright (installed in the session scratchpad, driving the installed Chrome at `deviceScaleFactor: 2`, 1440 px viewport) first against `npm run start` on the fresh build, then against production: home, `/books`, `/trending`, `/books/talons-of-power` (2025 bestseller), `/books/harry-potter-and-the-order-of-the-phoenix` (award-tagged), `/books/think-and-grow-rich` (classic). SQL: 5,568 books, 5,191 stored covers (93.2 %), 0 title+author and 0 ISBN duplicates, 416 rows with `published_date >= 2024-01-01`, 90.9 % rated, 428 without a description (accepted in Task 6). Storage: 5,191 objects, 179 MB in `book-covers` (from `storage.objects`). Commit `09660c2` pushed 06:45 UTC; Vercel `dpl_9M3uFek5Rnn9fKp1xKy9FLVgvuvt` READY 06:47; production confirmed by `/api/books/search?genre=Essays` flipping from 400 (old code) to 200, the six-page cover check re-run on production, and a DPR-2 screenshot of the Browse grid (Atomic Habits, 48 Laws, Rich Dad, It Ends with Us, Philosopher's Stone — all crisp, none grey). `public.books_genres_backup_072` dropped after the production check.
- Deviations from plan: (1) The plan's `naturalWidth ≥ 2 × clientWidth` test is not a valid measure with `next/image` srcsets — Chrome reports `naturalWidth` divided by the chosen candidate's density, so every card read "under 2×" even though the served file was untouched. The check was redone by fetching each card's `currentSrc` and decoding it with `createImageBitmap`. Real result: `/trending` (100 px slots) 24/24 ≥ 2×; home 20/21 (the hero webp is 1.39×, pre-existing static asset); `/books` (224 px slots at 1440 px) 6/20 ≥ 2×, 2 at 1.5–2×, 12 at 1.44–1.49×; detail pages' 288 px main cover 1.08–1.14× on two of three books. Cause: most stored covers are Open Library "-L" files, ~333 px wide (a 40-object sample: 30 between 287 and 351 px, 4 at 575 px from Google). Nothing is grey or visibly blurry, so the verify item is ticked, but the grid is ~1.5× rather than 2× on Retina. Open Library's unsuffixed original (`/b/id/{id}.jpg`) is far larger for the same ids (736–2,592 px wide in a 6-cover probe) — recorded as the recommended next task. (2) Month-to-date egress is only visible in the Supabase dashboard (no SQL/CLI surface); storage size was recorded, egress is for the user to read off. (3) Playwright MCP failed to connect this session; the check ran through a scratchpad Playwright install + system Chrome instead.
- Issues encountered: every production page logs one console 403 — the Sentry envelope POST to `ingest.de.sentry.io`, the known DSN/ingest issue on the user's list (see memory `vercel-env-pasted-newlines`), unrelated to this plan. First full-suite run of the session had one flaky `quick-rating.test.tsx` timeout under parallel load; the Task 9 run was fully green.

**Status:** [x] COMPLETE

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| **Open Library original-size covers (recommended next)** | The pipeline fetches Open Library's `-L.jpg` (max 500 px tall, ~333 px wide), so 3,454 stored covers render at ~1.5× in the 224 px Browse grid and ~1.1× on the 288 px detail cover at DPR 2. The unsuffixed original `covers.openlibrary.org/b/id/{id}.jpg` is 736–2,592 px wide for the same ids. Fix: add the original as the first Open Library candidate in `lib/covers/pipeline.ts` (keep the ≤ 800 px resize), then `covers:process --force` limited to `cover_source = 'openlibrary'` (~3,454 rows, ≤ 2 req/s ≈ 30–40 min, ~1 GB of Open Library downloads, bucket grows from 179 MB towards ~350 MB — still under the 1 GB free tier). Re-run the DPR-2 check afterwards | Next task, before public launch |
| Goodreads / Amazon data | No public API since 2020; scraping breaks ToS | Never |
| NYT cover re-sourcing (1,323 rows with `cover_source = 'other'`) | The NYT API terms (read 2026-09-06) are non-commercial only, forbid deriving income from the APIs and forbid caching API content beyond 24 h; the importer offered the NYT `book_image` as the first candidate and it won for 1,323 books, so those stored covers are copies of NYT CDN images. Fix: a `covers:process --force` pass limited to `cover_source = 'other'` (needs a `--source` filter flag) with the NYT URL excluded from the candidate list, so Open Library / Google supply the replacement; rows with no passing replacement drop to NULL. Also stop calling the NYT API from any future refresh job and keep the NYT name out of the UI (the rows carry only a generic "Bestseller" tag) | Before public launch, after Task 9 |
| 20k+ broad Open Library dump | Tried Dec 2025 (`scripts/archive/seed-books.ts`), replaced for quality; user chose 5k curated | If users ask for missing titles often |
| Series / editions model | Product feature G8 in `next-steps-2026-09-04.md` | Product plan |
| Bestseller badge / NYT rank in UI | Data lands in `genres` as "Bestseller"; UI is a separate design decision | After launch |
| Non-English catalogue | All sources filtered to English | If the audience needs it |
| Upgrading Supabase plan for storage/egress | Free tier fits ~5k covers; decide after a month of real traffic | October 2026 |
| Re-picking covers for the old 699 by newest edition | Pipeline picks the sharpest of the known candidates; edition choice needs the series/editions model | With G8 |
| Detail-page cover `sizes` attribute (says 200px, renders 288px) | Pre-existing; the chosen `next/image` slot is 384 px, slightly under 2x at DPR 1.5. Separate one-line UI fix | Task 9 or after launch |
| Placeholder instead of a small real cover for the 34 no-candidate books | Today they render the < 300 px Open Library scan through the old chain (correct book, soft). Showing the gradient placeholder instead needs a renderer rule (e.g. a `cover_source` marker) and is a taste decision | User decision, after Task 5 |
| `revalidateTag(CACHE_TAGS.books)` after a script run | Browse's popular list is an hour-long `unstable_cache`; nothing revalidates it after `covers:process` / the imports, so new covers appear on `/books` up to an hour late. A tiny admin route or a deploy-time hook would fix it | With Task 4/5 if the delay bothers |
| Square picture-book covers | ~150 NYT picture books have 1:1 covers and fail the pipeline's 0.55–0.85 aspect rule, so they have no stored cover. Allowing a wider aspect for the Children genre (or padding to 2:3) is a pipeline rule change | After Task 5, with the placeholder decision above |
| ~~Genre vocabulary clean-up~~ | Promoted to Task 8 on 2026-09-06: the Browse chips list all 7,141 distinct strings alphabetically, so the noise is on the first screen | Task 8 |
| Description gap: 428 rows (7.7 %) without a description vs the 5 % target | Task 6's enrichment ran keyless and Google Books' anonymous daily quota hit 429 partway through (swallowed as "no result"); Open Library work records were probed and carry a description for only 11 of the 417 rows with a work id. 378 of the 428 have an ISBN. Fix: add `GOOGLE_BOOKS_API_KEY` to `.env.local` (free, 1,000/day) and re-run `npm run enrich-books -- --limit 5000` | User decision 2026-09-06: later, once a Google key exists |
| NYT monthly lists and one-week titles | `--min-weeks` defaults to 4 (top-up run at 3); mass-market, YA/middle-grade paperback monthly and the 2016-17 topical lists report 0 weeks and are out. `npm run import:nyt -- --min-weeks 0` (or `--lists …`) adds them, ~3,700 more titles | If the catalog feels thin after Task 5 |
| Same work under two NYT titles | 10 titles ("Oppenheimer"/"American Prometheus", "Becoming: Adapted for Young Readers") share an Open Library work id with an existing row and are skipped by the unique index; a series/editions model would hold them | With G8 |
| Award coverage on Open Library | Pulitzer 88, Booker 57, Nebula 62, Women's Prize 2, International Booker 0 rows: OL's award subjects are incomplete. Filling them needs a curated winners list (Wikipedia) rather than a subject query | After launch, if award shelves matter |
| Author-name spelling variants | Open Library author records give "Fiódor Dostoievski", NYT gives "A.J. Finn", the seed gave "Fyodor Dostoevsky": the same author can appear under two spellings across sources, splitting the author page. Dedupe catches title+author collisions, not author-only ones | After launch, with an author-merge tool |
| Translated-title works with an English-titled foreign edition | `workToCandidate` trusts the first English-language edition's title; three junk titles slipped through and were fixed by hand (see Task 5 notes). A stricter rule (require ≥ 2 English editions) would cost recall | If more appear in Task 9's review |
| `books_genres_backup_072` safety copy | Migration 072 rewrote every row's `genres`; the pre-072 arrays sit in `public.books_genres_backup_072` (RLS on, no policies) in case a mapping needs revisiting | Drop in Task 9 after the production check |
| Onboarding taste page offers tags as genres | `/onboarding/taste` builds its picker from `getAllGenres()`, so "Bestseller" and the award tags now appear as taste preferences; use `GENRES` (without `GENRE_TAGS`) from `lib/data/genres.ts` there | After launch, small UI fix |
| Curated lists keyed on non-vocabulary strings | `lib/data/curated-lists.ts` matches "Cozy Mystery", "Women's Fiction", "Books About Books", "Debut", "Book Club" — they had 0–5 books before 072 and 0 after; the other lists still match on a vocabulary genre | With the product plan's curated-list work |
| Admin book form accepts free-text genres | `components/admin/book-form.tsx` lets an admin add any string; it is not run through `normalizeGenres`, so an admin can reintroduce a one-off chip on purpose | If it happens; a `datalist` over `GENRE_VOCABULARY` would guide it |

---

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Typecheck passes (`npm run typecheck`)
- [ ] Tests pass (`npm run test:run`)
- [ ] Feature works as expected (manual test at 2× DPR)
- [ ] No console errors

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-05 | 0 | ✅ Complete | Migration 071 applied (bucket `book-covers` + public read policy); `.env.example` gained NYT/Google keys; scripts confirmed to reach the DB; user added `NYT_BOOKS_API_KEY` to `.env.local` the same day. |
| 2026-09-05 | 1 | ✅ Complete | `lib/covers/pipeline.ts` (collect → fetch/score → pick → store → update row) with 15 unit tests on sharp-generated fixtures; `sharp` pinned as a dependency; `sharp.concurrency(1)` in the test to stop starving other vitest workers. Lint, typecheck, full suite green. |
| 2026-09-05 | 2 | ✅ Complete | `isStoredCover` moved to `lib/utils/covers.ts` (client-safe) and re-exported by the pipeline; stored covers short-circuit both resolvers; bucket host added to `ALLOWED_IMAGE_HOSTS`; live check on Atomic Habits via `/_next/image`, no console errors. |
| 2026-09-05 | 3 | ✅ Complete | `scripts/process-covers.ts` + `covers:process`; 665/699 covers stored (34.7 MB); pipeline gained the zoom-3 placeholder hash, a bytes-per-pixel `low-detail` guard (publisher logos), a height-aware size floor, and forced-run clearing; script gained `--ids` and an Open Library work-cover second pass. `/books` and `/trending` first cards all stored and ≥ 2× at DPR 2. |
| 2026-09-05 | 4 | ✅ Complete | `lib/import/nyt.ts` + `lib/import/insert-book.ts` (helper extracted from the action) + `scripts/import-nyt-bestsellers.ts` (`import:nyt`); 129 cached monthly snapshots 2016-01→2026-09; audio/e-book/series lists and manga volumes excluded, `--min-weeks` staying-power filter (4, top-up at 3); 2,313 bestsellers inserted (catalog 3,012), 2,157 with stored covers, 0 duplicates, 0 raw remote URLs; 108 MB in the bucket. 17 new unit tests; full suite, lint, typecheck green. |
| 2026-09-05 | 5 | ✅ Complete | Shared `scripts/lib/import-core.ts` + `scripts/lib/ol-search.ts`; `import:subjects` (35 subjects + 2 aliases + trending, via `search.json` with English editions) and `import:awards` (9 awards, existing rows tagged); catalog 3,012 → 5,568, every mapped genre ≥ 100, 0 duplicates, 5,139 stored covers (177 MB), 3 junk Open Library rows fixed by hand. Closing `covers:process` pass left running at wrap-up (resumable). Full suite, lint, typecheck green. |
| 2026-09-06 | 6 | ✅ Complete | Leftover cover pass finished (46 more stored, 5,191 total). `import-ratings` ×2 and `enrich-books` patched to page past PostgREST's 1,000-row cap (enrichment no longer writes remote `cover_url`s); 4,416 rows rated → 90.9 % of the catalog; 338 rows enriched (230 descriptions). Browse popular order verified on the dev server. Description gap 7.7 % vs 5 % (Google anonymous quota exhausted; Open Library has nothing) — accepted by the user and deferred to Out of Scope. Task 8 (genre clean-up) added, Final QA renumbered to Task 9. Lint, typecheck green. |
| 2026-09-06 | 7 | ✅ Complete | `importAndAddToShelf` schedules `processBook` via `after()` for new rows only (3 new action tests). Live check with a throwaway account exposed a real bug: the pipeline's User-Agent embedded `NEXT_PUBLIC_SITE_URL` with its pasted CR-LF, so undici rejected every candidate fetch inside Next (`fetch-failed` in 5 ms) — fixed with `headerSafeEnv()` + regression test; second run stored the cover in 20 s. Lint, typecheck green. |
| 2026-09-07 | 8 | ✅ Complete | `lib/data/genres.ts` vocabulary (52 entries, 322 aliases, `normalizeGenres`) shared by migration 072 (generated alias table; 7,141 → 51 distinct strings, 0 empty rows, backup table kept), the importers, enrichment, search-to-add, the API search schema and the AI prompt; `get_distinct_genres()` orders by count. Fixed the pre-existing 400 on every chip outside the old 20-genre list. 9 new tests; lint, typecheck, suite green; Browse verified on dev. |
| 2026-09-07 | 9 | ✅ Complete | Lint, typecheck, 704 tests, build green; SQL totals (5,568 / 93.2 % stored / 0 dups / 416 since 2024); 179 MB bucket; `09660c2` pushed, Vercel READY, production re-checked at DPR 2 (crisp, none grey; grid is ~1.5× because Open Library `-L` covers are ~333 px — original-size pass recorded as the next task); backup table dropped. PLAN FINISHED. |
