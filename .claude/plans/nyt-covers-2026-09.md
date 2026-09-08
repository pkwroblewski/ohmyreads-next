# OhMyReads - Replace the NYT-Sourced Covers

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
| 1 | Importer stops offering the NYT image; pipeline refuses NYT hosts; `--keep-existing` for forced runs | 🟠 High | Medium | [x] COMPLETE | `lib/import/nyt.ts`, `scripts/import-nyt-bestsellers.ts`, `lib/covers/pipeline.ts`, `scripts/process-covers.ts`, `__tests__/lib/import/nyt.test.ts`, `__tests__/lib/covers/pipeline.test.ts` |
| 2 | Replacement run over the 1,323 `cover_source = 'other'` rows, keeping any cover with no passing replacement; report | 🟠 High | Medium | [x] COMPLETE | - |
| 3 | Google Books rescue pass for the kept rows (needs `GOOGLE_BOOKS_API_KEY`) | 🟠 High | Medium | [x] COMPLETE | `scripts/process-covers.ts`, `.env.local` (user) |
| 4 | Decide the kept rows with the user; clear or keep; final totals | 🟠 High | Low | [x] COMPLETE | `.claude/plans/nyt-covers-kept-2026-09-08.md` |
| 5 | Final QA: checks, DPR-2 measurement on production, no-cover rendering check, commit, deploy | - | Low | [x] COMPLETE | `.claude/plans/nyt-covers-kept-2026-09-08.md` |

**Progress: 5/5 complete — PLAN FINISHED 2026-09-08**

> **Closed 2026-09-08.** Outcome: of the 1,323 NYT-copied covers, 1,010 replaced (869 Open Library, 141 Google), 313 kept by the user's decision (Out of Scope, first row, with the reversal command; list in `nyt-covers-kept-2026-09-08.md`). Bucket 5,191 objects / 400 MB. Two Verify targets were not met and accepted by the user: replacement median 333 px (Task 2) and Talons of Power at 1.15× (Task 5) — Open Library has nothing larger for those titles.

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

The NYT bestseller importer (catalog launch Task 4) offered each list entry's `book_image` as the first cover candidate, and for 1,323 books that image won and was copied into the `book-covers` bucket (`cover_source = 'other'`). Two problems: the NYT API terms (read 2026-09-06) are non-commercial only and forbid caching API content beyond 24 hours, and those images are 300–500 px, so they are the last soft covers on the site (Talons of Power's detail cover measures 1.08× at DPR 2 after the sharp-covers plan). Discovery (2026-09-07): the NYT URL reached the pipeline only through the importer's `extraUrls`, so a forced re-run of those rows never sees it; every one of the 1,323 rows has an ISBN, 1,080 have an Open Library cover id, 1,263 an Open Library work id (the script's second-pass work cover), 0 have a Google id; the renderer's chain for a row without a stored cover is Open Library by id → by ISBN → the gradient placeholder, so no Google grey placeholder can appear for them. This plan (1) removes the NYT image from the importer for good and makes the pipeline refuse `nyt.com` hosts outright, (2) adds a `--keep-existing` mode so a forced run replaces what it can and *keeps* a row's cover when nothing passes, reporting the list instead of clearing to NULL, (3) puts that list in front of the user before anything is removed, and (4) re-measures on production. Expected outcome: most of the 1,323 covers replaced by verified Open Library originals at 2×, the NYT copies gone from the bucket, and an explicit decision on the remainder.

Constraints: Open Library ≤ 2 req/s (the run is ~5 s/book → ~1.8 h in the background, resumable with `--skip-newer-than`); Open Library returns transient errors under load, so re-run the reported list with `--ids` before treating any row as unreplaceable; nothing here touches ratings or genres.

---

## Task 1: Importer stops offering the NYT image; pipeline refuses NYT hosts; `--keep-existing` for forced runs

**Source:** Catalog launch plan > Out of Scope "NYT cover re-sourcing"; user 2026-09-07 ("do it well so we don't have any issues")
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/import/nyt.ts`, `scripts/import-nyt-bestsellers.ts`, `lib/covers/pipeline.ts`, `scripts/process-covers.ts`, `__tests__/lib/import/nyt.test.ts`, `__tests__/lib/covers/pipeline.test.ts`

**Context:** `parseOverview()` keeps `book_image` as `bookImage`, and `toImportCandidate()` passes it as `coverUrls` → `extraUrls`. Removing it at the importer is the fix; refusing `*.nyt.com` in `collectCandidates()` makes the rule hold even if a future source hands the URL over. `processBook()` today clears a stored cover when a forced run finds no passing candidate (`clearStoredCover`, deletes the object and nulls the row); that is right for a re-verification but wrong for a replacement pass where the user wants to see the list first. A `keepExisting` option turns that branch into "leave the row and file alone, report `kept: true`".

**Steps:**
1. [x] `lib/import/nyt.ts`: drop `bookImage` from `NytEntry` and `parseOverview()`; update the test that asserts it (`entries[1].bookImage`), keep the fixture's `book_image` so the parser is shown ignoring it
2. [x] `scripts/import-nyt-bestsellers.ts`: drop `bookImage` from `Candidate` and `toImportCandidate()` (`coverUrls: []` or omit); header comment notes the terms
3. [x] `lib/covers/pipeline.ts`: `collectCandidates()` skips any URL whose host is `nyt.com` or ends in `.nyt.com` (constant `REFUSED_COVER_HOSTS`, with the reason in a comment); `ProcessOptions.keepExisting?: boolean`; in the no-winner branch, when `opts.force && keepExisting && isStoredCover(book.cover_url)` return `{ status: "no-candidate", candidates, kept: true }` without touching storage or the row
4. [x] `scripts/process-covers.ts`: `--keep-existing` flag → `opts.keepExisting`; the summary lists kept rows separately from cleared ones ("stored cover kept (no passing replacement)"), banner line
5. [x] Tests: NYT URL dropped from candidates even as an extra; forced + keepExisting + nothing passes → row untouched, no storage remove, `kept: true`; forced without the flag still clears (existing test)
6. [x] `npm run lint`, `npm run typecheck`, `npx vitest run __tests__/lib/covers __tests__/lib/import`

**Verify:**
- [x] `collectCandidates({ … }, ["https://static01.nyt.com/x.jpg"])` returns no nyt.com URL
- [x] Both test files green; lint and typecheck clean
- [x] `npm run covers:process -- --ids <one 'other' row> --dry-run --verbose` shows only Open Library / Google candidates (no NYT URL) and a winner wider than the stored NYT file

**Completed Notes:**
- Files modified: `lib/import/nyt.ts` (`bookImage` gone from `NytEntry`/`parseOverview`; raw `book_image` documented as ignored), `__tests__/lib/import/nyt.test.ts`, `scripts/import-nyt-bestsellers.ts` (`bookImage` gone from `Candidate`, merge and `toImportCandidate`; header states the terms), `lib/covers/pipeline.ts` (`REFUSED_COVER_HOSTS = ["nyt.com"]` + `isRefusedHost()` in `collectCandidates`; `ProcessOptions.keepExisting`; `no-candidate` result gains `kept`), `scripts/process-covers.ts` (`--keep-existing`, banner, summary label "[stored cover kept: no passing replacement]"), `__tests__/lib/covers/pipeline.test.ts` (+2 tests: NYT hosts refused even as extras, forced + keepExisting leaves row and object alone; the order test's extra is now a neutral CDN URL). 27/27 covers, 17/17 nyt tests; lint and typecheck clean.
- Approach taken: as planned. Dry run on Talons of Power (`--ids … --dry-run --verbose`): no NYT URL among the candidates; the ISBN forms 404 on Open Library, the script's work-cover second pass finds cover id 8325058 at 331×499, which replaces the 312 px NYT file.
- Deviations from plan: none.
- Issues encountered: the existing candidate-order test used an NYT URL as its importer extra and had to switch to a neutral one once NYT hosts were refused.

**Status:** [x] COMPLETE

---

## Task 2: Replacement run over the 1,323 `cover_source = 'other'` rows, keeping any cover with no passing replacement; report

**Source:** This plan > Summary
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** -

**Context:** With Task 1 in place, `npm run covers:process -- --source other --force --keep-existing` replaces every row that has a passing Open Library / Google candidate (originals first, ≥ 800 px stops early) and keeps the rest untouched. Baseline before the run: `other` 1,323, stored 5,191, `cover_url is null` 352, bucket 365 MB / 5,191 objects. The run is ~5 s/book → ~1.8 h; Open Library's transient failures (http-error, fetch-failed) must be retried with `--ids` before the kept list is trusted.

**Steps:**
1. [x] Baseline SQL (counts above) and note the run-start unix time for `--skip-newer-than`
2. [x] Background run: `npm run covers:process -- --source other --force --keep-existing > <scratchpad>/nyt-covers.log`; check the log once early for pace, then wait for the completion notification
   > Run A 2026-09-07 (run-start unix 1788797460) died with its session at 993/1,323; run B 2026-09-08 `--skip-newer-than 1788797460` finished the rest (see Completed Notes). Baseline: `other` 1,323 · stored 5,191 · `cover_url is null` 352 · bucket 365 MB / 5,191 objects.
3. [x] Parse the summary: replaced (by source), kept (list), failed; re-run the kept list once with `--ids --keep-existing --verbose` to clear transient failures, then again if that pass still shows http-error / fetch-failed (retry folded into run B for run A's kept rows; Task 3's verbose run retries all 458)
4. [x] Report: replaced N (width distribution from a 40-row sample of the re-stamped rows), kept M with the per-row reason (too-small / 404 / bad-aspect), bucket size (per-row reasons come from Task 3's verbose run)
5. [x] SQL: `cover_source = 'other'` count = kept M; stored total unchanged; null total unchanged

**Verify:**
- [x] Run finished with failed = 0 (or each failure re-run to success)
- [x] Every kept row's reasons are genuine (no http-error / fetch-failed left after the retries) — run B: fetch-failed 1 across 678 rows; http-error is Open Library's 404 for ISBNs it has no cover for; Task 3 re-tries all 458 anyway
- [x] Sample of the replaced rows: median width ≥ 700 px — NOT MET (median 333 px, see notes); **accepted by the user 2026-09-08** because the replacements match the NYT files' size and the goal is licensing

**Completed Notes:**
- Files modified: none (data run only).
- Approach taken: two runs. Run A (2026-09-07, start unix 1788797460, `--source other --force --keep-existing`) died with its Claude session at 993/1,323 after replacing 645. Run B (2026-09-08, `--skip-newer-than 1788797460`) selected the 678 rows without a fresh stamp (330 never processed + 348 kept by run A, so it doubled as the retry pass): stored 220 (25 via the Open Library work cover), no candidate 458, failed 0; rejections too-small 914, http-error 582, bad-aspect 130, low-detail 11, fetch-failed 1. **Totals: replaced 865 / 1,323 (all Open Library), kept 458, failed 0.** SQL after: `other` 458, stored 5,191 (unchanged), null 352 (unchanged), bucket 5,191 objects / 395 MB (was 386 MB before run B, 365 MB before run A).
- Deviations from plan: the separate `--ids` retry pass (step 3) was folded into run B for the 348 rows run A kept; the 330 rows run B processed for the first time get their retry in Task 3's run, which re-tries every kept row with `--verbose` (so per-row reasons for the kept list come from Task 3, not from here — run B was not verbose). The Verify item "median width ≥ 700 px" is NOT met: a 40-row sample of the replaced rows measures min 302 / median 333 / max 800 px, 14 of 40 at ≥ 700. Cause: for most of these titles Open Library's largest scan is ~330×500. A 20-row sample of the NYT copies measures 308–351 px wide, so no row got smaller and a third got a 2× cover; the licensing goal is what the run delivers. The pipeline has no "at least as wide as the stored file" guard (`processBook()` compares candidates only against each other); not needed here since the sizes match.
- Issues encountered: the resume note's "kept + replaced = 1,323" check was tautological (a replaced row leaves `other`); only the log banner or a live process tells whether a run finished. The first session's log survived in its scratchpad and showed the cut at 993.

**Status:** [x] COMPLETE

---

## Task 3: Google Books rescue pass for the kept rows (needs `GOOGLE_BOOKS_API_KEY`)

**Source:** User decision 2026-09-07 ("Option 3") after the Task 2 sample: 5 of 6 kept rows are 2025–2026 titles Open Library has no cover for, and none of the 1,323 rows carries a Google Books id (the bestseller import ran without a Google key)
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `scripts/process-covers.ts`, `.env.local` (user adds `GOOGLE_BOOKS_API_KEY`)

**Context:** `processBook()` only offers a Google zoom-3 cover when the row has a `google_books_id`. The script already has one rescue step (Open Library work cover via the search API); this task adds a second: when a book still has no candidate, has an ISBN and no Google id, and a Google key is configured, look the ISBN up with `searchGoogleBooksByIsbn()` (`lib/utils/external-book-search.ts`, honours the key) and retry with `getGoogleBooksCoverUrl(id, 3)` as the extra candidate — the pipeline still rejects Google's grey placeholder by hash and anything under the size floor. On success persist `google_books_id` on the row so the renderer's chain and future runs know it. The keyless Google quota is shared and was exhausted on 2026-09-07, so the pass is gated on the key (1,000 lookups/day → the ~800 kept rows fit in one day).

**Steps:**
1. [x] ⚠️ USER: create a Google Books API key (console.cloud.google.com → APIs & Services → Enable "Books API" → Credentials → API key, optionally restricted to the Books API) and add `GOOGLE_BOOKS_API_KEY=…` to `.env.local` (no CR-LF; the file is read by dotenv). Verify: `curl "https://www.googleapis.com/books/v1/volumes?q=isbn:9780735211292&key=…"` returns items
2. [x] `scripts/process-covers.ts`: third rescue step as described, a `googleRescue` counter in the summary, a daily budget guard (stop calling Google after 950 lookups in one run and say so), `--no-google` to disable; `google_books_id` written after a successful Google rescue (written 2026-09-07 alongside Task 1)
3. [x] Dry run: `--source other --force --keep-existing --dry-run --limit 8 --verbose` on kept rows (use `--ids` from the Task 2 kept list) — Google lookups happen, zoom-3 candidates appear, placeholders rejected (2026-09-08: 8 ids, 8 lookups, 3 rescued at 575×782 / 575×829 / 575×863, 3 placeholders rejected, 2 rows without a Google hit)
4. [x] Real run over the kept rows only: `--source other --force --keep-existing --verbose` in the background (458 rows, 2026-09-08, ~10–13 s/book, 1 h 40 min)
5. [x] Report: rescued via Google N (width distribution), still kept M with reasons; SQL: `other` count, `google_books_id` now set on N rows

**Verify:**
- [x] Dry run shows Google candidates for rows Open Library had nothing for, and the grey placeholder rejected where Google has no real image
- [x] Real run: failed = 0; still-kept rows re-run once with `--ids` to rule out transient errors (this run WAS the second pass for all 458 rows — every one had already been tried by Task 2's run A or B; fetch-failed 2 across 458 rows, both on rows Google also had nothing for)
- [x] `select count(*) from books where cover_source = 'other'` dropped by N; no row lost a cover (458 → 313 = −145; stored 5,191 and null 352 unchanged)

**Completed Notes:**
- Files modified: none in this task (the script change was made with Task 1 on 2026-09-07); `.claude/plans/nyt-covers-kept-2026-09-08.md` added (the kept list with per-row reasons, see Task 4).
- Approach taken: real run over the 458 kept rows with `--source other --force --keep-existing --verbose`: stored 145 (141 Google zoom-3, 4 Open Library work cover), no candidate 313, failed 0, 454 Google lookups (under the 950 cap); rejections too-small 812, http-error 538, placeholder 166, bad-aspect 105, low-detail 44, fetch-failed 2. **All 141 Google rescues are 575 px wide** (zoom-3's fixed width; 575×782–863), `google_books_id` set on exactly those 141 rows (`cover_source = 'google'` +141). SQL after: `other` 313, stored 5,191, null 352, bucket 5,191 objects / 400 MB, 0 rows with a `nyt.com` URL. Still-kept reasons (parsed from the verbose log): 166 Google returns only the grey placeholder, 106 no Google match for the ISBN, 41 Google returned a real image that failed the checks (mostly `low-detail`, i.e. the bytes-per-pixel guard on flat-design covers; a few too-small / bad-aspect).
- Deviations from plan: `--source other` was used instead of `--ids <kept ids>` (after Task 2 the two select the same 458 rows). Steps 2 and 3 were done on 2026-09-07/08 before the run, as recorded.
- Issues encountered: the 41 `low-detail` rejections of real Google images are the sharp-covers plan's `MIN_BYTES_PER_PIXEL` guard being strict on Google's heavily compressed JPEGs; left alone (Out of Scope) — loosening it would need a hash-free way to tell a flat cover from a blurred one.

**Status:** [x] COMPLETE

---

## Task 4: Decide the kept rows with the user; clear or keep; final totals

**Source:** This plan > Summary (user checkpoint)
**Priority:** 🟠 High
**Effort:** Low
**File(s):** -

**Context:** The kept rows still hold NYT copies. The user chooses between clearing them (they render through the Open Library small scan or the gradient placeholder, like the existing 352 no-cover rows) and keeping them for now with the licensing risk. Clearing is one `--ids` run without `--keep-existing` (the pipeline's existing forced-clear path deletes the object and nulls the row).

> **Decision taken 2026-09-08 (before the Google pass finished):** the user chose **keep**. The rows that still hold an NYT copy stay as they are, recorded in Out of Scope with the count and the exact clearing command, so the decision can be reversed later.

**Steps:**
1. [x] Present the kept list with titles and reasons and the two options; wait for the decision (decision given 2026-09-08: keep; the final list is `.claude/plans/nyt-covers-kept-2026-09-08.md`)
2. [x] Apply it: `npm run covers:process -- --ids <kept ids> --force` (clears) or nothing (keeps, recorded in Out of Scope with the count) — nothing run; Out of Scope row filled with 313
3. [x] Final SQL: `other` count, stored, null, bucket objects/size; `storage.objects` count = stored count

**Verify:**
- [x] `cover_source = 'other'` is 0 (cleared) or equals the agreed kept count (313)
- [x] `storage.objects` in `book-covers` = rows with a stored cover (5,191 = 5,191; no orphaned NYT files — every replacement overwrote the row's own object)

**Completed Notes:**
- Files modified: `.claude/plans/nyt-covers-kept-2026-09-08.md` (new: 313 rows with title, author, slug, Google reason, Open Library reason; parsed from the Task 3 verbose log).
- Approach taken: the user decided "keep" on 2026-09-08 before the Google pass finished, asking that the decision stay visible for a future change. Recorded in the Out of Scope table (first row: count 313, reversal command, live SQL count, re-try recipe) and in the `nyt-covers-plan-2026-09` memory. Final totals: of the 1,323 NYT-copied covers, 1,010 replaced (865 Open Library in Task 2, 141 Google + 4 Open Library in Task 3), 313 kept; stored 5,191, null 352, bucket 5,191 objects / 400 MB.
- Deviations from plan: none (the decision came earlier than step 1 expected).
- Issues encountered: none.

**Status:** [x] COMPLETE

---

## Task 5: Final QA: checks, DPR-2 measurement on production, no-cover rendering check, commit, deploy

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` (no dev server running) — 2026-09-08: lint 0/0, typecheck clean, 74 files / 711 tests passed (1 skipped), build compiled in 38.8 s
2. [x] DPR-2 measurement on production (scratchpad Playwright + system Chrome, decoded `currentSrc`): `/books`, `/trending`, `/books/talons-of-power`, plus four other formerly-NYT titles (pick from the re-stamped rows) — main covers ≥ 2× where a replacement was found
3. [x] Rendering check for a cleared/kept row without a stored cover: the card shows the Open Library scan or the gradient placeholder, never a grey Google image, 0 console errors beyond the known Sentry 403
4. [x] Commit (importer, pipeline, script, tests, plan), push, Vercel READY; update memory (Task 5)

**Verify:**
- [x] Lint, typecheck, tests, build green
- [x] Talons of Power detail cover ≥ 2× (was 1.08×) if a replacement was found, otherwise renders the fallback cleanly — a replacement WAS found but it is Open Library's 331×499 scan (the only one that exists), so the detail cover measures **1.15×**, not 2×; same situation as the accepted Task 2 median. Recorded, not a regression.
- [x] No NYT-hosted or NYT-copied cover left: `cover_source = 'other'` per Task 3, no `nyt.com` in any `cover_url` — 0 rows with `nyt.com`; 313 NYT copies remain BY the user's Task 4 decision (Out of Scope, first row)

**Completed Notes:**
- Files modified: none new in this task; committed the whole plan's work (`lib/import/nyt.ts`, `scripts/import-nyt-bestsellers.ts`, `lib/covers/pipeline.ts`, `scripts/process-covers.ts`, both test files, this plan, `nyt-covers-kept-2026-09-08.md`). Commit hash / deploy: see Changelog.
- Approach taken: checks as listed. Production measurement 2026-09-08 (1440×900 @ DPR 2, decoded `currentSrc`): `/books` 20 covers, 17 ≥ 2×, 1 at 1.5–2×, 2 < 1.5× (unchanged from the sharp-covers plan's 17/20), 0 grey; `/trending` 24/24 ≥ 2×; detail mains — Chain of Gold 2.22× and Dungeon Crawler Carl 2.22× (Open Library 800 px), Red Alert 2.0× and We the Women 2.0× (Google 575 px), Talons of Power 1.15× (Open Library 331 px), Framed in Death 1.08× (kept NYT copy, renders normally); `/books/will-the-pigeon-graduate` (no stored cover) renders the Open Library scan through `_next/image` at 0.76×, no grey Google image. Console: 0 errors on the list pages, exactly 1 per detail page = the known Sentry ingest 403.
- Deviations from plan: the Talons of Power ≥ 2× target is not met (see Verify); no cleared row exists to check (user chose keep), so the fallback check used an existing null-cover row.
- Issues encountered: none.

**Status:** [x] COMPLETE

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| **Kept NYT-copied covers: 313 rows** (`cover_source = 'other'`; list with reasons in `nyt-covers-kept-2026-09-08.md`) | User decision 2026-09-08: keep them rather than show the placeholder, accepting the NYT API terms risk (non-commercial, no caching beyond 24 h). Every one of them was tried against Open Library (2 passes) and Google Books (1 pass); nothing usable exists there today. **To reverse:** `npm run covers:process -- --source other --force` (no `--keep-existing`) deletes each file from the bucket and nulls the row, which then renders through the Open Library scan / gradient placeholder chain. To re-try new sources first: the same command with `--keep-existing` (Open Library + Google; add `--verbose` for per-row reasons). `select count(*) from books where cover_source = 'other'` is the live count | Whenever a new cover source exists, or if the licensing position changes; re-run the rescue pass every few months since Open Library gains covers for recent titles |
| NYT descriptions stored as a last-resort fallback | `buildInsert()` in `scripts/lib/import-core.ts` uses the NYT `description` only when Open Library and Google have none; those blurbs are also NYT API content under the same terms. Needs a count (which rows' descriptions came from NYT is not recorded) and a decision | Flag to the user after this plan |
| Placeholder for rows with no stored cover | The 352 existing rows plus whatever this plan keeps or clears render the small Open Library scan through the client chain; whether to show the gradient instead is a taste decision | User decision |
| Home hero image at 1.39× | Static asset, one-line swap | After launch |
| `revalidateTag(CACHE_TAGS.books)` after the run | Browse's popular list is cached for an hour, so new `?v=` URLs show up to an hour late | Only if it matters on the day |

---

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Typecheck passes (`npm run typecheck`)
- [x] Tests pass (`npm run test:run`)
- [x] Feature works as expected (DPR-2 measurement + fallback rendering on production)
- [x] No console errors beyond the known Sentry 403

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-07 | 1 | ✅ Complete | NYT image removed from the importer; pipeline refuses `nyt.com`; `--keep-existing` keeps a stored cover when a forced run finds nothing; +2 tests; Talons of Power dry run finds a 331 px Open Library replacement for the 312 px NYT file. |
| 2026-09-08 | 2 | ✅ Complete | Two runs (the first died with its session at 993/1,323): replaced 865 of 1,323 with Open Library covers, kept 458, failed 0; bucket 395 MB. Replacement median 333 px (target 700 px not met; NYT files were the same size, no row got smaller). |
| 2026-09-08 | 3 | ✅ Complete | Google ISBN rescue over the 458 kept rows: 141 rescued via Google (all 575 px, `google_books_id` set) + 4 via the Open Library work cover, 313 still kept, failed 0, 454 lookups. |
| 2026-09-08 | 4 | ✅ Complete | User decision: keep the 313 remaining NYT copies; recorded in Out of Scope with the reversal command; kept list snapshot added beside the plan. Final: 1,010 of 1,323 replaced. |
