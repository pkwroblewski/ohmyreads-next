# OhMyReads - Error & Loading Boundaries

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

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Add 9 `error.tsx` boundaries | 🟡 Medium | Low | [ ] Pending | 9 new files under `app/` |
| 2 | Add 8 `loading.tsx` skeletons | 🟡 Medium | Low | [ ] Pending | 8 new files under `app/` |
| 3 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/3 complete**

## Summary

Only 8 `error.tsx` (incl. root) and 7 `loading.tsx` exist across 56 pages (verified 2026-07-07). Async server-component pages without boundaries fall through to the root boundary on error (losing the app shell context) and navigate with no streaming feedback. This plan adds scoped boundaries to the 9 highest-traffic uncovered segments. Pure additive work — zero existing files change.

**Current inventory (do not re-add these):**
- `error.tsx`: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `(app)/admin`, `(app)/books`, `(app)/dashboard`, `(app)/my-shelf`, `(app)/profile`, `(public)/books`, `(public)/community`
- `loading.tsx`: `(app)/dashboard`, `(app)/my-shelf`, `(public)/books`, `(public)/books/[slug]`, `(public)/community`, `(public)/discover`, `(public)/users/[username]`

## Task 1: Add 9 `error.tsx` boundaries

**Source:** Code-quality audit 2026-07-07 — high-traffic routes without scoped error boundaries
**Priority:** 🟡 Medium
**Effort:** Low
**File(s) (all new):**
`app/(public)/discover/error.tsx`, `app/(public)/clubs/error.tsx`, `app/(public)/lists/error.tsx`, `app/(public)/authors/error.tsx`, `app/(app)/friends/error.tsx`, `app/(app)/challenges/error.tsx`, `app/(app)/stats/error.tsx`, `app/(app)/settings/error.tsx`, `app/(app)/import/error.tsx`

**Context:** `error.tsx` is a Next.js reserved file: it MUST be a client component (`"use client"`) receiving `{ error, reset }`. Copy the existing pattern — do not invent a new design.

**Steps:**
1. [ ] Read `app/(app)/dashboard/error.tsx` in full — this is the template. Note its imports, styling, Sentry/logging calls (if any), and the retry button wired to `reset()`.
2. [ ] For each of the 9 paths, create `error.tsx` as a copy of the template with only the user-facing text adapted per segment (e.g. "Couldn't load clubs" / "Couldn't load your reading stats"). Keep heading + description + Try-again button structure identical.
3. [ ] Segment names for the copy text: discover → "discovery feed", clubs → "clubs", lists → "lists", authors → "authors", friends → "friends", challenges → "challenges", stats → "reading stats", settings → "settings", import → "import".
4. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `Get-ChildItem -Recurse app -Filter error.tsx | Measure-Object` count = 18 (was 9 incl. `global-error.tsx`; +9 new) — or bash: `find app -name "error.tsx" | wc -l` returns 17 plus `global-error.tsx` found separately; record the exact count and reconcile in Completed Notes
- [ ] Each new file starts with `"use client"` — `grep -L "use client"` over the 9 new files returns nothing
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Add 8 `loading.tsx` skeletons

**Source:** Audit — navigations without streaming feedback
**Priority:** 🟡 Medium
**Effort:** Low
**File(s) (all new):**
`app/(public)/clubs/loading.tsx`, `app/(public)/lists/loading.tsx`, `app/(public)/authors/loading.tsx`, `app/(app)/friends/loading.tsx`, `app/(app)/challenges/loading.tsx`, `app/(app)/stats/loading.tsx`, `app/(app)/settings/loading.tsx`, `app/(app)/import/loading.tsx`

**Context:** `loading.tsx` is a plain (server) component shown instantly while the page's async data resolves. Reuse `components/ui/skeleton.tsx` and mirror each page's rough layout so there's no jarring swap.

**Steps:**
1. [ ] Read `app/(app)/dashboard/loading.tsx` and `app/(public)/discover/loading.tsx` — templates for grid-style and list-style skeletons. Read `components/ui/skeleton.tsx` for the primitive.
2. [ ] For each of the 8 paths, glance at the segment's `page.tsx` to pick the closest shape:
   - card grids (clubs, lists, authors, challenges): header skeleton + 6–8 card skeletons in the same grid classes the page uses
   - list/table (friends, import, settings): header + 4–6 row skeletons
   - stats: header + 3–4 chart-block skeletons (`h-64` blocks)
3. [ ] Keep each file under ~40 lines; no `"use client"`, no data fetching, no Mapbox/heavy imports.
4. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `find app -name "loading.tsx" | wc -l` (bash) returns 15
- [ ] `grep -l "use client"` over the 8 new files returns nothing
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [ ] Loading check: `npm run dev`, throttle network in browser devtools (Slow 3G), navigate to `/clubs`, `/stats` — skeletons appear before content.
3. [ ] Error check: temporarily add `throw new Error("boundary test")` at the top of `app/(public)/clubs/page.tsx`'s component, load `/clubs`, confirm the SCOPED boundary renders (app shell still visible, "Couldn't load clubs" text). **Remove the throw immediately after** and re-verify the page loads normally. `git diff` must show page.tsx unchanged at the end.

**Verify:**
- [ ] All three npm commands exit 0
- [ ] Skeletons observed on 2 routes
- [ ] Scoped error boundary observed and test-throw fully reverted (`git status` clean for page.tsx)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Boundaries for every remaining segment (admin subpages, auth pages) | Low traffic; diminishing returns | If errors observed in Sentry |
| `(public)/community/map` loading skeleton | Parent `(public)/community/loading.tsx` already covers the segment tree | Map sprint |
| Per-section Suspense streaming inside pages | Dashboard already does this; extending is a perf task | Perf pass |
| Custom `not-found.tsx` per segment | Root not-found exists; cosmetic | UX pass |

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (manual test)
- [ ] No console errors

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
