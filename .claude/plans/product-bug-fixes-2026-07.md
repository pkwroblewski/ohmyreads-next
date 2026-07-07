# OhMyReads - Product Bug Fixes (Broken Flows)

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
| 1 | Fix community lists 404 + add list-management UI | 🔴 Critical | High | [x] Complete | `app/(public)/lists/[slug]/page.tsx`, `lib/actions/lists.ts`, 2 new components |
| 2 | Fix `/@username` 404 links on dashboard | 🔴 Critical | Low | [x] Complete | `components/dashboard/friends-activity.tsx` |
| 3 | Fix dead links: `/admin/reports`, `/lists/curated` | 🟠 High | Low | [x] Complete | `app/(app)/admin/page.tsx`, `app/(public)/lists/page.tsx` |
| 4 | Auth-redirect consistency (returnTo everywhere) | 🟠 High | Low | [x] Code Complete* | `components/clubs/join-button.tsx`, `app/(app)/layout.tsx`, `proxy.ts` |
| 5 | Final QA | 🔴 Critical | Low | [x] Code Complete* | - |

**Progress: 5/5 complete — PLAN DONE** (*Tasks 4+5: login-dependent verifications deferred to Plan B B4, user-approved 2026-07-07)

## Summary

Three parallel product audits (2026-07-07) found outright-broken user flows shipping in production: every user-created list 404s (the detail route only resolves curated slugs while all links use UUIDs), the dashboard friends-activity feed links to a non-existent `/@username` route, two nav links point at routes that don't exist, and login redirects lose the user's destination in several paths. This plan fixes all Tier-1 breakage. Execute BEFORE `feature-wireups-2026-07.md` and `navigation-ia-2026-07.md`.

## Task 1: Fix community lists 404 + add list-management UI

**Source:** Navigation audit 2026-07-07 — top-ranked finding: "All community/user-created lists 404"
**Priority:** 🔴 Critical
**Effort:** High
**File(s):** `app/(public)/lists/[slug]/page.tsx`, `lib/actions/lists.ts`, `components/lists/community-list-view.tsx` (new), `components/lists/list-book-manager.tsx` (new), `app/(public)/lists/page.tsx` is NOT touched here (its dead link is Task 3)

**Context:** `app/(public)/lists/[slug]/page.tsx` resolves only curated static lists via `getCuratedListWithBooks(slug)` and calls `notFound()` otherwise. But `components/lists/list-card.tsx:14` links `/lists/${list.id}` (UUID) and `app/(app)/lists/create/page.tsx:48` pushes `/lists/${result.listId}` (UUID). So a user creates a list, gets redirected to it, and sees a 404. `lib/queries/lists.ts:165` already has `getListById()` — visibility enforcement, owner join, ordered books — with ZERO callers. Also: after creating a list, there is NO UI anywhere to add books to it (`addBookToList` at `lib/actions/lists.ts:142` has no UI caller). UUID routing is correct permanently: the `reading_lists.slug` column is only `UNIQUE(user_id, slug)` (migration `026_reading_lists.sql`), so a bare slug cannot uniquely resolve a community list. Curated slugs are kebab-case words (`lib/data/curated-lists.ts`) — a UUID regex can never collide.

**Steps:**
1. [x] Read fully: `app/(public)/lists/[slug]/page.tsx`, `lib/queries/lists.ts` (esp. `getListById` at :165 and its return type), `lib/actions/lists.ts`, `components/lists/list-card.tsx`, `components/search/unified-search.tsx:53-99` (the debounce+autocomplete pattern to copy).
2. [x] In `app/(public)/lists/[slug]/page.tsx` add at module level:
   ```ts
   const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   ```
   In BOTH `generateMetadata` and the page component: if `UUID_RE.test(slug)` → fetch via `getListById(slug)`; `null` result → `notFound()` (handles private lists viewed by strangers — `getListById` already enforces visibility); render `<CommunityListView ... />`. Else: existing curated path, byte-for-byte untouched. Do NOT emit the curated JSON-LD for community lists; emit ItemList JSON-LD only when `visibility === "public"` (or skip entirely for v1 — note choice). Leave `generateStaticParams` unchanged (curated slugs only; `dynamicParams` defaults to true so UUIDs pass through).
3. [x] Create `components/lists/community-list-view.tsx` (server-compatible): header with title, description, owner (reuse the owner avatar/name row markup from `list-card.tsx`, linking `/users/{username}`), book count, then a simple responsive grid of cover+title cards each linking `/books/{book.slug}`. Use the exact shape `getListById` returns — do NOT widen the query to satisfy the full `BookCard` prop type.
4. [x] Create `components/lists/list-book-manager.tsx` (`"use client"`), rendered by `CommunityListView` when the viewer is the owner (pass `isOwner` computed in the page from the authed user):
   - Add-book search input: debounced fetch to `/api/books/autocomplete?q=` (copy the debounce/dropdown/keyboard pattern and `BookSuggestion` type from `unified-search.tsx:53-99`); selecting a book calls `addBookToList(listId, bookId)` (`lib/actions/lists.ts:142`) then `router.refresh()` + success toast (Sonner, as used elsewhere).
   - A remove (X) button on each book row → `removeBookFromList` → `router.refresh()`.
   - For non-owners: render the like button wired to `likeList` (check `lib/actions/lists.ts` for the exact export name and current like-state source from `getListById`).
5. [x] In `lib/actions/lists.ts`: `addBookToList` and `removeBookFromList` currently only `revalidatePath("/lists")` — add `` revalidatePath(`/lists/${listId}`) `` to both.
6. [x] Run `npm run lint` and `npm run build`.

**Verify:**
- [x] `grep -n "getListById" app/(public)/lists/[slug]/page.tsx` matches (dead code now wired) → 3 matches
- [x] Dev test: log in → `/lists/create` → create a list → redirected detail page renders (NOT 404)
- [x] Dev test: add a book via the search UI → appears; remove it → disappears
- [x] Dev test: open a curated list (e.g. from `/lists`) → renders exactly as before
- [x] Dev test: set list private, open its URL logged out / as another user → 404
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `app/(public)/lists/[slug]/page.tsx` (UUID branch in generateMetadata + page), `components/lists/community-list-view.tsx` (new, server), `components/lists/list-book-manager.tsx` (new, client — exports `ListBookManager` + `ListLikeButton`), `lib/actions/lists.ts` (detail-page revalidation in add/remove).
- Approach taken: UUID-regex branch → `getListById` (finally wired) → `CommunityListView` with `isOwner` from the authed user. Owner sees row list (cover/title/author/X-remove) + debounced autocomplete add-search (pattern from unified-search, `BookSuggestion` type reused, already-in-list suggestions disabled); non-owner sees static cover grid + like button (auth-error → "Sign in to like lists" toast). Curated path byte-for-byte untouched.
- Deviations from plan: JSON-LD skipped entirely for community lists (plan-sanctioned v1 choice). Owner add/remove UI is a row list rather than reusing the non-owner grid — X-per-row needs client interactivity; grid stays server-rendered for visitors.
- Issues encountered: none in the feature. Dev smoke verified end-to-end via Playwright: create→detail renders (was 404), add "The Hobbit"→appears+count updates, remove→empty state; HTTP checks: private-as-stranger 404, public-as-stranger 200, curated 200, nonexistent UUID 404. One transient hydration warning on first dev-compile of a curated page (PublicLayout, not touched here; clean on reload and on other curated pages). Smoke-test lists deleted from live DB afterwards.

**Status:** [x] COMPLETE

## Task 2: Fix `/@username` 404 links on dashboard

**Source:** Journey audit 2026-07-07 — friends-activity feed links break on the home screen
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `components/dashboard/friends-activity.tsx`

**Context:** Lines 83, 119, 128 build `href={`/@${activity.username}`}`. No `/@[username]` route or rewrite exists anywhere (`next.config.ts` has none). Every other component uses `/users/${username}` (~30 sites).

**Steps:**
1. [x] In `components/dashboard/friends-activity.tsx`, replace every `` `/@${...}` `` href with `` `/users/${...}` `` (expect 3 occurrences at lines ~83, ~119, ~128 — fix ALL occurrences found, not just three).
2. [x] Run `npm run lint`.

**Verify:**
- [x] `grep -rn '"/@\|`/@' components/ app/` returns nothing
- [x] Dev test: dashboard → click a name/avatar in Friends Activity → lands on `/users/{username}` profile (target route `/users/[username]` exists and was loaded successfully in earlier smoke tests; link now points there)
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `components/dashboard/friends-activity.tsx`
- Approach taken: replace_all of `` `/@${activity.username}` `` → `` `/users/${activity.username}` ``. Actual occurrences: 2 (avatar :83, name :120) — the plan's third (:128) was a `/books/` link, not `/@`.
- Deviations from plan: none.
- Issues encountered: none.

**Status:** [x] COMPLETE

## Task 3: Fix dead links — `/admin/reports` and `/lists/curated`

**Source:** Navigation audit — links target routes with no `page.tsx`
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/(app)/admin/page.tsx`, `app/(public)/lists/page.tsx`

**Context:** `admin/page.tsx:342` links `/admin/reports` — no such page exists (admin has: analytics, books, enrichment, import, logs, moderation/books, moderation/places, reviews, submissions, users). `lists/page.tsx:153` "View all curated lists" links `/lists/curated`, which hits the `[slug]` route with slug `"curated"` → 404 unless a curated list has that literal slug (check `lib/data/curated-lists.ts` — it does not).

**Steps:**
1. [x] In `app/(app)/admin/page.tsx:342` area: read the card's label/intent. Point it to the closest existing page (`/admin/moderation/books` for content reports) OR remove the card entirely if no existing page matches its intent. Record the choice.
2. [x] In `app/(public)/lists/page.tsx:153` area: the curated lists already render on this same page — change the link to an in-page anchor (`href="#curated"` + add `id="curated"` on the curated section heading) OR remove the link. Record the choice.
3. [x] Whole-app dead-link audit (recorded as evidence): run this and manually reconcile any suspicious internal hrefs against `app/**/page.tsx` routes.
4. [x] Run `npm run lint` and `npm run build`.

**Verify:**
- [x] `grep -rn "admin/reports" app/ components/` returns nothing
- [x] `grep -rn "lists/curated" app/ components/` returns nothing
- [x] Dead-link audit output reconciled in Completed Notes
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `app/(app)/admin/page.tsx`, `app/(public)/lists/page.tsx`
- Approach taken: (1) Removed the "User Reports" QuickActionCard (+ unused `Flag` import) — no existing admin page matches "flagged content and users"; repointing to moderation/books would mislabel it. (2) The curated slice was the real bug: 14 curated lists exist but only 6 rendered, so "View all" pointed at 8 lists with NO reachable surface. Removed `.slice(0, 6)` (all 14 now render) and deleted the dead "View all curated lists" button; kept `id="curated"` + `scroll-mt-20` on the section for future deep-links. (3) Audit: all 38 static internal hrefs under app/+components/ reconcile against existing `page.tsx` routes — zero dead links remain.
- Deviations from plan: lists fix went beyond link-swap (rendering all curated lists) because the plan's assumption that "the curated lists already render on this same page" only held for 6 of 14.
- Issues encountered: none.

**Status:** [x] COMPLETE

## Task 4: Auth-redirect consistency (returnTo everywhere)

**Source:** Navigation audit — inconsistent returnTo; proxy protected-route list incomplete
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `components/clubs/join-button.tsx`, `app/(app)/layout.tsx`, `proxy.ts`

**Context:** Three inconsistencies: (a) `join-button.tsx:35` sends logged-out users to `/login?redirect=/clubs` — losing WHICH club; (b) `app/(app)/layout.tsx:36` redirects to `/login` with no `redirect` param at all (while `proxy.ts:100-102` correctly preserves it); (c) `proxy.ts:5-16` protectedRoutes omits `/friends`, `/profile/edit`, `/clubs/create`, `/lists/create`, `/books/new` — those rely solely on the layout fallback that drops returnTo. Reference for the correct pattern: `components/books/add-to-shelf-button.tsx` (redirects to `/login?redirect={pathname}`).

**Steps:**
1. [x] `components/clubs/join-button.tsx`: add a `clubSlug: string` prop; change the redirect to `` router.push(`/login?redirect=/clubs/${clubSlug}`) ``. Update its call site in `app/(public)/clubs/[slug]/page.tsx` to pass the slug.
2. [x] `proxy.ts`: add missing routes to protectedRoutes. Matching is exact-or-prefix (`pathname === route || pathname.startsWith(route + "/")`): `/profile` already prefix-covers `/profile/edit` (NOT added — redundant); `/clubs/create` cannot catch public `/clubs` (noted in code comment). Added: `/friends`, `/clubs/create`, `/lists/create`, `/books/new`.
3. [x] `app/(app)/layout.tsx:36`: comment added. Proxy coverage of app/(app)/ verified complete.
4. [x] Run `npm run lint` and `npm run build`.

**Verify:**
- [x] Dev test logged out: visit `/clubs/create` → login page URL contains `redirect=%2Fclubs%2Fcreate` — verified via 307 Location header (all 5 routes; see notes). ⏸ "after login, land on `/clubs/create`" round-trip: DEFERRED (user-approved skip; see below)
- [x] Dev test logged out: on a club page click "Sign in to join" → browser lands on `/login?redirect=/clubs/readers-paradise` (slug preserved). ⏸ "after login, land on THAT club's page" round-trip: DEFERRED (user-approved skip)
- [x] Every directory under `app/(app)/` appears in proxy.ts protectedRoutes (enumerated in Completed Notes)
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `components/clubs/join-button.tsx`, `app/(public)/clubs/[slug]/page.tsx`, `proxy.ts`, `app/(app)/layout.tsx`
- Approach taken: as planned. (app)/ coverage: admin→adminRoutes; books/new, challenges, clubs/create, dashboard, friends, import, lists/create, my-shelf, my-submissions, onboarding, profile (covers profile/edit), settings, stats, submit-book — all in protectedRoutes. Within (app), books/clubs/lists dirs contain ONLY the create pages (browse/detail are (public)), so no over-protection.
- Deviations from plan: `/profile/edit` not added to protectedRoutes (redundant under prefix matching — plan's own edge-case note anticipated this).
- Issues encountered: (1) **DEFERRED VERIFICATION (user-approved 2026-07-07): the two "after login, land back on target" round-trips are unproven** — redirect URLs verified correct on both paths (307 Location headers for all 5 protected routes; join-button browser click shows `?redirect=/clubs/{slug}`), but no email/password login was performed to confirm the login page honors the param. Re-test at next login opportunity (e.g., Plan B onboarding task B4 testing, which requires login anyway). (2) **PRE-EXISTING LIVE BUG found on club pages: `infinite recursion detected in policy for relation "book_club_members"` (42P17)** — members fetch fails on every club page. RLS policy bug, needs a migration; flag for Plan B's club task (B3) or a hotfix. (3) Turbopack dev-server panics (0xc0000142 spawning PostCSS workers) required `.next/dev` cache clear — environment issue, not code.

**Status:** [x] CODE COMPLETE - Verification blocked (login round-trips deferred per user decision)

## Task 5: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [x] Full journey (dev): create list → open it → add 2 books → remove 1 → dashboard → click friend in activity → profile loads → logged-out `/clubs/create` round-trips through login back to `/clubs/create`. (Partially — see notes.)

**Verify:**
- [x] All three npm commands exit 0 (lint 0 errors/25 pre-existing warnings, tests 80/80, build clean)
- [x] Journey passes (or `CODE COMPLETE - Verification blocked` with reason) → blocked-in-part, reason below

**Completed Notes:**
- Files modified: none (QA-only task).
- Approach taken: Commands all green. Journey legs verified individually during task execution rather than as one continuous logged-in walk: create-list→detail→add→remove proven live in Task 1 (Playwright, logged in); `/users/[username]` target route proven rendering in earlier sessions; friend-activity hrefs grep-verified; `/clubs/create` 307+redirect-param proven via headers in Task 4.
- Deviations from plan: journey not walked end-to-end in one session.
- Issues encountered: the continuous journey's login-dependent legs (fresh login → dashboard → click friend link; post-login redirect landing) fall under the user's standing skip-logins decision (2026-07-07) — tracked in the Out of Scope table and in memory (`deferred-verifications-2026-07`), to be closed during Plan B B4 testing which requires a login anyway.

**Status:** [x] CODE COMPLETE - Verification blocked (login-dependent journey legs deferred per user decision; all command checks + logged-out checks pass)

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Community list edit (rename/description/visibility) UI | Add/remove books is the critical gap; full edit is enhancement | Lists v2 |
| List reordering (drag books) | Enhancement | Lists v2 |
| Surfacing user lists on their public profile | Covered conceptually by navigation-ia plan / future | Lists v2 |
| Follow-state aware Follow button for logged-out users (login prompt) | Handled in `navigation-ia-2026-07.md` C5 area or future | Plan C |
| Login round-trip verification (redirect param honored after email/password login) — 2 paths | User-approved skip 2026-07-07; redirect URLs themselves verified | Plan B B4 testing (needs login anyway) |
| Fix `book_club_members` RLS infinite recursion (42P17) — members fetch fails on ALL club pages | Pre-existing live bug found during Task 4 smoke; needs migration | Plan B B3 (club task) or hotfix |

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Feature works as expected (manual test — lists flow fully; login-dependent legs deferred, see Task 5)
- [x] No console errors (except pre-existing club RLS bug, recorded in deferred table)

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-07-07 | 1 | COMPLETE | Community lists 404 fixed (UUID branch → getListById wired), CommunityListView + ListBookManager (add-search/remove/like) created, detail revalidation added. Full dev smoke passed incl. private-list 404 + curated regression. tsc/lint/build green. |
| 2026-07-07 | 2 | COMPLETE | 2 `/@username` hrefs → `/users/`; grep-clean app-wide. |
| 2026-07-07 | 3 | COMPLETE | User Reports admin card removed; curated slice bug fixed (14 lists now all render, dead View-all button removed); dead-link audit: 0 unmatched hrefs. |
| 2026-07-07 | 4 | CODE COMPLETE | Join button carries club slug; 4 routes added to protectedRoutes (all 307+redirect verified via headers). Login round-trips deferred (user-approved) → re-verify during Plan B B4. Found pre-existing club RLS recursion bug (42P17) → deferred table. |
| 2026-07-07 | 5 | CODE COMPLETE | lint/tests(80)/build green. Journey legs verified piecewise during Tasks 1-4; login-dependent legs deferred per user decision. PLAN DONE. |
