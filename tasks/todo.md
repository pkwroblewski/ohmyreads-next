# OhMyReads Task Tracker

## Pending Tasks

### Environment Variables (Vercel) - Optional
| Variable | Purpose | Status |
|----------|---------|--------|
| `RESEND_API_KEY` | Welcome/notification emails | Not set |
| `RESEND_FROM_EMAIL` | Sender email address | Not set |
| `GOOGLE_GENERATIVE_AI_API_KEY` | AI place search | Not set (free trial may be expired) |

### Production Checks
- [ ] Verify map works in production (if broken, add Mapbox tokens to Vercel)

### Optional Improvements
- [ ] Set up cron job for `cleanup_expired_presence()` - Auto-cleanup expired check-ins
- [ ] Add Mapbox URL restrictions in Mapbox dashboard for security

---

## Recent Git Activity (January 18, 2026)

```
91fbe0c chore: Add friend requests FK migration and debug endpoint
2945d75 fix: API improvements and bug fixes
d31e5a2 feat: Redesign map page with context panel and place-based check-ins
bc69368 chore: Update .gitignore for temp files
f81dc12 docs: Mark database migrations as completed
```

**All changes pushed to GitHub. Vercel auto-deploys from main branch.**

---

## Database Migrations - All Applied

| Migration | Description | Status |
|-----------|-------------|--------|
| `028_fix_friend_requests_fk.sql` | FK from friend_requests to profiles | Applied |
| `027_reader_presence.sql` | Presence fields on profiles | Applied |
| `019_audit_security_fixes.sql` | RLS fixes, admin-only book inserts | Applied |

---

## Completed Features (January 2026)

### Map Page Redesign
- Context-aware Reader Hub sidebar panel
- Place-based check-ins with "I'm Here Now" / "Recommend" buttons
- Check Out button for own markers
- Your Status section showing active presence
- Deleted unused event components

### API Improvements
- IP geolocation server-side proxy (CORS fix)
- Full geohash for check-ins, truncated for static (privacy)
- Simplified AI place search (non-streaming)
- Better error handling throughout

### Security Audit Fixes
- RLS self-approval bypass - Fixed
- Open book inserts - Admin-only now
- Atomic book approval function added

### Reader Presence System
- Temporary markers with pulse animation
- Recommended spots with star styling
- Duration options (1h, 2h, 4h, 7 days)
- Location consent for precise sharing

---

## Environment Notes

### Required in Vercel
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - For 3D map
- `MAPBOX_ACCESS_TOKEN` - Server-side Mapbox calls

### Can Remove from Vercel
- `ANTHROPIC_API_KEY` - No longer used
- `CRON_SECRET` - No longer used

---

<details>
<summary><strong>Reference Archive</strong> (Click to expand)</summary>

## Mapbox Setup (If Map Broken in Prod)

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

## Key File Locations

### Map Components
- `components/geo/map-context-panel.tsx` - Sidebar panel
- `components/geo/map-page-client.tsx` - State management
- `components/geo/reader-map-immersive.tsx` - Main map component
- `components/geo/mark-spot-modal.tsx` - Check-in modal
- `components/geo/map-detail-panel.tsx` - Mobile detail panel

### API Routes
- `app/api/geo/readers/route.ts` - Nearby readers
- `app/api/geo/ip-location/route.ts` - IP geolocation
- `app/api/ai/place-search/route.ts` - AI search

### Actions
- `lib/actions/location.ts` - setPresence, clearPresence

---

## Completed Phases

### Phase 5: Reader Discovery
- Reader search, compatibility algorithm, discover page

### Phase 4: Check-ins
- Place check-ins, streak tracking, 6 badges

### Phase 2: Foundation
- Password reset, welcome emails, challenges, 25 badges

### Phase 1: Growth Tools
- Goodreads import, social sharing, SEO pages

</details>
