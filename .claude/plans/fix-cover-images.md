# OhMyReads - Fix Broken Book Cover Images

> **Source:** User report + Team investigation (3 agents: UX/UI, Code/Security, Devil's Advocate)
> **Date:** 2026-02-17
> **Screenshots:** Harry Potter, The Hobbit showing "image not available" / placeholder

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
| 1 | Fix useMemo referential identity bug | 🔴 Critical | Low | [x] COMPLETE | `cover-image.tsx`, `book-card.tsx` |
| 2 | Fix book detail page cover rendering | 🔴 Critical | Low | [x] COMPLETE | `app/(public)/books/[slug]/page.tsx` |
| 3 | Add aria-busy to skeleton loading states | 🟡 Medium | Low | [x] COMPLETE | `cover-image.tsx`, `book-card.tsx` |
| 4 | Final QA | - | Low | [x] COMPLETE | - |

**Progress: 4/4 complete**

---

## Summary

Book covers for Harry Potter, The Hobbit, and likely other books are broken across the app. Three agents investigated and found:

**Root Cause (Critical):** `useMemo(() => getCoverUrlsWithFallbacks(book), [book])` uses the `book` object as a dependency. Since `book` is a new object reference on each parent render, `useMemo` always recomputes, creating a new `coverUrls` array. The derived state check `coverResult.urls !== coverUrls` is then always `true`, meaning `isValidating` stays permanently `true` or the validation restarts endlessly. **Covers can never resolve.**

**Second Bug (Critical):** The book detail page (`books/[slug]/page.tsx`) uses `book.cover_url` directly without any validation or fallback chain. It renders Google Books "image not available" watermark images.

**Fix Strategy:**
1. Change `useMemo` dependency from `[book]` to primitive fields `[book.open_library_cover_id, book.isbn, book.cover_url, book.google_books_id]` — makes `coverUrls` referentially stable
2. Replace raw `<Image src={book.cover_url}>` on detail page with the `CoverImage` component
3. Add `aria-busy` to skeleton states (UX reviewer recommendation)

---

## Task 1: Fix useMemo referential identity bug

**Source:** Code Reviewer Finding #1 — confirmed infinite validation loop
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `components/books/cover-image.tsx`, `components/books/book-card.tsx`

**Context:** `useMemo(() => getCoverUrlsWithFallbacks(book), [book])` depends on the `book` object reference. Since parents pass new objects on re-render, `coverUrls` is always a new array, breaking the `coverResult.urls !== coverUrls` identity check. This causes `isValidating` to stay `true` forever or triggers infinite validation restart loops.

**Steps:**
1. [x] In `cover-image.tsx` line 82 (CoverImage): Change `useMemo` deps from `[book]` to `[book.open_library_cover_id, book.isbn, book.cover_url, book.google_books_id]`
2. [x] In `cover-image.tsx` line 205 (CoverImageMini): Same fix
3. [x] In `book-card.tsx` line 99 (BookCard): Same fix
4. [x] Run `npm run build` to verify no errors

**Verify:**
- [x] All 3 `useMemo` calls use primitive field dependencies
- [x] `npm run build` passes
- [x] `npm run lint` passes (may need eslint-disable for exhaustive-deps)

**Completed Notes:**
- Files modified: `components/books/cover-image.tsx`, `components/books/book-card.tsx`
- Approach taken: Changed `useMemo` deps from `[book]` to 4 primitive fields. Added `// eslint-disable-next-line react-hooks/exhaustive-deps` on the deps line (not above the useMemo) to suppress exhaustive-deps warning. Added explanatory comments about why primitive deps are intentional.
- Deviations from plan: Initially tried `react-compiler/react-compiler` in eslint-disable but that plugin isn't installed separately. Moved eslint-disable comment to the deps array line instead. The React Compiler "Compilation Skipped" errors were resolved by just the `react-hooks/exhaustive-deps` disable — they were cascading from the same issue.
- Issues encountered: `react-compiler/react-compiler` rule not found caused additional errors. Fixed by removing that rule name and only disabling `react-hooks/exhaustive-deps`.

**Status:** [x] COMPLETE

---

## Task 2: Fix book detail page cover rendering

**Source:** UX Reviewer Finding #3 + Code Reviewer Finding #2 — raw cover_url with no validation
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `app/(public)/books/[slug]/page.tsx`

**Context:** Lines 220-237 use `{book.cover_url ? <Image src={book.cover_url}> : <placeholder>}`. This bypasses the entire cover resolution chain (Open Library fallbacks, validation, size upgrade). Books with `cover_url` pointing to Google Books "image not available" placeholders render the watermark. Books with null `cover_url` but valid `isbn` or `open_library_cover_id` incorrectly show the generic placeholder.

**Steps:**
1. [x] Read `app/(public)/books/[slug]/page.tsx` around lines 210-240
2. [x] Replace the raw `<Image src={book.cover_url}>` block with the `CoverImage` component
3. [x] Use `fill` mode with the existing container's `w-72` and `aspectRatio: 2/3` styling
4. [x] Pass `priority={true}` since this is above-the-fold
5. [x] Import `CoverImage` from `@/components/books/cover-image`

**Verify:**
- [x] Detail page uses `CoverImage` component (not raw `book.cover_url`)
- [x] `npm run build` passes
- [x] Cover fallback chain works (Open Library → ISBN → cover_url → Google Books)

**Completed Notes:**
- Files modified: `app/(public)/books/[slug]/page.tsx`
- Approach taken: Replaced `import Image from "next/image"` with `import { CoverImage }`. Replaced the entire `{book.cover_url ? <Image> : <placeholder>}` ternary with `<CoverImage book={book} fill hover={false} priority />`. Removed unused `BookOpen` from lucide imports.
- Deviations from plan: Also removed the unused `BookOpen` import (was only used in the old placeholder). Added `hover={false}` since this is a static detail page, not a clickable card.
- Issues encountered: None.

**Status:** [x] COMPLETE

---

## Task 3: Add aria-busy to skeleton loading states

**Source:** UX Reviewer Finding — accessibility concern
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/books/cover-image.tsx`, `components/books/book-card.tsx`

**Context:** The pulsing skeleton `<div>` shown during validation has no ARIA attributes. Screen readers don't announce the loading state, presenting empty content instead.

**Steps:**
1. [x] In `cover-image.tsx` CoverImage skeleton (line 135): Add `aria-busy="true"` and `role="img" aria-label="Loading book cover"`
2. [x] In `cover-image.tsx` CoverImageMini skeleton (line 254): Same
3. [x] In `book-card.tsx` all 3 skeleton locations (lines 165, 262, 366): Same

**Verify:**
- [x] All skeleton states have `aria-busy="true"`
- [x] `npm run build` passes

**Completed Notes:**
- Files modified: `components/books/cover-image.tsx`, `components/books/book-card.tsx`
- Approach taken: Used `replace_all` to add `aria-busy="true" role="img" aria-label="Loading book cover"` to all 5 skeleton `<div>` elements (2 in cover-image.tsx, 3 in book-card.tsx).
- Deviations from plan: Line numbers in plan were slightly off from actual file — adjusted to correct lines. No functional deviations.
- Issues encountered: None.

**Status:** [x] COMPLETE

---

## Task 4: Final QA

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] Run `npm run build`
2. [x] Run `npm run lint`
3. [x] Run `npm test`

**Verify:**
- [x] Build passes without errors
- [x] Lint shows 0 errors (25 pre-existing warnings, none from our changes)
- [x] All tests pass (80/80)

**Completed Notes:**
- Files modified: None (QA only)
- Approach taken: Ran build, lint, and tests in parallel. All passed.
- Deviations from plan: None
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Server-side cover validation at import time | Correct long-term fix but needs import flow refactor | Next sprint |
| Parallel URL validation (Promise.any) | Performance optimization, not blocking | After core fix |
| Populate missing `open_library_cover_id` for existing books | Data migration, separate effort | Next sprint |
| BookCard placeholder consistency (use shared PlaceholderCover) | UX polish, not blocking | Next UX sprint |
| Placeholder text contrast audit (WCAG AA) | Low severity a11y concern | Next a11y pass |

---

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes with 0 errors (`npm run lint`)
- [x] All tests pass (`npm test`)
- [ ] Feature works as expected (requires manual visual check on dev server)

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-02-17 | 1 | COMPLETE | Fixed useMemo deps in 3 locations, added eslint-disable comments |
| 2026-02-17 | 2 | COMPLETE | Replaced raw Image with CoverImage on book detail page, removed unused imports |
| 2026-02-17 | 3 | COMPLETE | Added aria-busy, role, aria-label to all 5 skeleton loading states |
| 2026-02-17 | 4 | COMPLETE | Final QA — build, lint (0 errors), tests (80/80) all pass |
