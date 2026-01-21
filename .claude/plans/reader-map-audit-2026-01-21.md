# Reader Map Page Audit Report

**Date:** 2026-01-21
**Status:** Audit Complete | Implementation Plan Pending
**Scope:** `/community/map` page - comprehensive technical and UX audit

---

## Quick Summary

| Category | Issues Found | Priority |
|----------|-------------|----------|
| Performance | 5 | Medium-High |
| Code Quality | 6 | Medium |
| Security | 2 | Low-Medium |
| UX/Accessibility | 4 | Medium |
| **Total** | **17** | - |

---

## 1. Hands-on Testing Results

### 1.1 Map Interaction Testing
**Status:** Pass with minor issues

| Test | Result | Notes |
|------|--------|-------|
| Map loads | Pass | Initial load ~19s (cold), ~700ms (warm) |
| Pan/zoom | Pass | Smooth 3D transitions with pitch |
| Layer toggles | Pass | Toggle counts update correctly |
| Marker clicks | Partial | Overlapping markers cause click interception issues |

### 1.2 Location Search Testing (Known Issue)
**Status:** No major issues found

The reported "slow and overly persistent dropdown" was not reproduced:
- Debounce: 250ms (appropriate)
- Dropdown closes on: click outside, Escape key, selection
- Results appear quickly after debounce

**Positive discoveries:**
- Auto-enables relevant layers when searching (e.g., searching cafe enables Cafes layer)
- Highlighted marker with glow effect for search results
- Keyboard navigation (arrow keys + Enter) works

### 1.3 User Location Flow Testing
**Status:** Pass with UX improvement opportunity

| Flow | Result | Notes |
|------|--------|-------|
| Mark Spot modal opens | Pass | Via "I'm Here" button |
| Form options clear | Pass | "I'm here now" vs "Recommend spot" |
| Duration selection | Pass | 1h, 2h, 4h options |
| Privacy consent | Pass | Checkbox required before submit |
| Form adapts to type | Pass | Duration hidden for recommendations |

**UX Issue:** Submit button disabled state isn't immediately clear - users may not understand why button is disabled until they check the privacy checkbox.

### 1.4 Reader Discovery Testing
**Status:** Pass

| Feature | Result |
|---------|--------|
| Nearby readers panel | Pass |
| Reader cards clickable | Pass |
| Reader detail view | Pass |
| Fly to reader location | Pass |
| View Profile link | Pass |

---

## 2. Technical Audit

### 2.1 Performance Issues

#### P1: Large Component (reader-map-immersive.tsx)
**File:** `components/geo/reader-map-immersive.tsx`
**Lines:** 1136
**Impact:** High

The main map component is very large with:
- 15+ useEffect hooks creating complex dependency chains
- Multiple refs for state management
- Inline HTML string generation for markers

**Recommendation:** Split into smaller components:
- `useMapInitialization` hook
- `useMarkerManagement` hook
- `useSearchHandler` hook
- `MapMarker` component

#### P2: DOM Manipulation Bypasses React
**Files:** `reader-map-immersive.tsx:458-621`
**Impact:** Medium

Markers are created via `document.createElement()` and innerHTML:
```typescript
el.innerHTML = `<div class="w-10 h-10 rounded-full...">`
```

This bypasses React's reconciliation, making updates inefficient and potentially causing memory leaks if markers aren't properly cleaned up.

**Recommendation:** Use React portals or Mapbox GL's built-in popup system.

#### P3: Duplicate Data Fetching Logic
**Files:** `reader-map-immersive.tsx:132-153, 804-811`
**Impact:** Low-Medium

Layer change triggers data fetch in multiple places with potential for race conditions.

#### P4: Multiple API Calls per View
**Network:** Each map view triggers 2+ parallel API calls
**Impact:** Medium

```
GET /api/geo/readers?geohash=...
GET /api/geo/places?geohash=...&types=...
```

While parallelized, this could be consolidated into a single endpoint returning both.

#### P5: No Request Deduplication
**Impact:** Low-Medium

Rapid map movements trigger multiple `moveend` events, each fetching data. No debouncing on data fetches (only on search input).

### 2.2 Code Quality Issues

#### Q1: ESLint Disable Comments
**File:** `reader-map-immersive.tsx:152, 205, 416, 810`
**Impact:** Medium

Multiple `eslint-disable-next-line react-hooks/exhaustive-deps` comments suggest potential stale closure bugs.

#### Q2: Non-null Assertions
**File:** `reader-map-immersive.tsx:512`
```typescript
.addTo(map.current!);
```
**Impact:** Low

Could cause runtime errors if map is null.

#### Q3: Type Coercion in Queries
**File:** `lib/queries/geo.ts:134`
```typescript
const book = entry.book as unknown as {...}
```
**Impact:** Low

Unsafe type casting that could mask type errors.

#### Q4: Callback Patterns
**Files:** `map-page-client.tsx`, `reader-map-immersive.tsx`
**Impact:** Medium

Complex callback passing between components (onFlyToLocation, onRefreshData) using refs. Could be simplified with context or Zustand store.

#### Q5: Inline Style Strings
**File:** `reader-map-immersive.tsx:480, 487, 572`
**Impact:** Low

Inline style strings in template literals are hard to maintain.

#### Q6: Repeated Time Calculations
**Files:** `map-context-panel.tsx:170-180, 386-397`
**Impact:** Low

`getTimeRemaining()` function duplicated in two places.

### 2.3 Security Review

#### S1: innerHTML with User Data
**File:** `reader-map-immersive.tsx:475-498`
**Impact:** Medium

Reader names/data used in innerHTML for aria-labels:
```typescript
const ariaLabel = `${readerName}, ${presenceDesc}...`;
el.innerHTML = `<div ... aria-label="${ariaLabel}">`;
```

While currently not exploitable (data is sanitized server-side), this is a potential XSS vector if validation changes.

**Recommendation:** Use `textContent` or DOM APIs instead of innerHTML for user-controlled values.

#### S2: API Token Exposure
**File:** `reader-map-immersive.tsx:264`
**Impact:** Low (expected)

`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is exposed in client bundle. This is expected for Mapbox GL but the token should have URL restrictions configured in Mapbox dashboard.

### 2.4 API Security (Good Practices Found)

| Practice | Implementation |
|----------|---------------|
| Rate limiting | 60/min readers, 20/min search |
| Input validation | Geohash validation, query length caps |
| Privacy filtering | Geohash truncation for static presence |
| Cache headers | no-cache for reader data, 1h for geocoding |

---

## 3. UX/Accessibility Audit

### 3.1 Accessibility

#### A1: Marker Focus Management
**Status:** Good
Markers have `role="button"`, `tabindex="0"`, and `aria-label`. Keyboard navigation (Enter/Space) works.

#### A2: Search Combobox Pattern
**Status:** Good
Search input has proper ARIA attributes:
- `role="combobox"`
- `aria-expanded`
- `aria-controls`
- `aria-activedescendant`

#### A3: Missing Live Region for Status Changes
**Impact:** Medium
No announcement when:
- Reader count changes
- Layer toggled
- Presence saved

**Recommendation:** Add `aria-live` regions for dynamic content updates.

### 3.2 Visual Design

#### V1: Click Target Overlap
**Observed:** Markers at similar locations overlap, intercepting clicks.
**Impact:** Medium
**Recommendation:** Implement marker clustering at lower zoom levels.

#### V2: Button State Clarity
**Observed:** "I'm here" submit button disabled state not obvious.
**Impact:** Low
**Recommendation:** Add helper text explaining checkbox is required.

### 3.3 Mobile Responsiveness

#### M1: Panel Overlap
**Observed:** On narrow viewports, panels may overlap map controls.
**Impact:** Low (mobile uses different layout)

---

## 4. Screenshots Captured

| File | Description |
|------|-------------|
| `.playwright-mcp/map-page-initial.png` | Initial map load |
| `.playwright-mcp/nearby-readers-panel.png` | Default view with readers |
| `.playwright-mcp/mark-spot-modal.png` | Mark spot modal (empty) |
| `.playwright-mcp/mark-spot-modal-filled.png` | Mark spot modal (filled) |
| `.playwright-mcp/recommend-spot-modal.png` | Recommend spot mode |
| `.playwright-mcp/reader-detail-panel.png` | Reader detail view |

---

## 5. Issue Priority Matrix

| ID | Issue | Severity | Effort | Priority |
|----|-------|----------|--------|----------|
| P1 | Large component | High | High | P1 |
| P2 | DOM bypasses React | Medium | Medium | P2 |
| S1 | innerHTML with user data | Medium | Low | P2 |
| A3 | Missing live regions | Medium | Low | P2 |
| V1 | Marker overlap | Medium | Medium | P3 |
| Q1 | ESLint disables | Medium | Medium | P3 |
| Q4 | Callback complexity | Medium | High | P3 |
| P3 | Duplicate fetch logic | Low | Low | P4 |
| P5 | No request dedup | Low | Low | P4 |
| V2 | Button state clarity | Low | Low | P4 |

---

## 6. Recommendations Summary

### Immediate (P1-P2)
1. **Refactor marker creation** - Use React portals or Mapbox popup API instead of innerHTML
2. **Add ARIA live regions** - Announce reader count changes, presence saves
3. **Audit innerHTML usage** - Ensure all user data is sanitized or use DOM APIs

### Short-term (P3)
4. **Split map component** - Extract hooks and sub-components
5. **Add marker clustering** - Prevent overlap at low zoom levels
6. **Consolidate callbacks** - Consider Zustand or context for map state

### Long-term (P4)
7. **API consolidation** - Single endpoint for readers + places
8. **Request deduplication** - Debounce moveend data fetches
9. **Clean up ESLint disables** - Fix underlying dependency issues

---

## Next Steps

Create implementation plan using `.claude/docs/planning-workflow.md` template for top 5 priority items.
