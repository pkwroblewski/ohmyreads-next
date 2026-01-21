# OhMyReads - Map Post-QA Critical Fixes

> Manual testing on 2026-01-21 revealed 3 critical bugs blocking map functionality

---

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Fix book cover "image not available" text | 🔴 Critical | Low | [x] COMPLETE | `components/books/cover-image.tsx` |
| 2 | Fix place markers not clickable | 🔴 Critical | Medium | [ ] PENDING - NEEDS CLARIFICATION | `components/geo/reader-map-immersive.tsx` |
| 3 | Fix expired presence showing as active | 🔴 Critical | Low | [x] COMPLETE | `app/api/geo/readers/route.ts` |

**Progress: 2/3 complete** (BUG 2 pending user clarification)

---

## BUG 1: Book cover shows "image not available" text ✅ FIXED

**Severity:** 🔴 Critical
**Impact:** Visual polish - damages user trust, makes app look unfinished

**Root cause:**
- Google Books API returns 200 OK with "image not available" placeholder images
- These images are 1x1 pixels or very small (<50px)
- `onError` handler never fires because image technically loads successfully
- Browser shows alt text "Cover of Harry Potter" when image is too small to display

**Fix:**
- Added `onLoad` handler to detect placeholder images after successful load
- Check if `naturalWidth` or `naturalHeight` is suspiciously small (1x1 or <50px)
- Set `hasError` state to trigger fallback to BookOpen icon
- File: `components/books/cover-image.tsx` lines 116-123

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

## BUG 3: Expired presence showing as active ✅ FIXED

**Severity:** 🔴 Critical
**Impact:** Confusing UI - expired check-ins show as active with location label

**Root cause:**
- User checked in at "Garer Stuff" with 2-hour expiration
- Check-in expired (presence_expires_at < now)
- Database still has: presence_type="temporary", location_label="Garer Stuff"
- API didn't filter expired presence - showed as active
- Panel showed: "This reader has opted in to share..." (static message) + "Garer Stuff" location
- No Check Out button (correct for expired) but confusing location shown

**Fix:**
- Added expiration check in readers API: `presence_expires_at < now`
- Expired presence now treated as "static" (presenceType)
- Clear locationLabel, presenceNote, presenceExpiresAt for expired presence
- File: `app/api/geo/readers/route.ts` lines 48-87

**Result:**
- Expired check-ins no longer show location label or note
- Panel correctly shows static presence message
- No Check Out button (correct - presence already expired)

---

## Changelog

| Date | Bug # | Status | Notes |
|------|-------|--------|-------|
| 2026-01-21 | ALL | DISCOVERED | Bugs found during manual testing of UI/UX fixes |
| 2026-01-21 | 1 | FIXED | Added onLoad detection for Google Books 1x1 placeholder images |
| 2026-01-21 | 3 | FIXED | Added expiration filtering - expired presence now clears location data |
| 2026-01-21 | 2 | PENDING | Awaiting user clarification - yellow "Garer Stuff" label is Mapbox POI, not our marker |
