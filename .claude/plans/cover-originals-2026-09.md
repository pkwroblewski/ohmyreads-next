# OhMyReads - Sharp Covers: Open Library Original-Size Pass

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
| 1 | Pipeline: original-size Open Library candidates, stop once a winner is ≥ 800 px | 🟠 High | Medium | [x] COMPLETE | `lib/covers/pipeline.ts`, `__tests__/lib/covers/pipeline.test.ts` |
| 2 | `covers:process --source` filter + forced re-run over the Open Library covers | 🟠 High | Medium | [x] COMPLETE | `scripts/process-covers.ts`, `lib/covers/pipeline.ts`, `__tests__/lib/covers/pipeline.test.ts` |
| 3 | Final QA: checks, DPR-2 re-measure, commit, deploy | - | Low | [x] COMPLETE | `.claude/plans/cover-originals-2026-09.md` |

**Progress: 3/3 complete — PLAN FINISHED 2026-09-07**

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

The catalog launch plan's final QA (2026-09-07) measured the served cover pixels against the slot they fill at `deviceScaleFactor: 2`: `/trending` (100 px slots) is fully 2×, but the Browse grid (224 px slots at 1440 px) reaches 2× on only 6 of 20 cards and the detail-page cover (288 px) sits at ~1.1×. The cause is the source, not the pipeline: 3,454 stored covers came from Open Library's `-L.jpg`, which caps the long side at 500 px (~333 px wide), while Open Library's unsuffixed original (`/b/id/{id}.jpg`) is 736–2,592 px wide for the same ids. This plan adds the original as the first Open Library candidate (the pipeline already keeps the widest passing image and resizes to 800 px), stops downloading once a passing candidate is already ≥ 800 px, adds a `--source` filter to the backfill script, re-runs it forced over the Open Library rows, and re-measures. Expected outcome: most Browse cards and detail covers at 2× on Retina, bucket growth from 179 MB towards ~350 MB (free tier is 1 GB).

Constraints: Open Library ≤ 2 req/s with the existing User-Agent; never touch `average_rating`; `cover_url` keeps its `?v=` cache-buster; nothing here changes `genres` or ratings.

---

## Task 1: Pipeline: original-size Open Library candidates, stop once a winner is ≥ 800 px

**Source:** Catalog launch plan > Task 9 Completed Notes / Out of Scope row 1 (user: "do the cover pass", 2026-09-07)
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/covers/pipeline.ts`, `__tests__/lib/covers/pipeline.test.ts`

**Context:** `collectCandidates()` builds the list from importer extras plus `getCoverUrlsWithFallbacks()` (Open Library by id `-L`, by ISBN `-L`, the stored remote URL, Google zoom 3). `pickBest()` takes the widest passing candidate and `storeCover()` resizes to ≤ 800 px, so a larger original wins automatically once it is in the list. `coverIdFromUrl()` only recognises `-[SML].jpg`, so the discovered cover id must also be read off the unsuffixed form. Every candidate is downloaded today; with originals of 1–3 MB in the list, stopping as soon as a passing candidate is ≥ `STORED_COVER_WIDTH` halves the run's downloads without changing any result (width beyond 800 px is discarded by the resize; earlier candidates win ties).

**Steps:**
1. [x] Probe (done in planning): `/b/id/{id}.jpg?default=false` returns the original; record whether `/b/isbn/{isbn}.jpg?default=false` does too and only add the forms that work
2. [x] `collectCandidates()`: for each Open Library `-L.jpg` URL in the chain, push its unsuffixed original first (same query string), then the `-L` as today; dedupe as before
3. [x] `coverIdFromUrl()`: accept `/b/id/{id}.jpg` with or without a size suffix
4. [x] `processBook()`: after scoring a candidate, stop fetching further candidates when it passed and `width >= STORED_COVER_WIDTH` (report the skipped ones as not fetched, or simply omit them)
5. [x] Tests: candidate order with originals first; cover id read off an unsuffixed URL; early stop after a ≥ 800 px pass (later candidate never fetched); an original that fails (404 / too small) falls through to `-L`
6. [x] `npm run lint`, `npm run typecheck`, `npx vitest run __tests__/lib/covers`

**Verify:**
- [x] `collectCandidates({ open_library_cover_id: 15239979, isbn, … })` lists `/b/id/15239979.jpg?default=false` before `/b/id/15239979-L.jpg?default=false`
- [x] Pipeline test file green; lint and typecheck clean
- [x] `npm run covers:process -- --ids <one openlibrary row> --dry-run --verbose` shows the original fetched first, passing at its real width, and no further candidates fetched

**Completed Notes:**
- Files modified: `lib/covers/pipeline.ts` (`openLibraryOriginal()` helper, `pushWithOriginal` in `collectCandidates()` for extras and the chain, `coverIdFromUrl()` accepts the unsuffixed form, early `break` in `processBook()` once a passing candidate is ≥ `STORED_COVER_WIDTH`), `__tests__/lib/covers/pipeline.test.ts` (+4 tests: candidate order with originals, original before an `-M` extra, cover id off an unsuffixed URL, early stop after a 1,600 px pass, fall-through when the original is too small; the existing order test updated). 24/24 green.
- Approach taken: probe first — `/b/id/{id}.jpg?default=false` and `/b/isbn/{isbn}.jpg?default=false` both serve the original (15239979: 736×1104 vs 333×500 for `-L`; the ISBN form for Atomic Habits is only 331×500, i.e. some originals are small and fall through). The original keeps the same query string so a missing one is still a 404. Live dry run on The 48 Laws of Power (`--ids … --dry-run --verbose`): `b/id/15239979.jpg` fetched first and wins at 736×1104.
- Deviations from plan: the early stop is keyed on ≥ 800 px, so for that book (736 px) the `-L` and ISBN candidates were still fetched — by design, since an 800 px Google zoom-3 could still beat 736. Only originals ≥ 800 px short-circuit the run.
- Issues encountered: the Bash heredoc mangled the regex backslashes in the patch (known gotcha); the patch was written to the scratchpad with the Write tool and run from there.

**Status:** [x] COMPLETE

---

## Task 2: `covers:process --source` filter + forced re-run over the Open Library covers

**Source:** Catalog launch plan > Out of Scope row 1
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `scripts/process-covers.ts`

**Context:** `fetchBooksToProcess()` supports `--only-missing`, `--ids`, `--limit`, `--force`, but no way to select rows by `cover_source`. The re-run must cover exactly the 3,454 rows with `cover_source = 'openlibrary'` (the 1,323 `other` rows are the NYT covers, a separate deferral; the 414 `google` rows already come from zoom 3). The run is ~3,454 books × (1 original download, usually ≥ 800 px so the pipeline stops there) at ≤ 2 req/s plus the 500 ms per-book sleep ≈ 35–45 min. Originals are 0.5–3 MB, so expect 3–6 GB downloaded from Open Library over the run and the bucket to grow to ~350 MB.

**Steps:**
1. [x] Add `--source <openlibrary|google|other>` (adds `.eq("cover_source", value)`; document that it is normally paired with `--force` since those rows are already on the bucket)
2. [x] Dry run: `npm run covers:process -- --source openlibrary --force --dry-run --limit 5 --verbose`; confirm the originals win and the reported widths
3. [x] Real run in the background: `npm run covers:process -- --source openlibrary --force > <scratchpad>/covers-originals.log`; monitor with a wakeup/Monitor, not polling
   > **In progress since 2026-09-07 07:13 (local):** background task `bp7chzxtn`, log `<scratchpad>/covers-originals.log`, ~4.8 s/book → ~4.5 h for 3,455 rows. If it is interrupted, resume with `npm run covers:process -- --source openlibrary --force --skip-newer-than 1788757900` (rows already re-stamped by this run are skipped; verified with a dry run). Baseline before the run: openlibrary 3,455 · google 438 · other 1,323 · `cover_url is null` 352 · bucket 179 MB. The dry run also caught a guard bug fixed before the run started: the low-detail bytes-per-pixel test rejected a 1998×3278 original at 0.049; it is now measured at the stored size (800 px, q85, mozjpeg) for oversized images — `bytesPerPixelAtStoredSize()` in `lib/covers/pipeline.ts`, regression test added (25/25).
4. [x] Record the summary: stored / unchanged / cleared / failed, elapsed time
5. [x] SQL: `count(*) where cover_source='openlibrary'` unchanged or higher, rows with `cover_url is null` not increased vs 377 before the run, bucket size from `storage.objects`

**Verify:**
- [x] Dry run shows original-size candidates winning at > 500 px for the 5 sample rows
- [x] Real run finished with 0 rows losing a cover they had (cleared = 0, or each clearing justified in the log)
- [x] A 40-object random sample from the bucket has a median width ≥ 700 px (was 287–351 for 30 of 40)

**Completed Notes:**
- Files modified: `scripts/process-covers.ts` (`--source <openlibrary|google|other>` → `.eq("cover_source")`, `--skip-newer-than <unix>` resume flag that skips rows whose `?v=` stamp is at/after the value, banners for both, usage docs); `lib/covers/pipeline.ts` + test (guard fix, see Issues).
- Approach taken: 5-row dry run, then `npm run covers:process -- --source openlibrary --force` in the background (07:13 → ~11:55 local, ~4.8 s/book — the script's 3 s estimate assumed the early stop would fire more often, but most originals are 400–800 px so every candidate is still fetched). Summary: processed 3,432, rescued by the work cover 110, no candidate 23, failed 0; rejections too-small 539, http-error 428, bad-aspect 177, low-detail 176, placeholder 115, fetch-failed 91, too-large 18. The 22 rows whose stored cover was removed plus the 1 no-candidate row were re-run twice with `--ids --verbose`: first pass restored 15 (transient Open Library errors during the long run), second pass restored the other 7 through the work-cover second pass (its search call had also failed transiently). Net result: `cover_url is null` 352 → 352, stored 5,191 → 5,191, `cover_source = 'openlibrary'` 3,455 → 3,455, 3,454 rows re-stamped, bucket 179 MB → 365 MB (5,191 objects).
- Deviations from plan: none in scope; the plan's `--skip-newer-than` resume flag was added mid-run at the user's request (option 1 + resume insurance) and verified with a dry run, never needed.
- Issues encountered: (1) The first dry run rejected The Catcher in the Rye's 1998×3278 original as `low-detail` (0.049 bytes/px, floor 0.05): large JPEGs of flat-design covers encode far below the ratio the guard was tuned on. `fetchAndScore` now measures oversized images after the same 800 px / q85 / mozjpeg re-encode `storeCover()` applies (`bytesPerPixelAtStoredSize()`); measured 0.102 for that cover vs 0.006 for a flat/logo image, so the 0.05 floor stands. Regression test with a synthetic 2000×3000 flat-design fixture (0.027 raw → 0.07 stored); 25/25 pipeline tests. (2) Open Library returned 404 for several ISBN forms that had worked at import time (e.g. 9780450012495, 9781443441216) — the ISBN→cover mapping moves; the id form and the work-cover search covered every affected row. (3) 40-object random sample of the re-processed covers: min 304, median 800, max 800; 25/40 ≥ 700 px, 26/40 ≥ 448 px (2× of the 224 px grid) — the remaining ~35 % have originals no larger than `-L`.

**Status:** [x] COMPLETE

---

## Task 3: Final QA: checks, DPR-2 re-measure, commit, deploy

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` (no dev server running)
2. [x] DPR-2 measurement (scratchpad Playwright + system Chrome, `createImageBitmap` on `currentSrc`) on production `/`, `/books`, `/trending`, the three detail pages from the launch QA — production serves the new files immediately because the data changed, the code deploy only matters for future runs
3. [x] Commit (pipeline + script + plan), push, confirm the Vercel deployment READY
4. [x] Record bucket size and object count

**Verify:**
- [x] Lint, typecheck, tests, build green
- [x] `/books` first 20 cards: ≥ 16 at 2× (was 6); detail covers ≥ 2× for the sampled books (was 1.08–1.14×)
- [x] No grey / broken covers on the checked pages; console errors unchanged (only the known Sentry 403)

**Completed Notes:**
- Files modified: none beyond this plan; the code went out as `3c867d6` (pipeline, script, tests, plan) plus this close-out docs commit.
- Approach taken: no dev server running; lint and typecheck clean, `npm run test:run` 709 passed / 1 skipped (74 files), `npm run build` clean. DPR-2 measurement on production (scratchpad Playwright + system Chrome, decoded `currentSrc` bitmaps): `/books` 17/20 cards ≥ 2× (was 6/20; the 3 below are 322–333 px originals no larger than `-L`), `/trending` 24/24, home 20/21 (hero webp unchanged), Harry Potter detail cover 7/7 ≥ 2× (was 1.14×), Think and Grow Rich 7/7, Talons of Power main cover still 1.08× — its stored file is an NYT-sourced `other` cover, outside this plan (see Out of Scope). Pushed `3c867d6` 15:30 local; Vercel `dpl_B6P3YeM9p8TGz2z4RMxeFk9KmdDq` READY 15:32:48. Bucket after the plan: 5,191 objects, 365 MB.
- Deviations from plan: none.
- Issues encountered: the only console errors on production are the known Sentry ingest 403s (two on the Talons page, one elsewhere), unrelated.

**Status:** [x] COMPLETE

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| NYT covers (`cover_source = 'other'`, 1,323 rows) | Separate deferral from the launch plan: those files are NYT CDN copies and must be replaced with Open Library / Google sources, not just upscaled; the `--source other` run should exclude the NYT URL from the candidates first | Before public launch, own plan |
| Google covers (`cover_source = 'google'`, 414 rows) | Already zoom-3 (≈ 575–800 px); no larger Google size exists | Never |
| Rows with no stored cover (377) | The launch plan's "34 no-candidate books" plus the square picture books; needs the aspect-rule / placeholder decision | With the placeholder decision |
| Home hero image at 1.39× | Static `public/images/hero.webp` served at 2000 px into a 1440 px slot; a 2880 px export is a one-line asset swap | After this plan |
| `revalidateTag(CACHE_TAGS.books)` after the run | Browse's popular list is cached for an hour, so the new `?v=` URLs show up to an hour late | Only if the delay matters on the day |

---

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Typecheck passes (`npm run typecheck`)
- [x] Tests pass (`npm run test:run`)
- [x] Feature works as expected (DPR-2 measurement on production)
- [x] No console errors beyond the known Sentry 403

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-07 | 1 | ✅ Complete | Originals (`/b/id/{id}.jpg`, `/b/isbn/{isbn}.jpg`) precede every Open Library `-L` candidate; cover id read off the unsuffixed form; run stops at the first passing ≥ 800 px candidate. 4 new tests; lint/typecheck clean; dry run shows 736×1104 beating 333×500. |
| 2026-09-07 | 2 | ✅ Complete | `--source` + `--skip-newer-than` flags; low-detail guard measured at the stored size (Catcher in the Rye 1998 px original was being rejected); forced run over 3,455 Open Library rows in ~4.7 h, 0 failed; 23 transient losses restored with two `--ids` retries; totals unchanged (352 null / 5,191 stored), bucket 179 → 365 MB; sample median width 333 → 800. |
| 2026-09-07 | 3 | ✅ Complete | Lint, typecheck, 709 tests, build green; production at DPR 2: `/books` 17/20 cards ≥ 2× (was 6/20), Harry Potter detail 2× (was 1.14×); `3c867d6` pushed, Vercel READY; bucket 365 MB / 5,191 objects. PLAN FINISHED. |
