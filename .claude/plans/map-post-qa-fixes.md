# OhMyReads - Map Post-QA Critical Fixes

> Manual testing on 2026-01-21 revealed 3 critical bugs blocking map functionality

---

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Fix book cover "image not available" text | 🔴 Critical | Low | [ ] PENDING | TBD - need to locate source |
| 2 | Fix place markers not clickable | 🔴 Critical | Medium | [ ] PENDING | `components/geo/reader-map-immersive.tsx` |
| 3 | Add Check Out button to own reader marker panel | 🔴 Critical | Low | [ ] PENDING | `components/geo/map-detail-panel.tsx` |

**Progress: 0/3 complete**

---

## BUG 1: Book cover shows "image not available" text

**Severity:** 🔴 Critical
**Impact:** Visual polish - damages user trust, makes app look unfinished

**Reproduction:**
1. Go to `/my-shelf` or `/profile`
2. Find book with missing cover (e.g., Harry Potter)
3. See "image not available" text instead of BookOpen icon placeholder

**Investigation needed:**
- Search for exact string in codebase
- Check if it's browser alt text from failed image load
- Check if it's from database (book.cover_url contains this text)
- Check Next.js Image component error handling

**Files to check:**
- `components/books/shelf-book-card.tsx`
- `components/books/cover-image.tsx`
- `components/books/book-card.tsx`

---

## BUG 2: Place markers not clickable

**Severity:** 🔴 Critical
**Impact:** Blocks entire check-in flow - users cannot check in at cafes/bookstores/libraries

**Reproduction:**
1. Go to `/community/map`
2. See place markers (cafes, restaurants, bookstores, libraries)
3. Click on any place marker
4. **ACTUAL:** Nothing happens, cursor doesn't change, no response
5. **EXPECTED:** Opens detail panel with "Mark as Reading Spot" button

**Working:**
- Reader markers (green person icon) ARE clickable ✅
- Search result markers briefly work but disappear after 5 seconds ❌

**Investigation:**
- Click handlers exist at lines 638-649 in reader-map-immersive.tsx
- Check for z-index issues, pointer-events: none, or event blocking
- Check if markers are being created correctly
- Verify setSelectedItem is being called

---

## BUG 3: No Check Out button when viewing own reader marker

**Severity:** 🔴 Critical
**Impact:** User is stuck - can see they're checked in but cannot check out from map view

**Reproduction:**
1. Check in at a location on map
2. Click on YOUR OWN reader marker (green person icon)
3. Panel opens showing: name, location ("Garer Stuff"), currently reading, "View Profile" button
4. **MISSING:** "Check Out" button
5. User cannot check out from this view

**Expected:**
- When clicking own reader marker, show "Check Out" button in panel
- Button should call `onClearPresence` to clear check-in status

**Investigation:**
- Check Out logic exists at map-detail-panel.tsx:333-341
- Condition: `isOwnMarker && presenceType !== "static" && onClearPresence`
- Verify:
  1. `isOwnMarker` is correctly identifying own marker (currentUserId === reader.id)
  2. `presenceType` is not "static" for checked-in users
  3. `onClearPresence` callback is being passed through component chain

---

## Changelog

| Date | Bug # | Status | Notes |
|------|-------|--------|-------|
| 2026-01-21 | ALL | PENDING | Bugs discovered during manual testing of UI/UX fixes |
