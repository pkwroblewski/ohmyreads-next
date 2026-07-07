# OhMyReads - Feature Wire-Ups (Dead Features Shipped as UI)

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

> **ORDER:** Execute after `product-bug-fixes-2026-07.md`. Tasks here are independent of each other.

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Wire badges + challenges into the shelf flow | 🔴 Critical | Medium | [ ] Pending | `lib/actions/books.ts`, `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx` |
| 2 | Reading-progress updates (action + dialog) | 🔴 Critical | Medium | [ ] Pending | `lib/actions/books.ts`, `components/books/update-progress-dialog.tsx` (new), `components/books/shelf-book-card.tsx` |
| 3 | Club current-read UI | 🟠 High | Medium | [ ] Pending | `components/clubs/set-current-book-dialog.tsx` (new), `app/(public)/clubs/[slug]/page.tsx`, `lib/actions/clubs.ts` |
| 4 | Route new users into onboarding | 🟠 High | Low | [ ] Pending | `app/(auth)/callback/route.ts` |
| 5 | Real stats share button | 🟡 Medium | Low | [ ] Pending | `components/stats/stats-highlights.tsx` |
| 6 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/6 complete**

## Summary

The journey audit (2026-07-07) found the app's defining flaw is features scaffolded and DISPLAYED but never wired to the actions that populate them: badges can never unlock (`syncUserBadges` has zero callers — every profile shows "No badges unlocked yet" forever), challenge completion is never persisted (`syncChallengeProgress` uncalled), reading-progress bars render but nothing writes `current_page`, club admins are instructed to "set a current read" with no control for it (`setCurrentBook` has zero UI callers), new users are never routed to the taste onboarding that powers recommendations, and the stats Share button is a fake "Coming Soon" over an already-built OG endpoint. This plan wires each one. **No DB migrations needed** — all columns/actions already exist.

## Task 1: Wire badges + challenges into the shelf flow

**Source:** Journey audit — `lib/actions/badges.ts:9` (`syncUserBadges`) and `lib/actions/challenges.ts:298` (`syncChallengeProgress`) have zero callers; `addToShelf` never triggers them
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `lib/actions/books.ts`, `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx`

**Context:** Both sync actions resolve their own user and do their own `revalidatePath` — call them with no args. MUST `await` (fire-and-forget promises can be frozen when a serverless response returns). `Promise.allSettled` isolates failures so a sync error never breaks the shelf write.

**Steps:**
1. [ ] Read `lib/actions/books.ts` fully; read `lib/actions/badges.ts` (what `syncUserBadges` returns — expect something like `{ newBadges }`) and `lib/actions/challenges.ts:298` onward.
2. [ ] In `addToShelf` (`books.ts:153`, after the `updateReadingStats` call ~line 201): when the (new) status is `"read"`:
   ```ts
   const [challengeResult, badgeResult] = await Promise.allSettled([
     syncChallengeProgress(),
     syncUserBadges(),
   ]);
   const newBadges = badgeResult.status === "fulfilled" ? badgeResult.value?.newBadges ?? [] : [];
   ```
   (Adapt the pluck to the ACTUAL return shape of `syncUserBadges` — read it first.) Import both actions at top.
3. [ ] Same wiring in `importAndAddToShelf` (~line 370) for imported books marked read — but do NOT return badges from the import path (bulk import; toasting dozens of badges is noise). One `Promise.allSettled` AFTER the import loop completes, not per book.
4. [ ] In `removeFromShelf`: `await Promise.allSettled([syncChallengeProgress()])` only (un-reading must recount challenges; badges are one-way — never revoke).
5. [ ] Extend `addToShelf`'s success return to `{ success: true, ...existing, newBadges }` — ADDITIVE only; existing callers reading `success` keep working.
6. [ ] Toast on unlock: in `components/books/shelf-book-card.tsx` `handleStatusChange` (~lines 83-97) and in `components/books/add-to-shelf-button.tsx` where `addToShelf` results are handled: if `result.newBadges?.length`, `toast.success(\`Badge unlocked: ${badge.icon ?? "🏅"} ${badge.name}\`)` per badge (check the badge object's actual field names in `lib/queries/badges.ts`).
7. [ ] Run `npm run test:run` (reviews/comments action tests must stay green) and `npm run build`.

**Verify:**
- [ ] `grep -n "syncUserBadges\|syncChallengeProgress" lib/actions/books.ts` shows both wired in `addToShelf`, `importAndAddToShelf`, `removeFromShelf` (challenges only in the last)
- [ ] Dev test: mark a book "read" → `user_badges` gains a row (check via profile badges section rendering a badge, or Supabase table); active challenge progress persists after page reload
- [ ] Dev test: badge toast appears on first qualifying read
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Reading-progress updates (action + dialog)

**Source:** Journey audit — `shelf-book-card.tsx:184-193` renders `current_page`/`progress_percentage` but NOTHING writes them; shelf empty-state promises "track your progress"
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `lib/actions/books.ts`, `components/books/update-progress-dialog.tsx` (new), `components/books/shelf-book-card.tsx`

**Context:** Columns exist (`user_books.current_page`, `total_pages`, `progress_percentage` — `types/database.ts:62-64`). No migration. The action lives in `books.ts` (same domain, reuse its auth/revalidate idioms).

**Steps:**
1. [ ] Add to `lib/actions/books.ts`:
   ```ts
   export async function updateReadingProgress(bookId: string, currentPage: number, totalPages?: number)
   ```
   - Auth guard copied from `addToShelf`.
   - Validation: `Number.isInteger` on both; `currentPage >= 0`; `totalPages > 0` when provided; hard caps (`currentPage <= 50000`, `totalPages <= 50000`); `bookId` must match the UUID pattern used elsewhere in the file (if the file has Zod schemas by now via the server-actions-hardening plan, add a schema in the same style; otherwise inline checks matching the file's current idiom).
   - Effective total: `totalPages ?? existing user_books.total_pages ?? books.page_count` (fetch the row first). Clamp `currentPage` to effective total when total is known.
   - `progress_percentage = total ? Math.min(100, Math.round((currentPage / total) * 100)) : null`.
   - Update `user_books` SET `current_page, total_pages, progress_percentage, updated_at` WHERE `user_id` AND `book_id` AND `status = 'reading'` — the status filter prevents scribbling on want-to-read/read rows. If 0 rows matched, return `{ error: "Book is not in your currently-reading shelf" }`.
   - If `currentPage === total`: do NOT auto-mark read (explicit user action stays king, v1).
   - `revalidatePath("/my-shelf"); revalidatePath("/dashboard");`
2. [ ] Create `components/books/update-progress-dialog.tsx` (`"use client"`, Radix Dialog — copy structure from the `AddToShelfModal` that `shelf-book-card.tsx` already imports/mounts ~line 297): number input for current page; total-pages input shown ONLY when effective total is unknown; submit → `updateReadingProgress` → toast + close. Props: `bookId`, `currentPage`, `totalPages`, `open`, `onOpenChange`, `onUpdated(page, pct)`.
3. [ ] In `components/books/shelf-book-card.tsx`: make the reading-progress block (lines ~180-197) a button ("Update progress" affordance — pencil icon or click-on-bar with hover state + `aria-label`), opening the dialog. Optimistic local progress state mirroring the existing optimistic-status pattern at lines ~83-97 (apply `onUpdated` immediately, reconcile on refresh).
4. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] Dev test: set a reading book to page 50 of 300 → bar shows 17%, persists after reload
- [ ] Dev test: enter page 999 for a 300-page book → clamps to 300/100%
- [ ] Dev test: action rejects a book on the want-to-read shelf (returns error, no DB change)
- [ ] `grep -n "updateReadingProgress" lib/actions/books.ts components/books/update-progress-dialog.tsx` matches in both
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Club current-read UI

**Source:** Journey audit — club page tells admins "Set a current read to get started!" (`clubs/[slug]/page.tsx:150`) but `setCurrentBook` (`lib/actions/clubs.ts:186`) has zero UI callers; Settings button hard-disabled (`:83`)
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `components/clubs/set-current-book-dialog.tsx` (new), `app/(public)/clubs/[slug]/page.tsx`, `lib/actions/clubs.ts`

**Context:** No reusable book-picker component exists (verified — only page-scale search components). Build a small dialog reusing the `/api/books/autocomplete` endpoint + the debounce/dropdown pattern from `components/search/unified-search.tsx:53-99` (import/copy its `BookSuggestion` type).

**Steps:**
1. [ ] Read `lib/actions/clubs.ts:186` (`setCurrentBook` signature + what it revalidates — currently only `/clubs` at ~line 238) and `app/(public)/clubs/[slug]/page.tsx` (how `isAdmin`/creator is computed).
2. [ ] Create `components/clubs/set-current-book-dialog.tsx` (`"use client"`, ~120 lines): Radix Dialog with a search input → debounced (300ms) fetch `/api/books/autocomplete?q=` → dropdown of cover thumb + title + author → on select, call `setCurrentBook(clubId, book.id)` → success toast → `router.refresh()` → close. Props: `clubId: string`, optional `clubSlug`. Handle: empty results ("No books found — try the full catalog"), fetch error (toast), double-submit (disable while pending).
3. [ ] Mount in `app/(public)/clubs/[slug]/page.tsx`, admin-only, in BOTH places: a "Set current book" button beside the disabled Settings button (~line 83), and a button inside the no-current-read empty state (~lines 148-152). Keep Settings disabled (full club settings = deferred).
4. [ ] In `lib/actions/clubs.ts` `setCurrentBook`: accept optional third param `clubSlug?: string`; when provided, also `` revalidatePath(`/clubs/${clubSlug}`) ``. (The client `router.refresh()` covers the immediate view; revalidate covers other visitors.)
5. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] Dev test: as club creator, open club → "Set current book" visible → search, pick a book → current-read section renders the book
- [ ] Dev test: as non-admin member (or logged-out), no set-current-book button renders
- [ ] `grep -n "setCurrentBook" components/clubs/set-current-book-dialog.tsx` matches (zero-caller action now wired)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 4: Route new users into onboarding

**Source:** Journey audit — `app/(auth)/callback/route.ts:188` always redirects `/dashboard`; `/onboarding/taste` is never reached organically, so recommendations stay cold
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/(auth)/callback/route.ts`

**Context:** All changes in one file. `/onboarding` is already in `ALLOWED_REDIRECTS` (`:14`). The wizard already has "Skip for now" (`components/onboarding/taste-onboarding-wizard.tsx:487`) and the page self-guards when completed (`app/(app)/onboarding/taste/page.tsx:49` → `/dashboard`). The callback has two branches: profile-missing (created inline, lines ~54-165) and profile-exists (~166-186, which already computes `createdAt > fiveMinutesAgo` for the welcome email).

**Steps:**
1. [ ] Read `app/(auth)/callback/route.ts` fully.
2. [ ] Introduce `let destination = redirect;` and `const isDefaultRedirect = redirect === "/dashboard";` near the top of the success path. (If the user explicitly asked for a page — e.g. `?redirect=/import` from the Goodreads hero CTA — NEVER override it.)
3. [ ] Branch 1 (profile just created here): after the reading-stats upsert, `if (isDefaultRedirect) destination = "/onboarding/taste";` — no extra query.
4. [ ] Branch 2 (profile exists): inside the existing `createdAt` recent-account window only, add ONE query: `supabase.from("user_taste_profiles").select("onboarding_completed").eq("user_id", data.user.id).maybeSingle()` — if no row or `!onboarding_completed`, and `isDefaultRedirect`, set `destination = "/onboarding/taste"`. (Check the actual completion column name in `lib/actions/taste.ts` first — use whatever it upserts.)
5. [ ] Change the final redirect (`:188`) to use `destination`.
6. [ ] Run `npm run build`.

**Verify:**
- [ ] Dev test: fresh signup (new email) → after confirm/callback, lands on `/onboarding/taste`
- [ ] Dev test: complete (or skip + complete later) onboarding, log out, log in → lands on `/dashboard`
- [ ] Dev test: signup initiated with `?redirect=/import` → lands on `/import`, NOT onboarding
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 5: Real stats share button

**Source:** Journey audit — `components/stats/stats-highlights.tsx:121-123` renders a prominent "Share Your Reading Stats!" card whose button says "Coming Soon" and does nothing, while `/api/og/stats` already exists
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/stats/stats-highlights.tsx`

**Context:** `components/books/share-button.tsx` already implements the pattern: `navigator.share` when available → clipboard-copy fallback with toast. Copy it, don't reinvent.

**Steps:**
1. [ ] Read `components/books/share-button.tsx` and `app/api/og/stats/route.tsx` (what params it takes) and check how the user's public profile URL is built elsewhere (`/users/{username}`).
2. [ ] Replace the "Coming Soon" button with a working Share button: share `{ title: "My reading stats on OhMyReads", url: <public profile or stats URL> }` via the share-button pattern. Decide URL: if stats have no public page, share the public profile URL `/users/{username}` (whose OG metadata should surface the stats OG image if wired; if `/api/og/stats` is not referenced by any page metadata, note that and share the profile URL as-is — do NOT build a new page in this task).
3. [ ] The component needs the username — check what props `StatsHighlights` receives and thread `username` from `app/(app)/stats/page.tsx` if missing (additive prop).
4. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `grep -rn "Coming Soon" components/stats/` returns nothing
- [ ] Dev test: click Share on `/stats` → clipboard receives a URL (toast confirms) or native share sheet opens
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 6: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [ ] Journey (dev): fresh signup → onboarding wizard → dashboard → add book to reading → update progress to 50% → mark read → badge toast + challenge progress persists → open a club as creator → set current read → `/stats` → share copies URL.

**Verify:**
- [ ] All three npm commands exit 0
- [ ] Journey passes (or `CODE COMPLETE - Verification blocked` with reason)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| In-app notification system (bell, table, triggers) | User decision 2026-07-07: fix marketing copy now (plan C), build later | Dedicated plan |
| Club discussions / meetings / member progress | New feature, needs design | Clubs v2 |
| Auto-mark-read when progress hits 100% | Product decision (explicit action kept, v1) | After usage data |
| Badge revocation on un-read | Badges are one-way by design | Never (documented) |
| Avatar upload (profile edit stub) | Needs Supabase Storage bucket + policies | Separate small plan |
| Account settings section (settings stub) | Needs scope definition (email change? password? delete account?) | Separate plan |
| DB triggers as alternative badge/challenge mechanism | Action-level wiring is simpler and testable; triggers duplicate logic | If action path proves unreliable |

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
