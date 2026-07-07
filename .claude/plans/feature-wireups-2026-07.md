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
| 1 | Wire badges + challenges into the shelf flow | 🔴 Critical | Medium | [x] Complete | `lib/actions/books.ts`, `lib/actions/challenges.ts`, `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx` |
| 2 | Reading-progress updates (action + dialog) | 🔴 Critical | Medium | [x] Complete | migration 050, `lib/actions/books.ts`, `components/books/update-progress-dialog.tsx` (new), `components/books/shelf-book-card.tsx` |
| 3 | Club current-read UI | 🟠 High | Medium | [x] Complete | migration 051, `components/clubs/set-current-book-dialog.tsx` (new), `app/(public)/clubs/[slug]/page.tsx`, `lib/actions/clubs.ts` |
| 4 | Route new users into onboarding | 🟠 High | Low | [x] Code Complete* | `app/(auth)/callback/route.ts` |
| 5 | Real stats share button | 🟡 Medium | Low | [x] Complete | `components/stats/stats-highlights.tsx`, `app/(app)/stats/page.tsx` |
| 6 | Final QA | 🔴 Critical | Low | [x] Code Complete* | - |

**Progress: 6/6 complete — PLAN DONE** (*Tasks 4+6: fresh-signup verification requires creating a new account — deferred; everything else verified live)

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
- Files modified: `lib/actions/books.ts`, `lib/actions/challenges.ts`, `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx`
- Approach taken: `addToShelf` runs `syncChallengeProgress()` on EVERY status change (moving out of "read" must recount) and adds `syncUserBadges()` when the new status is "read", via awaited `Promise.allSettled`; returns `newBadges` (additive). `importAndAddToShelf` same wiring, badges not surfaced. `removeFromShelf` syncs challenges only. Both components toast per unlocked badge.
- Deviations from plan: (1) challenges sync on all status changes, not only "read" (downgrades must recount). (2) **Fixed a pre-existing bug in `syncChallengeProgress` itself**: it compared each computed challenge object against ITSELF cast (`challenge.status !== (challenge as ReadingChallenge).status` — always false), so the DB update never ran; the action was a no-op since birth. Now fetches stored rows and diffs computed vs stored. (3) `importAndAddToShelf` is single-book (plan assumed a bulk loop).
- Issues encountered: none after the sync fix. LIVE VERIFIED: marking a book read created `user_badges` rows (`first-book`, `early-adopter`) at the exact click timestamp; challenge `current_value` persisted 0→2→3 across un-read/re-read toggles (recount path proven).

**Status:** [x] COMPLETE

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
- Files modified: `supabase/migrations/050_user_books_reading_progress.sql` (new, user-approved, applied live), `lib/actions/books.ts` (`updateReadingProgress`), `components/books/update-progress-dialog.tsx` (new), `components/books/shelf-book-card.tsx` (progress block + dialog), `types/database.generated.ts` (regenerated)
- Approach taken: **The plan's premise was stale — the columns did NOT exist in the live DB** (proven during the generated-types plan). Migration 050 added `current_page`/`total_pages`/`progress_percentage` (nullable + CHECK constraints). Action validates UUID/int/range, resolves effective total (`param ?? user_books.total_pages ?? books.page_count`), clamps, computes pct, updates only `status='reading'` rows. Card shows a click-to-edit progress bar for reading books (mount-fresh inner form to satisfy the React 19 `set-state-in-effect` lint rule).
- Deviations from plan: migration required (plan said none needed); the progress block was re-added, not modified (it was removed in the types plan as it referenced phantom columns).
- Issues encountered: initial dialog used effect-driven input seeding → lint error under React 19 rules; fixed via conditional-mount pattern. LIVE VERIFIED: page 50/300 → 17% renders + persists across reload; page 999 → clamps to 300/100%; want-to-read/read cards have no progress affordance (server also enforces via status filter).

**Status:** [x] COMPLETE

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
- Files modified: `supabase/migrations/051_fix_club_members_rls_recursion.sql` (new, user-approved, applied live), `components/clubs/set-current-book-dialog.tsx` (new, self-contained trigger+dialog), `app/(public)/clubs/[slug]/page.tsx` (mounted in header + empty state, admin-only), `lib/actions/clubs.ts` (`setCurrentBook` accepts optional `clubSlug`, revalidates detail path)
- Approach taken: debounced (300ms) autocomplete dialog per plan. **Prerequisite fix shipped first: migration 051** — the deferred `book_club_members` RLS recursion (42P17) crashed member lists AND would have broken `setCurrentBook`'s admin check; dropped the self-referencing SELECT policy (a helper-based replacement already existed), added `is_club_admin()` SECURITY DEFINER helper, recreated the DELETE policy which also had a tautology (`bcm.club_id = bcm.club_id`) authorizing any admin to delete memberships in ANY club.
- Deviations from plan: migration 051 (RLS fix) pulled into this task from the deferred list — blocking prerequisite.
- Issues encountered: none after the fix. LIVE VERIFIED: member list loads (recursion gone), admin sees both buttons, search→select set "Atomic Habits" as current read and it renders; logged-out club page (earlier session) shows no button.

**Status:** [x] COMPLETE

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
- Files modified: `app/(auth)/callback/route.ts`
- Approach taken: exactly as planned — `destination` variable; branch 1 (profile created inline) → `/onboarding/taste` when redirect is the default; branch 2 (existing profile, within the 5-minute new-account window) → one `user_taste_profiles.onboarding_completed` maybeSingle query, route to onboarding when incomplete. Explicit `?redirect=` never overridden. Completion column confirmed as `onboarding_completed` (lib/actions/taste.ts:138).
- Deviations from plan: none.
- Issues encountered: **VERIFICATION DEFERRED — fresh-signup test requires creating a new account, which the assistant cannot do**. Note: the callback route only runs on OAuth/email-confirmation flows; plain email/password logins bypass it entirely, so today's logins could not exercise it. To verify: sign up with a fresh email → should land on `/onboarding/taste`; second login → `/dashboard`; signup with `?redirect=/import` → `/import`.

**Status:** [x] CODE COMPLETE - Verification blocked (fresh-signup test needs a new account; user-approved deferral pattern)

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
- Files modified: `components/stats/stats-highlights.tsx` (share handler + Share2 button replacing "Coming Soon"), `app/(app)/stats/page.tsx` (fetch username, thread additive prop)
- Approach taken: share-button.tsx pattern (navigator.share → clipboard fallback + toast), sharing the public profile URL `/users/{username}`. `/api/og/stats` exists but is referenced by NO page metadata (noted per plan — profile URL shared as-is; wiring the OG image into profile metadata is future work).
- Deviations from plan: none.
- Issues encountered: none. LIVE VERIFIED: `grep "Coming Soon" components/stats/` → nothing; click opens the native Windows share sheet (`navigator.share` exists on desktop Chromium — the accepted verify path; clipboard fallback covers browsers without it, and its error path stayed silent).

**Status:** [x] COMPLETE

## Task 6: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [x] Journey (dev): fresh signup → onboarding wizard → dashboard → add book to reading → update progress to 50% → mark read → badge toast + challenge progress persists → open a club as creator → set current read → `/stats` → share copies URL. (All legs live-verified except fresh-signup — see notes.)

**Verify:**
- [x] All three npm commands exit 0 (tsc also green; lint 0 errors/25 pre-existing warnings; 80/80 tests)
- [x] Journey passes (or `CODE COMPLETE - Verification blocked` with reason) → blocked-in-part, reason below

**Completed Notes:**
- Files modified: none (QA-only)
- Approach taken: single-login journey (email/password on localhost): progress 50/300→17%+persist+clamp ✓, mark read → `user_badges` rows created at click-time ✓, challenge created via UI and `current_value` synced 0→2→3 across status toggles ✓, club member list loads + set-current-read renders "Atomic Habits" ✓, stats share opens native share sheet ✓. **Bonus: this login also closed Plan A's deferred round-trip** (`/login?redirect=/clubs/create` → landed on `/clubs/create`).
- Deviations from plan: journey run on an existing account, not a fresh signup.
- Issues encountered: fresh-signup leg (onboarding routing, Task 4) deferred — account creation required. Badge toasts confirmed indirectly (DB rows at click timestamp; toast expired before snapshot). Test data left in live DB on the `myreadersplatform` account: challenge "Read 5 Books", The Hobbit + Hunger Games now status=read (were reading), club current-read "Atomic Habits", 2 badges — flag to user for optional cleanup.

**Status:** [x] CODE COMPLETE - Verification blocked (fresh-signup leg only; all other legs live-verified)

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

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Feature works as expected (manual test — all legs except fresh-signup)
- [x] No console errors

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-07-07 | 1 | COMPLETE | Badges+challenges wired into shelf flow. Fixed pre-existing no-op bug in syncChallengeProgress (self-comparison). Live: badge rows + challenge sync 0→2→3 verified. |
| 2026-07-07 | 2 | COMPLETE | Migration 050 (progress columns — plan's "no migration" premise was stale). Action+dialog+card UI. Live: 17% render/persist/clamp verified. |
| 2026-07-07 | 3 | COMPLETE | Migration 051 (RLS recursion fix + cross-club delete authz hole — pulled from deferred list as blocking prereq). Dialog wired; live-verified. |
| 2026-07-07 | 4 | CODE COMPLETE | Callback routes new users to /onboarding/taste; explicit redirects preserved. Fresh-signup verification deferred (needs new account). |
| 2026-07-07 | 5 | COMPLETE | Real share button (native share sheet / clipboard); "Coming Soon" gone. og/stats unreferenced by metadata (noted). |
| 2026-07-07 | 6 | CODE COMPLETE | Commands green; journey live-verified minus fresh-signup leg. Plan A round-trip deferral CLOSED via this session's login. PLAN DONE. |
