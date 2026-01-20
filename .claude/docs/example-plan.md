# Example Plan: Dark Mode Toggle

This is a filled-out example showing the exact expected format for plan files.

---

# OhMyReads - Add Dark Mode Toggle

> **Workflow:** Read this file → Find PENDING task → Execute → Verify → Mark COMPLETE → `/clear`

---

## Status

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Add theme context provider | [x] COMPLETE | `lib/theme-context.tsx` |
| 2 | Create toggle component | [x] COMPLETE | `components/ui/theme-toggle.tsx` |
| 3 | Add to header | [ ] Pending | `components/layout/header.tsx` |
| 4 | Final QA | [ ] Pending | - |

**Progress: 2/4 complete**

---

## Summary

Users want to switch between light and dark modes. We'll add a React context for theme state, a toggle button component, and integrate it into the existing header. Using `next-themes` for SSR-safe theme handling.

---

## Task 1: Add theme context provider

**File:** `lib/theme-context.tsx`

**Steps:**
1. [x] Install `next-themes` package
2. [x] Create ThemeProvider wrapper component
3. [x] Wrap app layout with provider

**Verify:**
- [x] Package in package.json
- [x] Provider wraps root layout
- [x] No hydration errors on refresh

**Status:** [x] COMPLETE

---

## Task 2: Create toggle component

**File:** `components/ui/theme-toggle.tsx`

**Steps:**
1. [x] Create component with sun/moon icons
2. [x] Use `useTheme` hook from next-themes
3. [x] Add accessible button with aria-label

**Verify:**
- [x] Component renders without errors
- [x] Icons switch based on current theme
- [x] Button has proper accessibility attributes

**Status:** [x] COMPLETE

---

## Task 3: Add to header

**File:** `components/layout/header.tsx`

**Steps:**
1. [ ] Import ThemeToggle component
2. [ ] Add to header nav section
3. [ ] Ensure proper spacing/alignment

**Verify:**
- [ ] Toggle visible in header
- [ ] Clicking toggles between light/dark
- [ ] Theme persists on page refresh

**Status:** [ ] PENDING

---

## Task 4: Final QA

**File:** -

**Steps:**
1. [ ] Run `npm run build`
2. [ ] Run `npm run lint`
3. [ ] Manual test: toggle theme, refresh, verify persistence

**Verify:**
- [ ] Build passes without errors
- [ ] Lint passes
- [ ] Theme works correctly end-to-end

**Status:** [ ] PENDING

---

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (manual test)
