# Audit Fixes Phase 1: Critical + High Priority

> **Status:** COMPLETE
> **Date:** January 20, 2026

## Status Table

| Task | Status | Commit |
|------|--------|--------|
| C1: Club Creator Not Shown as Admin | [x] COMPLETE | - |
| C2: Clubs Listing Doesn't Show User's Clubs | [x] COMPLETE | - |
| C3: Custom Shelves Perpetual Loading | [x] COMPLETE (was misidentified - shelves work) | - |
| H1: Dashboard "Failed to fetch curated picks" | [x] COMPLETE (no fix needed - API handles errors gracefully) | - |
| H2: Mobile Users Cannot Access Custom Shelves | [x] COMPLETE | - |
| H3: Join Button Shows Empty Space for Admins | [x] COMPLETE | - |
| H4: No "My Clubs" Section | [x] COMPLETE | - |

---

## C1: Club Creator Not Shown as Admin

**Problem:** `createClub` returns success even if adding creator as admin fails.

**File:** `lib/actions/clubs.ts`

**Fix:** Return failure if member insert fails.

---

## C2: Clubs Listing Doesn't Show User's Clubs

**Problem:** `getClubs()` only fetches public clubs.

**Files:** `lib/queries/clubs.ts`, `app/clubs/page.tsx`

**Fix:** Add query for user's clubs alongside public clubs.

---

## C3: Custom Shelves Perpetual Loading

**Problem:** Page shows "Loading..." indefinitely.

**File:** `app/custom-shelves/page.tsx`

**Fix:** Investigate and fix data fetching.

---

## H1: Dashboard "Failed to fetch curated picks"

**Problem:** Error toast for curated picks.

**File:** Dashboard components

**Fix:** Implement or fix curated picks data source.

---

## H2: Mobile Users Cannot Access Custom Shelves

**Problem:** Custom shelves link hidden on mobile.

**File:** Sidebar/nav component

**Fix:** Add mobile navigation for custom shelves.

---

## H3: Join Button Shows Empty Space for Admins

**Problem:** Join button returns null for admins.

**File:** Club card component

**Fix:** Show admin badge instead of empty space.

---

## H4: No "My Clubs" Section

**Problem:** No dedicated section for user's clubs.

**File:** `app/clubs/page.tsx`

**Fix:** Add "My Clubs" section at top.
