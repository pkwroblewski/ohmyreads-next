# OhMyReads - Navigation, IA & Product Coherence

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

> **ORDER:** Execute after `product-bug-fixes-2026-07.md` and `feature-wireups-2026-07.md`. Task 1 (AppShell) MUST come before Tasks 2 and 3 (they touch the same top-bar/sidebar files).

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | AppShell unification (kill the shell-swap) | 🟠 High | Medium | [ ] Pending | `components/layout/app-shell.tsx` (new), `app/(app)/layout.tsx`, `app/(public)/layout.tsx` |
| 2 | Global search (Cmd+K) in the app top bar | 🟠 High | Medium | [ ] Pending | `components/search/unified-search.tsx`, `components/search/global-search-modal.tsx` (new), `components/layout/app-top-bar.tsx` |
| 3 | Nav completeness (orphaned pages into menus) | 🟠 High | Low | [ ] Pending | `components/layout/sidebar.tsx`, `navbar.tsx`, `app/(app)/books/new/page.tsx`, `components/books/book-submission-form.tsx` |
| 4 | Marketing honesty (real counts, real features) | 🟡 Medium | Low | [ ] Pending | `app/(public)/features/page.tsx`, `components/home/home-hero.tsx`, `app/(public)/page.tsx` |
| 5 | Follows/friends clarity + Message button | 🟡 Medium | Medium | [ ] Pending | `app/(public)/users/[username]/page.tsx`, messages/chat components |
| 6 | Community mobile layout fix | 🟡 Medium | Low | [ ] Pending | `app/(public)/community/page.tsx` |
| 7 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/7 complete**

## Summary

The navigation audit (2026-07-07) found the app has TWO chrome systems — (public) Navbar+Footer vs (app) TopBar+Sidebar — and core sidebar links (`/books`, `/community`, `/clubs`, `/lists`) cross the boundary, dumping logged-in users out of their shell. Meanwhile there is no search anywhere in the authed app, three whole content surfaces (`/trending`, `/recommendations`, `/discover`) exist in no menu, and the marketing pages advertise a Notifications feature that doesn't exist plus hardcoded "10,000+ readers" social proof. This plan unifies the shell for logged-in users, adds ⌘K global search, completes the nav, and makes the marketing honest (user decisions 2026-07-07: fix notification claim now / build system later; use real DB counts for social proof).

## Task 1: AppShell unification (kill the shell-swap)

**Source:** Navigation audit #3 + prior UX assessment P1 ("Consolidate navigation"), deferred since Feb
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `components/layout/app-shell.tsx` (new), `app/(app)/layout.tsx`, `app/(public)/layout.tsx`

**Context:** Design verified 2026-07-07: `app/(public)/layout.tsx` ALREADY calls `supabase.auth.getUser()` and fetches conversations — the (public) group is already request-dynamic, and NO (public) page exports `revalidate`/`force-static`. So rendering the app chrome for authenticated users on public routes costs nothing extra. Approach: extract the chrome once, render it from both layouts.

**Steps:**
1. [ ] Read `app/(app)/layout.tsx` and `app/(public)/layout.tsx` fully.
2. [ ] Create `components/layout/app-shell.tsx` (server component, NO data fetching): props `{ user, profile, isAdmin, conversations, unreadCount, children }`; body = the exact JSX currently at `app/(app)/layout.tsx:84-111` (AppTopBar + fixed `aside` sidebar + `lg:pl-64 pt-12` content wrapper + MobileBottomNav + ChatWrapper). Move it verbatim; adjust only prop plumbing.
3. [ ] `app/(app)/layout.tsx`: keep ALL auth/profile/redirect logic; replace the returned JSX with `<AppShell user={...} profile={...} ...>{children}</AppShell>`.
4. [ ] `app/(public)/layout.tsx`: it already has `user`, `conversations`, `unreadCount`. Add, in the authed branch only, a profile fetch: `.from("profiles").select(<same columns (app) layout selects>).eq("id", user.id).maybeSingle()` — do NOT copy `ensureUserProfile` here (a public page must not hard-fail on profile creation); pass `profile ?? null` (AppTopBar/Sidebar accept `Profile | null` — verify their prop types and, if they require non-null, keep the Navbar branch for the profile-null edge case). Then:
   - `user && profile` → `<AppShell ...>{children}</AppShell>` (no Footer — matches app experience)
   - otherwise → existing Navbar / main / Footer markup, unchanged.
5. [ ] Ensure ChatWrapper is mounted exactly once per branch (it currently exists in both layouts — AppShell now owns it for the authed path; the anonymous branch keeps or drops its chat per current behavior — read what ChatWrapper renders for anonymous users first and preserve that behavior).
6. [ ] Known cosmetic acceptance: (public) pages use `container py-8` and AppShell adds `p-4 lg:p-8` — double padding is acceptable v1; do NOT restyle pages in this task.
7. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] Dev test logged IN: Dashboard → click "Browse" in the Sidebar → `/books` renders WITH the sidebar still present; same for Community, Book Clubs, Lists
- [ ] Dev test logged OUT: `/books`, `/`, `/about` render the public Navbar + Footer exactly as before
- [ ] Dev test logged IN: `/about` shows the app shell (acceptable and expected)
- [ ] `grep -c "AppTopBar" app/` — chrome markup exists ONLY in `app-shell.tsx`, not duplicated in either layout
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Global search (Cmd+K) in the app top bar

**Source:** Journey audit #9 — no search box anywhere in the authed shell; `UnifiedSearch` only on public home
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `components/search/unified-search.tsx`, `components/search/global-search-modal.tsx` (new), `components/layout/app-top-bar.tsx`

**Context:** `UnifiedSearch` can't sit inline in the `h-12` bar (it hard-codes a gradient panel + large input at `unified-search.tsx:202`), but its internals (debounced `/api/books/autocomplete`, keyboard nav, authors/books dropdown, AI-modal handoff) are exactly right. So: a trigger in the bar opens a modal hosting a compact variant. Books+authors only for v1.

**Steps:**
1. [ ] Read `components/search/unified-search.tsx` fully and `components/home/home-feed.tsx:33` (current usage — must not change behavior).
2. [ ] Add props to `UnifiedSearch`: `variant?: "hero" | "modal"` (default `"hero"`) and `onNavigate?: () => void`. When `variant === "modal"`: skip the gradient wrapper (render the `relative` input block bare), hide mood pills, `autoFocus` the input. Call `onNavigate?.()` inside `handleBookSelect` and `handleAuthorSelect` right before/after `router.push`. Hero path: zero behavioral change.
3. [ ] Create `components/search/global-search-modal.tsx` (`"use client"`): Radix Dialog (structure copied from `AIBookSearch`'s dialog), top-anchored (`top-[10%]`, no vertical centering), containing `<UnifiedSearch variant="modal" onNavigate={() => setOpen(false)} />`. Global hotkey: `useEffect` keydown listener for Ctrl+K / Cmd+K (`e.metaKey || e.ctrlKey`, `e.key === "k"`, `preventDefault`) toggling open. Export both the modal and a `GlobalSearchTrigger` that owns the open state.
4. [ ] EDGE CASE: when the user triggers the AI mood-search from inside the modal, `AIBookSearch` opens its own dialog — close the search modal first (route through the same `onNavigate`/close callback) to avoid stacked dialogs.
5. [ ] In `components/layout/app-top-bar.tsx` (already `"use client"`): add the trigger between logo and center nav — desktop (`hidden md:flex`): fake-input pill `h-8 w-56 rounded-md border bg-muted/50 text-sm text-muted-foreground` with `Search` icon and a `⌘K` kbd hint; mobile: `h-8 w-8` icon button beside ThemeToggle. Both open the modal.
6. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] Dev test: on `/dashboard`, press Ctrl/Cmd+K → modal opens focused; type a title → results; Enter/click → navigates to the book AND modal closes
- [ ] Dev test: public home hero search looks and behaves exactly as before
- [ ] Dev test: mobile viewport (375px) shows the search icon in the top bar; tapping opens the modal
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Nav completeness (orphaned pages into menus)

**Source:** Navigation audit #4/#5 — `/trending`, `/recommendations`, `/discover` in no nav; `/my-submissions` fully orphaned; Profile missing from sidebar; duplicate `books/new`≡`submit-book`
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `components/layout/sidebar.tsx`, `components/layout/navbar.tsx`, `components/layout/mobile-bottom-nav.tsx`, `app/(app)/books/new/page.tsx`, `components/books/book-submission-form.tsx`

**Context:** Sidebar sections live at `sidebar.tsx:36-68`. Icons come from lucide-react (match existing import style).

**Steps:**
1. [ ] `sidebar.tsx`: add a "Discover" section between Main and Social with: `/trending` "Trending" (TrendingUp icon), `/recommendations` "For You" (Sparkles), `/discover` "Find Readers" (UserSearch or Compass) — the label fixes the misnomer (the page finds people, not books). Add `/profile` "Profile" (User icon) to the Main or a bottom section (it's currently ONLY in the top-bar dropdown on desktop).
2. [ ] `mobile-bottom-nav.tsx`: add Trending / For You / Find Readers to the "More" overflow list (`:24-40` area) so mobile parity holds.
3. [ ] `navbar.tsx` (public): add `/trending` "Trending" to the nav links (`:10-15`). Do not overload the public nav further — one addition.
4. [ ] De-orphan `/my-submissions`: in `components/books/book-submission-form.tsx` (~line 94), change the success redirect from `/dashboard` to `/my-submissions`; add a "My Submissions" link inside `/submit-book`'s page header area (small text link).
5. [ ] Merge duplicates: replace the body of `app/(app)/books/new/page.tsx` with `redirect("/submit-book")` (`next/navigation`), keeping the route alive for old links. Grep for links to `books/new` (`grep -rn "books/new" app/ components/`) and repoint any found to `/submit-book`.
6. [ ] Inbound-link audit: for every `page.tsx` under `app/(public)` and `app/(app)` (exclude admin subpages and dynamic detail routes), confirm at least one `<Link>` targets it — run `grep -rhoE 'href="/[a-z0-9/_-]+"' app/ components/ | sort -u` and diff mentally against the route list; record remaining intentional orphans in Completed Notes.
7. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `grep -n "trending\|recommendations\|discover" components/layout/sidebar.tsx` shows all three entries
- [ ] `grep -n "/profile" components/layout/sidebar.tsx` matches
- [ ] Dev test: submit a book → land on `/my-submissions` showing the pending submission
- [ ] Dev test: `/books/new` redirects to `/submit-book`
- [ ] Orphan audit recorded in Completed Notes
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 4: Marketing honesty (real counts, real features)

**Source:** Public-surface audit #1/#3 — features page advertises non-existent "Notifications"; hero hardcodes "10,000+ readers / 50,000+ reviews". User decisions: fix copy now; use real DB counts.
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `app/(public)/features/page.tsx`, `components/home/home-hero.tsx`, `app/(public)/page.tsx`

**Steps:**
1. [ ] `app/(public)/features/page.tsx:73-77`: replace the "Notifications" feature card with a REAL shipped feature — "Weekly Reading Digest" (email digest exists: cron + `email_digest_enabled`). Reuse the card structure; pick an appropriate lucide icon (Mail). Scan the rest of the page for any other unshipped claims and note findings.
2. [ ] `app/(public)/page.tsx`: fetch real counts server-side (it already creates a supabase client): two head-count queries — `.from("profiles").select("*", { count: "exact", head: true })` and `.from("reviews").select("*", { count: "exact", head: true })`. Pass `{ readerCount, reviewCount }` to `HomeHero`.
3. [ ] `components/home/home-hero.tsx:116-121`: accept the two count props. Display logic: count ≥ 1000 → formatted "1,2k+ readers" style; below 1000 → replace the numeric stat row with qualitative copy ("A growing community of readers" — single line, keep layout balance). Delete the hardcoded literals.
4. [ ] `app/(public)/page.tsx:224` area: change "Join thousands of readers" to count-aware or neutral copy ("Join readers who track, review, and share what they read").
5. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] `grep -rn "10,000\|50,000" components/home/ app/(public)/` returns nothing
- [ ] `grep -n "Notifications" app/(public)/features/page.tsx` returns nothing (as a feature claim)
- [ ] Dev test: landing page renders with real/qualitative social proof, no layout break
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 5: Follows/friends clarity + Message button

**Source:** Journey audit #5 — Follow + Friend side-by-side unexplained; follows drive feeds but ONLY friends can message (`lib/actions/messages.ts:52-61`); no Message button on profiles
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `app/(public)/users/[username]/page.tsx`, chat/messages components (investigate exact file in step 1)

**Steps:**
1. [ ] Investigate the chat widget's API first: read `components/messages/` (ChatWrapper, chat-trigger, and whatever renders conversations). Determine whether an existing mechanism opens a SPECIFIC conversation (prop, context, store, or event). Record findings before coding.
2. [ ] In `app/(public)/users/[username]/page.tsx` (~lines 157-169, where FriendButton + FollowButton render): add one muted explanatory line below the buttons: `Follow to see their activity in your feed · Friends can message each other`.
3. [ ] Add a "Message" button rendered ONLY when the viewer and profile owner are accepted friends (the page already knows friendship state for FriendButton — reuse that data; if it only knows "pending vs none", extend the existing query minimally).
4. [ ] Wire the button: (a) if step 1 found an imperative open mechanism, use it; (b) otherwise implement the query-param handoff — button links to `/dashboard?dm={userId}`, and in ChatWrapper (client) read the param via `useSearchParams` on mount, open that conversation, then `router.replace` to strip the param. Choose (a) if available; document the choice.
5. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] Dev test (two accounts, accepted friends): friend's profile shows Message → clicking opens the chat with THAT conversation active
- [ ] Dev test: non-friend profile shows NO Message button; explanatory line visible on all profiles (when logged in, not own profile)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 6: Community mobile layout fix

**Source:** Prior UX assessment H5, confirmed still present — `community/page.tsx:107-114` appends MyShelfPanel + SuggestedFollows + CommunitySidebar BELOW the entire feed on mobile
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `app/(public)/community/page.tsx` (+ possibly a small client tabs wrapper component)

**Steps:**
1. [ ] Read `app/(public)/community/page.tsx` and `components/community/community-feed-tabs.tsx` (existing tab implementation to imitate).
2. [ ] Replace the `lg:hidden mt-8` below-feed block with a mobile-only tab bar ABOVE the content: tabs "Feed" (default) / "My Shelf" / "Discover" — Feed shows the existing feed, My Shelf shows MyShelfPanel, Discover shows SuggestedFollows + CommunitySidebar. Desktop (`lg:`) layout unchanged (side-by-side grid stays). If a client wrapper is needed (tab state), create `components/community/community-mobile-tabs.tsx` receiving the three panels as `ReactNode` props (keeps the page a server component).
3. [ ] Run `npm run lint` and `npm run build`.

**Verify:**
- [ ] Dev test at 375px: tabs visible at top; switching shows each panel WITHOUT scrolling past the feed; desktop ≥1024px unchanged
- [ ] `grep -n "lg:hidden mt-8" app/(public)/community/page.tsx` returns nothing (old block gone)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 7: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [ ] Full navigation walk (dev, logged in): every Sidebar item → page renders INSIDE the shell; ⌘K search works from 3 different pages; mobile bottom-nav More sheet reaches Trending/For You/Find Readers.
3. [ ] Logged-out walk: `/`, `/books`, `/features`, `/pricing` — public chrome intact, no fabricated numbers, no unshipped feature claims.

**Verify:**
- [ ] All three npm commands exit 0
- [ ] Both walks pass (or `CODE COMPLETE - Verification blocked` with reason)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| In-app notification system (bell + table + triggers) | User decision: copy fixed now, system later | Dedicated plan |
| Consolidating Trending + Recommendations into one tabbed page | Bigger IA change; nav entries make both discoverable first | After usage data |
| Extending search to users/clubs/lists + `/search` results page | Autocomplete API reshape; books-only v1 accepted | Search v2 |
| Club Settings page (button stays disabled) | Needs full settings scope | Clubs v2 |
| Visible breadcrumbs on book/user detail pages | JSON-LD exists; visual breadcrumbs are a design decision | UX pass |
| Follow button login-prompt for logged-out visitors | Conversion enhancement | UX pass |
| Removing double padding on public pages inside AppShell | Cosmetic, accepted v1 | Polish pass |
| Maps kill-or-keep, monetization, solo-vs-social positioning | Strategic product decisions (devil's-advocate report) | Product owner |

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
