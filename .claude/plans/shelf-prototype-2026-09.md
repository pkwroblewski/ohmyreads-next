# OhMyReads - Shelf Design Prototype

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
| 1 | Build the shelf prototype from real catalog data | 🟠 High | Medium | [x] COMPLETE | `.claude/prototypes/shelf/*` |
| 2 | Judge it: user review, then 5–10 real readers | 🟠 High | Low | [x] COMPLETE | - |
| 3 | Decide and update the direction doc and pre-launch plan | 🟡 Medium | Low | [x] COMPLETE | `.claude/docs/design-direction-2026-09.md`, `.claude/plans/design-prelaunch-2026-09.md` |

**Progress: 3/3 complete**

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

`.claude/docs/design-direction-2026-09.md` proposes making book spines on a shelf the site's whole visual system. Its biggest risk is that generated spines look fake and cheap. This plan tests that for about a day of work before anything in the app changes: build a standalone page that renders a realistic reader's three years of reading as shelves of spines, using real catalog books and colours taken from their real covers, then judge it. The test is simple: if you don't want to screenshot it, drop the direction. No app code changes in this plan.

---

## Task 1: Build the shelf prototype from real catalog data

**Source:** Design direction doc > §5 "Risks and cheap validation"  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `.claude/prototypes/shelf/build-data.mjs`, `.claude/prototypes/shelf/books.json`, `.claude/prototypes/shelf/shelf.html`

**Context:** No account on production has a real shelf yet (largest: 3 read books), so the prototype uses a sample reader composed from the catalog: ~70–90 well-known books with covers and page counts, spread across genres and finished dates over 2024–2026. It must be a standalone page (not an app route) so it can be shared privately with readers for feedback without deploying.

**Steps:**
1. [x] Export candidate books (title, author, slug, page_count, genres, cover_url, published_date) with `npx supabase db query --linked` to JSON
2. [x] Pick a varied sample reader (deterministic), assign finished dates across 2024–2026
3. [x] With `sharp`, download each cover, take a spine colour from it and make a small thumbnail (embedded as base64)
4. [x] Build `shelf.html`: one shelf per year, spine width from page count, colour from cover, lettering by genre (Archivo width axis), Literata display type, paper-and-ink UI, ribbon-red accent on the current book
5. [x] Hover/focus tips a spine out and shows the cover and title horizontally; screen-reader labels; list view toggle
6. [x] Include: an empty shelf with bookends ("Room for your first book"), a covers-face-out "want to read" row, a 9:16 share card of the 2025 shelf, dark mode (same room, lights down), reduced motion, 390px mobile
7. [x] Publish as a private artifact; screenshot desktop and mobile

**Verify:**
- [x] Page renders at 1440 and 390 widths, light and dark, with no horizontal page scroll (1440 light + dark, 390 light screenshotted; 390 dark not screenshotted separately, same tokens; `scrollWidth > innerWidth` false)
- [x] Every spine has a readable title on hover/focus, and keyboard focus works (focused spine pulls out, detail bar shows full title, author, pages, genre, date)
- [x] Books with a missing cover still get a sensible spine (all 97 sample books had covers, so tested `spineEl` directly with `color: null` for 5 genres; found and fixed a bug, contrast now 8.2–16.3:1)
- [x] Page size within the artifact limit (16MB) — 863 KB

**Completed Notes:**
- Files modified: new `.claude/prototypes/shelf/build-data.mjs`, `shelf.template.html`, `.gitignore` (ignores `raw.json`, `books.json`, `dist/`). No app code changed.
- Approach taken: 450 candidate books exported from prod; 97 picked by genre quota with a seeded random (88 read across 2024–2026, 1 reading, 8 want-to-read). Spine colour = most prominent saturated colour bucket from the cover's left third (near-black/white only win when dominant); lettering colour = a second cover colour with clear contrast (e.g. gold on black *Circe*), else black/white by luminance. Page: flex-wrap shelves where each line is one shelf tall and a repeating gradient draws the planks, so shelves wrap at any width; titles fitted after fonts load (shrink, then narrow with Archivo's width axis); "I finished it" places the current book on the 2026 shelf with an animation; "Add a book you loved" fills the empty shelf. Rebuild: `node .claude/prototypes/shelf/build-data.mjs`, then inline `books.json` into the template at `/*BOOKS*/[]` → `dist/shelf.html`.
- Deviations from plan: none in scope. Published at https://claude.ai/artifact/LyDCBVZABxZVXtWNjje6jA (private, version 3).
- Issues encountered: (1) first colour pass gave ~25 % near-black spines, fixed with saturation weighting plus lettering colour; (2) sticky hint bar covered shelves in screenshots, changed to a fixed bar that appears only after a spine is pulled; (3) hex genre colours were parsed wrongly, giving light text on light fallback spines, fixed; (4) **known, left for Task 2 review:** 23 of 88 spines still end in "…" at the minimum size (long titles on thin spines, e.g. *Steve Jobs*, Harry Potter titles); (5) catalog genre labels are sometimes wrong (*The Subtle Knife* = Horror, *The 48 Laws of Power* = History), which affects lettering style.

**Status:** [x] COMPLETE

---

## Task 2: Judge it: user review, then 5–10 real readers

**Source:** Design direction doc > §5  
**Priority:** 🟠 High  
**Effort:** Low  
**File(s):** -

**Context:** The prototype only means something if people react to it. The user judges first; then real readers (BookTok/Bookstagram, r/books, StoryGraph users) answer one question.

**Steps:**
1. [x] User reviews the prototype and lists what feels fake or cheap
2. [x] Iterate once on the top issues (if any) — none raised
3. [x] ⚠️ USER ACTION: share the artifact link with 5–10 readers and ask "Would you post this?" — made optional and non-blocking (see notes)
4. [x] Record answers in Completed Notes

**Verify:**
- [x] User's verdict recorded
- [x] At least 5 reader answers recorded (or the user decides to skip) — user chose to proceed without waiting

**Completed Notes:**
- Files modified: this plan only
- Approach taken: user reviewed the prototype on 2026-09-29: "i like it. looks good to me." No fake or cheap spines reported.
- Deviations from plan: reader feedback is no longer a gate. The user said "go" to building now; they may still share the page with readers, and feedback feeds into the build plan as it arrives.
- Issues encountered: known issues from Task 1 (23 truncated titles, some wrong genre labels) carried into the build plan.

**Status:** [x] COMPLETE

---

## Task 3: Decide and update the direction doc and pre-launch plan

**Source:** Plan > Decision  
**Priority:** 🟡 Medium  
**Effort:** Low  
**File(s):** `.claude/docs/design-direction-2026-09.md`, `.claude/plans/design-prelaunch-2026-09.md`

**Context:** Turn the verdict into the next plan: either rework the pre-launch design plan around the shelf (homepage hero, import result, profile shelf, tokens/fonts/logo), or drop the direction and keep the smaller zero-state fixes.

**Steps:**
1. [x] Mark the direction doc Validated or Dropped, with the reasons
2. [x] Rewrite `design-prelaunch-2026-09.md` to match (Task 1 there becomes plain pre-launch cleanup)

**Verify:**
- [x] Both files updated and consistent

**Completed Notes:**
- Files modified: `.claude/docs/design-direction-2026-09.md` (status Approved; name kept, tagline dropped), `.claude/plans/design-prelaunch-2026-09.md` (rewritten as the shelf build plan)
- Approach taken: old pre-launch tasks mapped into the new plan: test-review deletion moved to the launch checklist; Trending "+0", "Readers also enjoyed", curated picks and the empty review state merged into one honesty task; placeholder covers and mobile hero superseded by the new homepage.
- Deviations from plan: none
- Issues encountered: none

**Status:** [x] COMPLETE

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Any change to app code | Prototype decides first | After Task 3 |
| Rendering from the user's own Goodreads CSV | No export on hand; sample reader is enough to judge the look | If the user provides a CSV |
| Satori (`next/og`) share-image spike | Only needed if the direction is validated | Next plan |
| Logo design | Separate design work | Next plan |

---

## Final QA Checklist

- [x] Prototype published privately and opens on desktop and mobile
- [x] No app files changed (`git status` shows only `.claude/` files)
- [x] Verdict recorded and next plan decided

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-29 | - | Created | Plan written after the user approved the shelf direction for prototyping |
| 2026-09-29 | 1 | ✅ Complete | Prototype published privately (v3); 97 real catalog books; 23 spines still truncated, left for review |
| 2026-09-29 | 2 | ✅ Complete | User approved ("looks good to me"); reader feedback optional, not a gate |
| 2026-09-29 | 3 | ✅ Complete | Direction approved; name kept, tagline dropped; build plan written in design-prelaunch-2026-09.md |
| | | | |
