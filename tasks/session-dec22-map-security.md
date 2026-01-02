# Session Summary - December 22, 2024

## Topics Covered

### 1. Supabase Security Review
- Explained the `<untrusted-data>` wrapper in Claude Code terminal (prompt injection protection - safe, don't disable)
- Ran Supabase security advisors and found issues:
  - **Fixed:** Leaked password protection (user enabled in dashboard)
  - **Fixed:** 17 database functions with mutable search_path (applied migrations)
  - **Fixed:** `places_cache` table RLS policy (added read policy)

### 2. Reader Map Page Redesign
Implemented full redesign with:
- **Phase 1:** Fixed UX issues (removed overlapping sign-in button, moved geolocate to search bar, repositioned nav controls)
- **Phase 2:** Premium filter panel with icons, switches, and count badges
- **Phase 3:** Two-panel layout (map left, events sidebar right on desktop)
- **Phase 4:** Created `book_events` and `book_events_summaries` database tables, API endpoints
- **Phase 5:** AI integration for weekly event summaries (Anthropic SDK, cron job)

### 3. Mapbox Token Security
- Explained why maps still worked after creating new token (old token wasn't deleted)
- Set up URL restrictions on new token:
  - `http://localhost:3000/*`
  - `https://ohmyreads-next-*.vercel.app/*`
  - `https://www.ohmyreads.com/*`
- Updated tokens in `.env.local` and Vercel
- Confirmed public scopes are correct for frontend use

### 4. Mapbox vs Google Maps Comparison
Explained in plain English:
- Mapbox is 5-10x cheaper than Google Maps
- Mapbox: 50k free map loads/month, Google: 28.5k
- Current setup (MapLibre + Mapbox tiles) is good fit for OhMyReads
- No need to switch to Google Maps

### 5. Pending Prompts for Claude Code

#### Location Settings UX Improvement
```
The Reader Map is working, but there's a UX issue with the location toggle in Settings. When users toggle "Share my location" ON, they see a formal input form asking for location details. This feels clunky and bureaucratic.

DESIRED BEHAVIOR: Make the location setting process more intuitive, like Google Maps.

Option A - Browser Geolocation (Automatic): When user enables "Share my location", request browser geolocation permission. If granted, automatically capture their coordinates and convert to a human-readable location label via reverse geocoding. User just toggles ON and they're done.

Option B - Search & Pin (Manual): User can search for a place (e.g., "Knopes Cafe Luxembourg"), show search results on a mini-map, user clicks to pin their location. Like checking in on Google Maps.

Option C - Current Location Button: A "Use my current location" button that gets browser geolocation, shows it on the map, and user confirms with one click.

IMPLEMENTATION REQUIREMENTS:

1. Update the Settings Location Section - Replace the form inputs with a more visual approach. Add a mini-map preview showing their pinned location. Add search functionality (reuse the Mapbox geocoding from reader-map-immersive.tsx). Add "Use current location" button.

2. Location Flow: User toggles "Share location" ON → Show two options: [Use Current Location] uses browser geolocation, [Search for a place] opens search input → Either way, show location on mini-map → User confirms → Save geohash + location_label to profile.

3. Privacy Controls - Keep the precision slider (how accurate the location is shared). Keep the location_label field (but auto-fill it from geocoding). Geohash should be computed automatically from coordinates.

4. Files to Check/Modify: app/(protected)/settings/page.tsx (main settings page), check for existing location settings component, lib/utils/geohash.ts (already has encodeGeohash function), can reuse geocoding logic from components/geo/reader-map-immersive.tsx.

DESIGN GOALS: One-click to enable location sharing. Visual feedback (mini-map showing where they'll appear). No manual coordinate entry. Feels like Google Maps "share location" or "check in".

Please: 1) First explore the current settings page implementation, 2) Propose a redesigned location settings UI, 3) Implement the changes with search + current location options, 4) Add a mini-map preview component.
```

#### Enhance Place Details (Google Maps-like)
```
Enhance the Reader Map place details to show more information like Google Maps. Currently when you click a place marker, the detail panel shows basic info. I want to make it richer.

TASK 1: Extract more data from OpenStreetMap
In app/api/geo/places/route.ts, the Overpass API query fetches OSM data. Update the fetchFromOverpass function to extract and return more fields from the OSM tags:
- opening_hours (e.g., "Mo-Fr 09:00-18:00")
- phone or contact:phone
- website or contact:website
- email or contact:email
- wheelchair accessibility
- description
- image (Wikimedia Commons link if available)

TASK 2: Update the PlacePin type
In components/geo/reader-map-immersive.tsx, update the PlacePin interface to include the new fields.

TASK 3: Enhance the MapDetailPanel for places
In components/geo/map-detail-panel.tsx, improve the place detail view to show:
- Opening hours (with "Open now" / "Closed" indicator if possible)
- Phone number (clickable tel: link)
- Website (clickable link with external icon)
- Full address
- "Get Directions" button that opens Google Maps directions in new tab (format: https://www.google.com/maps/dir/?api=1&destination=LAT,LNG)
- "Share" button to copy link or share location

TASK 4: Improve the detail panel UI
Make it look more like a Google Maps info card:
- Larger header with place name and type badge
- Icon row for quick actions (directions, website, share)
- Expandable sections for details
- Show a placeholder image or map thumbnail if no photo available

Keep everything working with the existing OSM data - no new API keys needed. Just extract and display more of what OSM already provides.
```

## Files Created/Modified This Session

### New Files
- `components/geo/event-card.tsx` - Event card component
- `components/geo/map-events-panel.tsx` - Events sidebar
- `components/geo/events-bottom-sheet.tsx` - Mobile bottom sheet (ready but not wired)
- `app/api/geo/events/route.ts` - Events API
- `app/api/geo/events/summary/route.ts` - AI summary API
- `app/api/cron/scan-events/route.ts` - Weekly cron job
- `lib/queries/events.ts` - Event database queries
- `lib/ai/events-summary.ts` - AI summary generation

### Modified Files
- `app/(public)/community/map/page.tsx` - Two-panel layout
- `components/geo/reader-map-immersive.tsx` - Geolocate button moved, nav controls repositioned
- `components/geo/map-layer-controls.tsx` - Premium filter redesign
- `vercel.json` - Cron config (later removed by user/linter)

### Database Migrations Applied
- `fix_function_search_paths` - Fixed 13 functions
- `fix_checkin_function_search_paths` - Fixed 4 more functions
- `add_places_cache_read_policy` - RLS policy for places_cache
- `book_events` - Events tables and summaries

## Environment Variables Needed
- `ANTHROPIC_API_KEY` - For AI summaries
- `CRON_SECRET` - For cron job authentication
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - Updated with new restricted token
