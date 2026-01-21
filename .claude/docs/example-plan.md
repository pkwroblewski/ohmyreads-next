# Example Plan: Dark Mode Toggle

This is a filled-out example showing the exact expected format for plan files. Use this as a template when creating new plans.

---

# OhMyReads - Add Dark Mode Toggle

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
| 1 | Add theme context provider | 🟠 High | Low | [x] COMPLETE | `lib/theme-context.tsx` |
| 2 | Create toggle component | 🟠 High | Low | [x] COMPLETE | `components/ui/theme-toggle.tsx` |
| 3 | Add to header | 🟡 Medium | Low | [ ] Pending | `components/layout/header.tsx` |
| 4 | Final QA | - | Low | [ ] Pending | - |

**Progress: 2/4 complete**

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

Users want to switch between light and dark modes. We'll add a React context for theme state, a toggle button component, and integrate it into the existing header. Using `next-themes` for SSR-safe theme handling.

---

## Task 1: Add theme context provider

**Source:** User Request > Dark mode feature  
**Priority:** 🟠 High  
**Effort:** Low  
**File:** `lib/theme-context.tsx`

**Context:** Next.js requires SSR-safe theme handling to avoid hydration mismatches.

**Steps:**
1. [x] Install `next-themes` package
2. [x] Create ThemeProvider wrapper component
3. [x] Wrap app layout with provider

**Verify:**
- [x] Package in package.json
- [x] Provider wraps root layout
- [x] No hydration errors on refresh

**Completed Notes:**
- Files modified: `lib/theme-context.tsx`, `app/layout.tsx`, `package.json`
- Approach taken: Used next-themes ThemeProvider with attribute="class" for Tailwind
- Deviations from plan: None
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 2: Create toggle component

**Source:** User Request > Dark mode feature  
**Priority:** 🟠 High  
**Effort:** Low  
**File:** `components/ui/theme-toggle.tsx`

**Context:** Need an accessible toggle button with visual feedback for current theme state.

**Steps:**
1. [x] Create component with sun/moon icons
2. [x] Use `useTheme` hook from next-themes
3. [x] Add accessible button with aria-label

**Verify:**
- [x] Component renders without errors
- [x] Icons switch based on current theme
- [x] Button has proper accessibility attributes

**Completed Notes:**
- Files modified: `components/ui/theme-toggle.tsx`
- Approach taken: Used Lucide icons (Sun/Moon), added aria-label="Toggle theme"
- Deviations from plan: Added 200ms transition for smoother icon swap
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 3: Add to header

**Source:** User Request > Dark mode feature  
**Priority:** 🟡 Medium  
**Effort:** Low  
**File:** `components/layout/header.tsx`

**Context:** Toggle needs to be easily accessible in the main navigation.

**Steps:**
1. [ ] Import ThemeToggle component
2. [ ] Add to header nav section
3. [ ] Ensure proper spacing/alignment

**Verify:**
- [ ] Toggle visible in header
- [ ] Clicking toggles between light/dark
- [ ] Theme persists on page refresh

**Completed Notes:**
<!-- Claude fills this in after completing the task -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 4: Final QA

**Source:** Plan > Final verification  
**Priority:** -  
**Effort:** Low  
**File:** -

**Steps:**
1. [ ] Run `npm run build`
2. [ ] Run `npm run lint`
3. [ ] Manual test at http://localhost:3000:
   - [ ] Toggle theme from light to dark
   - [ ] Refresh page - theme persists
   - [ ] Toggle back - works correctly

**Verify:**
- [ ] Build passes without errors
- [ ] Lint passes
- [ ] Theme works correctly end-to-end

**Completed Notes:**
<!-- Claude fills this in after completing the task -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| System preference detection | Nice-to-have, not core requirement | v2.0 |
| Per-page theme overrides | Complex, needs design input | Future |
| Theme transition animations | Polish, not essential | Next sprint |

---

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (manual test)

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2025-01-20 | 1 | ✅ Complete | Theme provider installed and configured |
| 2025-01-20 | 2 | ✅ Complete | Toggle component created with a11y support |
| | | | |
| | | | |