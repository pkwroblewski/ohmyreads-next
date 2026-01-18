# OhMyReads Task Tracker

## Pending Tasks

### Environment Variables (Vercel)
- [ ] Add `RESEND_API_KEY` - For welcome/notification emails
- [ ] Add `RESEND_FROM_EMAIL` - Sender email address
- [ ] Add `GOOGLE_GENERATIVE_AI_API_KEY` - For AI place search (⚠️ may need new key - free trial may be expired)
- [ ] Verify Mapbox tokens are set (if map features broken in prod)

### Optional Improvements
- [ ] Set up cron job for `cleanup_expired_presence()`
- [ ] Add Mapbox URL restrictions for production security

---

## Completed Work Log

### Database Migrations (January 2026)
- [x] **Run `028_fix_friend_requests_fk.sql`** - Added foreign keys to profiles table
- [x] **Run `019_audit_security_fixes.sql`** - Security fixes applied:
  - Fixed RLS self-approval bypass on book_submissions
  - Restricted book inserts to admins only
  - Added `recalculate_book_rating` function
  - Added `approve_book_submission` atomic function

### Check Out Visibility Improvements (January 2026)
- [x] Renamed "Clear Status" → "Check Out" in desktop context panel
- [x] Added "Check Out" button when viewing own marker in detail panel
- [x] Added floating "Check Out" button on mobile when user has active presence
- [x] Updated text to say "You're checked in here" when viewing own marker

**Files Modified:**
- `components/geo/map-context-panel.tsx` - Renamed button text
- `components/geo/map-detail-panel.tsx` - Added own marker detection and Check Out button
- `components/geo/reader-map-immersive.tsx` - Added mobile floating Check Out button
- `components/geo/reader-map-lazy.tsx` - Pass-through new presence props
- `components/geo/map-page-client.tsx` - Pass presence state to map component

### Geolocation Fix (January 2026)
- [x] Created `/api/geo/ip-location` server-side proxy for IP geolocation
- [x] Fixed CORS issue with direct ipapi.co calls from browser
- [x] Changed default map location from NYC to Luxembourg City
- [x] Map now properly centers on user's approximate location

**Files Created:**
- `app/api/geo/ip-location/route.ts` - Server-side IP location proxy

**Files Modified:**
- `components/geo/reader-map-immersive.tsx` - Use new API, updated default location

### Place-Based Mark Spot UX (January 2026)
- [x] Modified `setPresence()` to accept place data (placeGeohash, placeName)
- [x] When marking at a place, user's location is set to place's geohash
- [x] Updated MarkSpotModal to accept place prop and show toast on success
- [x] Added "Your Status" section to context panel showing active presence
- [x] Added "I'm Here Now" and "Recommend This Spot" buttons in place view
- [x] Map page now queries user's presence data and passes to client
- [x] Optimistic updates for presence state in UI

**User Flow:**
1. Search for "Bloom Cafe Luxembourg" → Click result
2. Place panel shows with "I'm Here Now" button
3. Click button → Modal opens with place name shown
4. Submit → Toast "You're at Bloom Cafe!"
5. Panel shows "Your Status: At Bloom Cafe (2h left)"
6. User marker appears at cafe location on map

**Files Modified:**
- `lib/actions/location.ts` - Added place data support to setPresence()
- `components/geo/mark-spot-modal.tsx` - Added place prop and toast
- `components/geo/map-context-panel.tsx` - Added status section and place actions
- `components/geo/map-page-client.tsx` - Added place-based handlers
- `app/(public)/community/map/page.tsx` - Query user presence data

### Map Page Redesign - Context Panel (January 2026)
- [x] Replaced useless Events Panel with context-aware "Reader Hub" panel
- [x] Panel shows default state with "Mark Your Spot" actions and nearby readers list
- [x] Panel shows reader details when reader marker clicked
- [x] Panel shows place details when place marker clicked
- [x] "I'm Here" floating button hidden on desktop (shown only on mobile)
- [x] State synced between map component and context panel via callbacks
- [x] Deleted unused files: `map-events-panel.tsx`, `events-bottom-sheet.tsx`, `event-card-compact.tsx`

**Files Created:**
- `components/geo/map-context-panel.tsx` - New context-aware sidebar panel
- `components/geo/map-page-client.tsx` - Client wrapper managing shared state

**Files Modified:**
- `components/geo/reader-map-immersive.tsx` - Added callback props for state sync
- `components/geo/reader-map-lazy.tsx` - Pass-through new callback props
- `app/(public)/community/map/page.tsx` - Use new MapPageClient component

### Map UI/UX Improvements (January 2026)
- [x] Location-biased search - Nominatim API now uses viewbox parameter for local results
- [x] Search highlight auto-clear - Highlighted marker disappears 1.5s after flyTo completes
- [x] Mark Spot button repositioned - Moved higher to avoid overlap with Mapbox controls
- [x] Renamed "AI Search" to "Search" - Kept sparkles icon for smart search indication

### Security Audit (January 2026)
- [x] RLS self-approval bypass → Fixed with atomic RPC + migration ✅ RUN
- [x] Open book inserts → Fixed with admin-only RLS + migration ✅ RUN
- [x] Webhook fail-open → Already secure
- [x] Location data leak → Already secure

### Reader Presence System (January 2026)
- [x] Temporary presence markers ("I'm here now")
- [x] Recommended spots with star styling
- [x] Pulse animations for temporary markers
- [x] Mark Spot modal with duration options
- [x] Migration `027_reader_presence.sql` ✅ RUN

### Phase 5: Reader Discovery
- [x] Reader search with text search indexes
- [x] Compatibility algorithm (books/genres/vibes)
- [x] Discover page with reader browser
- [x] "Readers Like You" recommendations

### Phase 4: Check-ins
- [x] Place check-ins with optional book/note
- [x] Streak tracking and 6 new badges
- [x] Community feed integration
- [x] 4-hour rate limit per place

### Phase 2: Foundation Fixes
- [x] Password reset flow
- [x] Welcome email (Resend integration)
- [x] Reading challenges with 3 types
- [x] Achievement badges (25 badges, 6 categories)

### Phase 1: Growth Tools
- [x] Goodreads import tool
- [x] Social sharing images (Vercel OG)
- [x] SEO pages (authors, curated lists)

### UI Improvements
- [x] Map layer controls redesign (glass morphism)
- [x] Mapbox GL v3 with 3D buildings
- [x] Location settings UX with mini-map preview
- [x] Map button layout fixes

---

## Environment Notes

### Can Remove from Vercel
- `ANTHROPIC_API_KEY` - No longer used (AI removed)
- `CRON_SECRET` - No longer used (cron job deleted)

### Required
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - For 3D map
- `MAPBOX_ACCESS_TOKEN` - Server-side Mapbox calls

---

<details>
<summary><strong>Reference Archive</strong> (Implementation Details)</summary>

## Mapbox Setup (If Map Broken in Prod)

### Root Cause
Mapbox tokens exist in `.env.local` (local dev) but may not be in Vercel (production)

### Fix Steps
1. Copy from `.env.local`: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` and `MAPBOX_ACCESS_TOKEN`
2. Add to Vercel → Settings → Environment Variables (all environments)
3. Redeploy

### Optional Security
Add URL restrictions in Mapbox dashboard:
- `https://www.ohmyreads.com/*`
- `https://ohmyreads.com/*`
- `https://*.vercel.app/*`
- `http://localhost:3000/*`

---

## Security Audit Details

### Migration `019_audit_security_fixes.sql` ✅ RUN

This migration:
1. Fixes `book_submissions` RLS - adds `WITH CHECK (status = 'pending')`
2. Restricts `books` INSERT to admins only
3. Creates `recalculate_book_rating` RPC (performance)
4. Creates `approve_book_submission` RPC (atomicity)

### Verification SQL
```sql
-- Should show has_with_check = true
SELECT policyname, with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'book_submissions'
  AND policyname = 'Users can update their pending submissions';

-- Should show "Admins can insert books"
SELECT policyname
FROM pg_policies
WHERE tablename = 'books'
  AND cmd = 'INSERT';
```

---

## Reader Presence System Details

### Migration `027_reader_presence.sql`

Adds to `profiles` table:
- `presence_type` - 'static' (default), 'temporary', or 'recommended'
- `presence_expires_at` - When temporary/recommended presence expires
- `presence_note` - Optional 140-char note about the spot

### Marker Styling
| Presence Type | Marker Style |
|---------------|--------------|
| `static` | Green circle (existing) |
| `temporary` | Green circle with pulse animation |
| `recommended` | Gold circle with star icon + glow |

### Files Modified
| File | Change |
|------|--------|
| `supabase/migrations/027_reader_presence.sql` | Add presence fields + cleanup function |
| `lib/actions/location.ts` | Add `setPresence()` and `clearPresence()` actions |
| `lib/queries/geo.ts` | Update `NearbyReader` type + filter expired |
| `app/api/geo/readers/route.ts` | Return presence data in API response |
| `components/geo/reader-map-immersive.tsx` | New marker styles + Mark Spot button |
| `components/geo/mark-spot-modal.tsx` | Modal for setting presence |
| `components/geo/map-detail-panel.tsx` | Display presence info in detail panel |
| `app/globals.css` | Pulse animation for temporary markers |

---

## Phase 1: Growth Tools (Files Created)

### Goodreads Import
```
app/(app)/import/page.tsx              # Import page
lib/actions/import.ts                  # Import server action
lib/utils/csv-parser.ts                # CSV parser utility
components/import/goodreads-import.tsx # Import component with UI
```

### Social Sharing
```
app/api/og/stats/route.tsx         # Stats share image (1200x630)
app/api/og/review/route.tsx        # Review share image
app/api/og/book/route.tsx          # Book share image
components/ui/share-dropdown.tsx   # Reusable share dropdown
```

### SEO Pages
```
app/(public)/authors/page.tsx         # Author listing with A-Z navigation
app/(public)/authors/[slug]/page.tsx  # Author detail with books grid
app/(public)/lists/page.tsx           # Lists index with card grid
app/(public)/lists/[slug]/page.tsx    # List detail with books
lib/data/curated-lists.ts             # 12 curated reading lists
lib/queries/authors.ts                # Author queries from book data
lib/queries/lists.ts                  # List book fetching
```

---

## Phase 2: Foundation Fixes (Files Created)

### Password Reset
```
app/(auth)/forgot-password/page.tsx  # Request reset email
app/(auth)/reset-password/page.tsx   # Set new password
```

### Reading Challenges
```
supabase/migrations/008_reading_challenges.sql
lib/actions/challenges.ts
components/challenges/challenge-card.tsx
components/challenges/create-challenge-form.tsx
components/challenges/active-challenges-widget.tsx
app/(app)/challenges/page.tsx
```

### Achievement Badges
```
supabase/migrations/009_user_badges.sql
lib/data/badges.ts                      # Badge definitions
lib/queries/badges.ts                   # Badge queries & calculation
lib/actions/badges.ts                   # Server actions
components/badges/badge-card.tsx        # Full badge display
components/badges/badge-icon.tsx        # Compact badge icon
components/badges/badges-section.tsx    # Profile section
```

---

## Phase 4: Check-ins (Files Created)

```
supabase/migrations/013_place_checkins.sql
lib/actions/checkins.ts
components/geo/checkin-button.tsx
components/geo/checkin-form-dialog.tsx
components/geo/place-checkins-list.tsx
```

### Database Tables
- `place_checkins` - id, place_id, user_id, book_id (optional), note (optional), created_at
- `user_checkin_stats` - user_id, total_checkins, current_streak, longest_streak, last_checkin_date

### Check-in Badges
| Badge | Tier | Criteria |
|-------|------|----------|
| Explorer | Bronze | 1 check-in |
| Regular Visitor | Bronze | 10 check-ins |
| Local Reader | Silver | 50 check-ins |
| Reading Nomad | Gold | 100 check-ins |
| Weekly Wanderer | Silver | 7-day streak |
| Monthly Explorer | Platinum | 30-day streak |

---

## Phase 5: Reader Discovery (Files Created)

```
supabase/migrations/014_reader_discovery.sql
lib/queries/discover.ts
app/api/discover/browse/route.ts
components/discover/compatibility-badge.tsx
components/discover/reader-card.tsx
components/discover/readers-like-you.tsx
components/discover/reader-browser.tsx
app/(public)/discover/page.tsx
app/(public)/discover/loading.tsx
```

### Compatibility Algorithm
- **Shared Books (40%)**: Direct book overlap in user libraries
- **Shared Genres (35%)**: Overlap in genres from books read
- **Shared Vibes (25%)**: Overlap in vibe_tags from reviews

### Compatibility Levels
| Level | Score | Color |
|-------|-------|-------|
| High | 70-100% | Green |
| Medium | 30-69% | Amber |
| Low | 0-29% | Gray |

---

## Badge Categories

- **Reading**: First Steps, Bookworm, Avid Reader, Bibliophile, Library Legend
- **Pages**: Page Turner, Marathon Reader, Page Master, Endless Reader
- **Reviews**: Voice Found, Thoughtful Reviewer, Literary Critic, Super Fan
- **Dedication**: Monthly Reader, Year of Reading, Dedicated Reader, Book a Week, Challenge Champion
- **Genres**: Fantasy Explorer, Mystery Maven, Sci-Fi Voyager, Hopeless Romantic, Knowledge Seeker
- **Special**: Early Adopter, Loyal Reader
- **Check-ins**: Explorer, Regular Visitor, Local Reader, Reading Nomad, Weekly Wanderer, Monthly Explorer

</details>
