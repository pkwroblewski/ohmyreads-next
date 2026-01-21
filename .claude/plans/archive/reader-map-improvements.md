# Reader Map - Priority Improvements

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

| # | Task | Status | Priority | Effort | Files |
|---|------|--------|----------|--------|-------|
| 1 | Fix innerHTML XSS risk in markers | [x] Complete | 🔴 Critical | Medium | `reader-map-immersive.tsx` |
| 2 | Add ARIA live region for reader count | [x] Complete | 🟠 High | Low | `reader-map-immersive.tsx` |
| 3 | Improve mark spot button disabled state | [x] Complete | 🟡 Medium | Low | `mark-spot-modal.tsx` |
| 4 | Extract getTimeRemaining utility | [x] Complete | 🟢 Low | Low | `lib/utils/format.ts`, `map-context-panel.tsx` |
| 5 | Add moveend debounce for data fetch | [x] Complete | 🟡 Medium | Low | `reader-map-immersive.tsx` |
| 6 | Final QA | [x] Complete | 🔴 Critical | Low | - |

**Progress: 6/6 complete ✅**

---

## Summary

The Reader Map page audit identified 17 issues across performance, security, and UX. This plan addresses the top 5 quick-win improvements that provide the most value with moderate effort. Larger refactoring (component splitting, marker clustering) is deferred to a separate plan.

---

## Task 1: Fix innerHTML XSS Risk in Markers

**Audit Finding:** Security > S1: innerHTML with user data
**Priority:** 🔴 Critical
**Effort:** Medium

**File:** `components/geo/reader-map-immersive.tsx`

**Context:** Marker elements are created with innerHTML containing user data in aria-labels. While currently sanitized server-side, this is a potential XSS vector.

**Steps:**
1. [x] Locate marker creation code (~line 458-621)
2. [x] Create marker elements using DOM APIs instead of innerHTML
3. [x] Set aria-label using `setAttribute` instead of template literal
4. [x] Ensure all marker types (reader, place, highlighted) are updated

**Verify:**
- [x] Markers still render correctly
- [x] Screen readers announce marker labels
- [x] No innerHTML with user data in marker creation
- [x] Search "innerHTML" in file - only safe usages remain (icons only)

**Completed Notes:**
- Files modified: `components/geo/reader-map-immersive.tsx`
- Approach taken: Created button elements using `document.createElement()`, set attributes (role, tabindex, aria-label) using `setAttribute()`, used `innerHTML` only for static SVG icons which contain no user data
- Deviations from plan: None
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 2: Add ARIA Live Region for Reader Count

**Audit Finding:** UX/Accessibility > A3: Missing live region for status changes
**Priority:** 🟠 High
**Effort:** Low

**File:** `components/geo/reader-map-immersive.tsx`, `components/geo/map-layer-controls.tsx`

**Context:** Screen reader users aren't notified when reader count changes as they pan the map.

**Steps:**
1. [x] Add a visually-hidden live region in map component
2. [x] Update the live region text when reader count changes
3. [x] Use `aria-live="polite"` to avoid interrupting navigation

**Verify:**
- [x] Screen reader announces count changes (test with VoiceOver/NVDA)
- [x] Announcements are polite (don't interrupt)
- [x] No visual change to UI

**Completed Notes:**
- Files modified: `components/geo/reader-map-immersive.tsx`
- Approach taken: Added `prevReaderCountRef` to track previous count and `readerCountAnnouncement` state for the message. Added `useEffect` that compares current vs previous count and sets announcement text ("X readers in this area"). Added visually-hidden `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">` after MapLayerControls. Only announces when count changes (not on initial load).
- Deviations from plan: Did not modify `map-layer-controls.tsx` - the live region is better placed in the parent component where the count state is managed.
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 3: Improve Mark Spot Button Disabled State

**Audit Finding:** UX/Accessibility > V2: Button state clarity
**Priority:** 🟡 Medium
**Effort:** Low

**File:** `components/geo/mark-spot-modal.tsx`

**Context:** Users may not understand why "I'm here" button is disabled until they check the privacy checkbox.

**Steps:**
1. [x] Read the mark-spot-modal.tsx file
2. [x] Add helper text below checkbox explaining it enables the button
3. [x] Optionally add visual feedback linking checkbox to button state

**Verify:**
- [x] Helper text appears below checkbox
- [x] Text clearly indicates checkbox enables submit
- [x] Button enables immediately when checkbox is checked

**Completed Notes:**
- Files modified: `components/geo/mark-spot-modal.tsx`
- Approach taken: Added a new `<p>` element with "↑ Required to submit" text below the existing checkbox description. Used amber-600/400 color with font-medium for emphasis, and added an upward arrow to visually point to the checkbox.
- Deviations from plan: None
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 4: Extract getTimeRemaining Utility

**Audit Finding:** Code Quality > Q6: Repeated time calculations
**Priority:** 🟢 Low
**Effort:** Low

**File:** `lib/utils/format.ts`, `components/geo/map-context-panel.tsx`

**Context:** `getTimeRemaining()` function is duplicated in DefaultView and ReaderView components.

**Steps:**
1. [x] Create `lib/utils/format.ts` with `formatTimeRemaining(expiresAt: string | null)` function
2. [x] Update DefaultView to use the new utility
3. [x] Update ReaderView to use the new utility
4. [x] Remove inline implementations

**Verify:**
- [x] Time remaining displays correctly in both views
- [x] No duplicate implementations remain
- [x] TypeScript compiles without errors

**Completed Notes:**
- Files modified: `lib/utils/format.ts`, `lib/utils/index.ts`, `components/geo/map-context-panel.tsx`
- Approach taken: Added `formatTimeRemaining(expiresAt, suffix)` to existing `format.ts` rather than creating a separate `time.ts` file (keeps related formatting functions together). Added optional `suffix` parameter (defaults to "remaining") to handle the different text in DefaultView vs ReaderView ("remaining" vs "left"). Exported the function from `index.ts`.
- Deviations from plan: Used `format.ts` instead of new `time.ts` for better code organization
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 5: Add moveend Debounce for Data Fetch

**Audit Finding:** Performance > P5: No request deduplication
**Priority:** 🟡 Medium
**Effort:** Low

**File:** `components/geo/reader-map-immersive.tsx`

**Context:** Rapid map movements trigger multiple data fetches. Adding debounce reduces unnecessary API calls.

**Steps:**
1. [x] Locate moveend handler (~line 340-346)
2. [x] Add debounce (300ms) to the data fetch call
3. [x] Use similar pattern to search debounce (setTimeout/clearTimeout)
4. [x] Ensure cleanup in useEffect return

**Verify:**
- [x] Rapid panning doesn't cause multiple API calls
- [x] Data still fetches after map stops moving
- [x] No memory leaks (timeout cleared on unmount)

**Completed Notes:**
- Files modified: `components/geo/reader-map-immersive.tsx`
- Approach taken: Added `moveEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)` following the same pattern as `searchTimeoutRef`. Modified the `moveend` handler to clear any existing timeout before setting a new 300ms delayed fetch. Added cleanup in the useEffect return to clear the timeout on unmount.
- Deviations from plan: None
- Issues encountered: None

**Status:** [x] COMPLETE

---

## Task 6: Final QA

**Audit Finding:** N/A - Quality gate
**Priority:** 🔴 Critical
**Effort:** Low

**File:** -

**Steps:**
1. [x] Run `npm run build` - should pass
2. [x] Run `npm run lint` - should pass
3. [x] Manual test map page:
   - [x] Search works
   - [x] Markers display
   - [x] Reader panel shows count
   - [x] Mark spot modal works (shows sign-in prompt for unauthenticated users)
4. [x] Verify no console errors

**Verify:**
- [x] Build passes
- [x] Lint passes (0 errors, 78 warnings - all pre-existing)
- [x] All features work correctly
- [x] No regressions

**Completed Notes:**
- Files modified: None (QA task)
- Approach taken: Ran build and lint in parallel, then used Playwright to test map page functionality including map load, marker display, search dropdown, reader panel count, and layer controls
- Deviations from plan: Mark spot modal tested via sign-in prompt (expected behavior for unauthenticated users)
- Issues encountered: None - only console messages were geolocation permission policy violations (browser restriction, not code error)

**Status:** [x] COMPLETE

---

## Out of Scope (Deferred)

| Finding | Reason | Revisit |
|---------|--------|---------|
| P1: Large component (1136 lines) | High effort, requires significant refactoring | Next sprint |
| P2: DOM bypasses React (markers) | Would require architectural change to Mapbox integration | When upgrading Mapbox |
| V1: Marker overlap/clustering | Medium effort, needs design decision on clustering UX | Next sprint |
| Q1: ESLint disable comments | Requires deep dive into dependency chains | With P1 refactor |
| Q4: Callback complexity | Would benefit from state management refactor | With P1 refactor |
| P4: Multiple API calls | API consolidation requires backend changes | Backend sprint |

---

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Feature works as expected (manual test)
- [x] No XSS vulnerabilities in marker creation
- [x] Accessibility improvements verified

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-01-21 | - | Plan Created | Initial plan from audit findings |
| 2026-01-21 | 1-5 | Complete | All implementation tasks completed |
| 2026-01-21 | 6 | Complete | Final QA passed - build, lint, manual testing all successful |
