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
| 1 | Fix community lists 404 + add list-management UI | 🔴 Critical | High | [ ] Pending | `app/(public)/lists/[slug]/page.tsx`, `lib/actions/lists.ts`, 2 new components |
| 2 | Fix `/@username` 404 links on dashboard | 🔴 Critical | Low | [ ] Pending | `components/dashboard/friends-activity.tsx` |
| 3 | Fix dead links: `/admin/reports`, `/lists/curated` | 🟠 High | Low | [ ] Pending | `app/(app)/admin/page.tsx`, `app/(public)/lists/page.tsx` |
| 4 | Auth-redirect consistency (returnTo everywhere) | 🟠 High | Low | [ ] Pending | `components/clubs/join-button.tsx`, `app/(app)/layout.tsx`, `proxy.ts` |
| 5 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/5 complete**

## Summary

Three parallel product audits (2026-07-07) found outright-broken user flows shipping in production: every user-created list 404s (the detail route only resolves curated slugs while all links use UUIDs), the dashboard friends-activity feed links to a non-existent `/@username` route, two nav links point at routes that don't exist, and login redirects lose the user's destination in several paths. This plan fixes all Tier-1 breakage. Execute BEFORE `feature-wireups-2026-07.md` and `navigation-ia-2026-07.md`.

## Task 1: Fix community lists 404 + add list-management UI

**Source:** Navigation audit 2026-07-07 — top-ranked finding: "All community/user-created lists 404"
**Priority:** 🔴 Critical
**Effort:** High
**File(s):** `app/(public)/lists/[slug]/page.tsx`, `lib/actions/lists.ts`, `components/lists/community-list-view.tsx` (new), `components/lists/list-book-manager.tsx` (new), `app/(public)/lists/page.tsx` is NOT touched here (its dead link is Task 3)

**Context:** `app/(public)/lists/[slug]/page.tsx` resolves only curated static lists via `getCuratedListWithBooks(slug)` and calls `notFound()` otherwise. But `components/lists/list-card.tsx:14` links `/lists/${list.id}` (UUID) and `app/(app)/lists/create/page.tsx:48` pushes `/lists/${result.listId}` (UUID). So a user creates a list, gets redirected to it, and sees a 404. `lib/queries/lists.ts:165` already has `getListById()` — visibility enforcement, owner join, ordered books — with ZERO callers. Also: after creating a list, there is NO UI anywhere to add books to it (`addBookToList` at `lib/actions/lists.ts:142` has no UI caller). UUID routing is correct permanently: the `reading_lists.slug` column is only `UNIQUE(user_id, slug)` (migration `026_reading_lists.sql`), so a bare slug cannot uniquely resolve a community list. Curated slugs are kebab-case words (`lib/data/curated-lists.ts`) — a UUID regex can never collide.

**Steps:**
1. [ ] Read fully: `app/(public)/lists/[slug]/page.tsx`, `lib/queries/lists.ts` (esp. `getListById` at :165 and its return type), `lib/actions/lists.ts`, `components/lists/list-card.tsx`, `components/search/unified-search.tsx:53-99` (the debounce+autocomplete pattern to copy).
2. [ ] In `app/(public)/lists/[slug]/page.tsx` add at module level:
   ```ts
   const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   ```
   In BOTH `generateMetadata` and the page component: if `UUID_RE.test(slug)` → fetch via `getListById(slug)`; `null` result → `notFound()` (handles private lists viewed by strangers — `getListById` already enforces visibility); render `<CommunityListView ... />`. Else: existing curated path, byte-for-byte untouched. Do NOT emit the curated JSON-LD for community lists; emit ItemList JSON-LD only when `visibility === "public"` (or skip entirely for v1 — note choice). Leave `generateStaticParams` unchanged (curated slugs only; `dynamicParams` defaults to true so UUIDs pass through).
3. [ ] Create `components/lists/community-list-view.tsx` (server-compatible): header with title, description, owner (reuse the owner avatar/name row markup from `list-card.tsx`, linking `/users/{username}`), book count, then a simple responsive grid of cover+title cards each linking `/books/{book.slug}`. Use the exact shape `getListById` returns — do NOT widen the query to satisfy the full `BookCard` prop type.
4. [ ] Create `components/lists/list-book-manager.tsx` (`"use client"`), rendered by `CommunityListView` when the viewer is the owner (pass `isOwner` computed in the page from the authed user):
   - Add-book search input: debounced fetch to `/api/books/autocomplete?q=` (copy the debounce/dropdown/keyboard pattern and `BookSuggestion` type from `unified-search.tsx:53-99`); selecting a book calls `addBookToList(listId, bookId)` (`lib/actions/lists.ts:142`) then `router.refresh()` + success toast (Sonner, as used elsewhere).
   - A remove (X) button on each book row → `removeBookFromList` → `router.refresh()`.
   - For non-owners: render the like button wired to `likeList` (check `lib/actions/lists.ts` for the exact export name and current like-state source from `getListById`).
5. [ ] In `lib/actions/lists.ts`: `addBookToList` and `removeBookFromList` currently only `revalidatePath("/lists")` — add `` revalidatePath(`/lists/${listId}`) `` to both.
6. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `grep -n "getListById" app/(public)/lists/[slug]/page.tsx` matches (dead code now wired)
- [ ] Dev test: log in → `/lists/create` → create a list → redirected detail page renders (NOT 404)
- [ ] Dev test: add a book via the search UI → appears; remove it → disappears
- [ ] Dev test: open a curated list (e.g. from `/lists`) → renders exactly as before
- [ ] Dev test: set list private, open its URL logged out / as another user → 404
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Fix `/@username` 404 links on dashboard

**Source:** Journey audit 2026-07-07 — friends-activity feed links break on the home screen
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `components/dashboard/friends-activity.tsx`

**Context:** Lines 83, 119, 128 build `href={`/@${activity.username}`}`. No `/@[username]` route or rewrite exists anywhere (`next.config.ts` has none). Every other component uses `/users/${username}` (~30 sites).

**Steps:**
1. [ ] In `components/dashboard/friends-activity.tsx`, replace every `` `/@${...}` `` href with `` `/users/${...}` `` (expect 3 occurrences at lines ~83, ~119, ~128 — fix ALL occurrences found, not just three).
2. [ ] Run `npm run lint`.

**Verify:**
- [ ] `grep -rn '"/@\|`/@' components/ app/` returns nothing
- [ ] Dev test: dashboard → click a name/avatar in Friends Activity → lands on `/users/{username}` profile
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Fix dead links — `/admin/reports` and `/lists/curated`

**Source:** Navigation audit — links target routes with no `page.tsx`
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/(app)/admin/page.tsx`, `app/(public)/lists/page.tsx`

**Context:** `admin/page.tsx:342` links `/admin/reports` — no such page exists (admin has: analytics, books, enrichment, import, logs, moderation/books, moderation/places, reviews, submissions, users). `lists/page.tsx:153` "View all curated lists" links `/lists/curated`, which hits the `[slug]` route with slug `"curated"` → 404 unless a curated list has that literal slug (check `lib/data/curated-lists.ts` — it does not).

**Steps:**
1. [ ] In `app/(app)/admin/page.tsx:342` area: read the card's label/intent. Point it to the closest existing page (`/admin/moderation/books` for content reports) OR remove the card entirely if no existing page matches its intent. Record the choice.
2. [ ] In `app/(public)/lists/page.tsx:153` area: the curated lists already render on this same page — change the link to an in-page anchor (`href="#curated"` + add `id="curated"` on the curated section heading) OR remove the link. Record the choice.
3. [ ] Whole-app dead-link audit (recorded as evidence): run this and manually reconcile any suspicious internal hrefs against `app/**/page.tsx` routes:
   ```bash
   grep -rhoE 'href="/[a-z0-9/_-]+"' app/ components/ --include="*.tsx" | sort -u
   ```
   List any OTHER dead internal links found in Completed Notes (fix trivial ones; defer non-trivial ones explicitly).
4. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `grep -rn "admin/reports" app/ components/` returns nothing
- [ ] `grep -rn "lists/curated" app/ components/` returns nothing
- [ ] Dead-link audit output reconciled in Completed Notes
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 4: Auth-redirect consistency (returnTo everywhere)

**Source:** Navigation audit — inconsistent returnTo; proxy protected-route list incomplete
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `components/clubs/join-button.tsx`, `app/(app)/layout.tsx`, `proxy.ts`

**Context:** Three inconsistencies: (a) `join-button.tsx:35` sends logged-out users to `/login?redirect=/clubs` — losing WHICH club; (b) `app/(app)/layout.tsx:36` redirects to `/login` with no `redirect` param at all (while `proxy.ts:100-102` correctly preserves it); (c) `proxy.ts:5-16` protectedRoutes omits `/friends`, `/profile/edit`, `/clubs/create`, `/lists/create`, `/books/new` — those rely solely on the layout fallback that drops returnTo. Reference for the correct pattern: `components/books/add-to-shelf-button.tsx` (redirects to `/login?redirect={pathname}`).

**Steps:**
1. [ ] `components/clubs/join-button.tsx`: add a `clubSlug: string` prop; change the redirect to `` router.push(`/login?redirect=/clubs/${clubSlug}`) ``. Update its call site in `app/(public)/clubs/[slug]/page.tsx` to pass the slug.
2. [ ] `proxy.ts`: add `"/friends"`, `"/profile/edit"`, `"/clubs/create"`, `"/lists/create"`, `"/books/new"` to the protectedRoutes array (`:5-16`). EDGE CASE: check how matching works (exact vs prefix) — `/profile/edit` must not accidentally double-protect or conflict with a `/profile` entry if prefix-matched; verify `/clubs/create` (protected) does not catch public `/clubs` (it won't under prefix matching of the longer path, but confirm and note).
3. [ ] `app/(app)/layout.tsx:36`: layouts cannot read the pathname directly in Next.js App Router. With step 2 done, the proxy (which CAN read pathname and preserves `?redirect=`) covers every (app) route, so the layout redirect is only a defense-in-depth fallback. Verify the proxy list now covers ALL directories under `app/(app)/` (list them: `ls app/(app)/`); add any still missing. Leave the layout's plain `/login` redirect as-is but add a one-line comment: `// Fallback only — proxy.ts handles redirect-preserving auth for all (app) routes`.
4. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] Dev test logged out: visit `/clubs/create` → login page URL contains `redirect=%2Fclubs%2Fcreate` (or unencoded equivalent) → after login, land on `/clubs/create`
- [ ] Dev test logged out: on a club page click "Sign in to join" → after login, land on THAT club's page
- [ ] Every directory under `app/(app)/` appears in proxy.ts protectedRoutes (enumerated in Completed Notes)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 5: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [ ] Full journey (dev): create list → open it → add 2 books → remove 1 → dashboard → click friend in activity → profile loads → logged-out `/clubs/create` round-trips through login back to `/clubs/create`.

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
| Community list edit (rename/description/visibility) UI | Add/remove books is the critical gap; full edit is enhancement | Lists v2 |
| List reordering (drag books) | Enhancement | Lists v2 |
| Surfacing user lists on their public profile | Covered conceptually by navigation-ia plan / future | Lists v2 |
| Follow-state aware Follow button for logged-out users (login prompt) | Handled in `navigation-ia-2026-07.md` C5 area or future | Plan C |

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
