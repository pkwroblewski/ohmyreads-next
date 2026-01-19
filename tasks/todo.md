# OhMyReads Code & Database Review - Implementation Complete

## Summary

All security fixes and improvements have been implemented.

---

## Firefox Authentication Fix (January 19, 2026)

### Problem
Login worked in Chrome but failed in Firefox with "Something went wrong" error.

### Root Cause
**Content-Security-Policy was blocking WebSocket connections to Supabase realtime.**

The CSP `connect-src` directive only allowed `https:` but Supabase realtime uses `wss:` (WebSocket Secure). Firefox enforces CSP strictly while Chrome is more lenient, which is why it only failed in Firefox.

Console error that revealed the issue:
```
Content-Security-Policy: The page's settings blocked the loading of a resource (connect-src)
at wss://bgczdbmqievfilvdzlgl.supabase.co/realtime/v1/websocket...
```

### Solution
Added `wss:` to the CSP `connect-src` directive in `next.config.ts`:
```typescript
"connect-src 'self' https: wss:", // wss: needed for Supabase realtime (Firefox requires this)
```

### Files Modified
| File | Change |
|------|--------|
| `next.config.ts` | Added `wss:` to CSP connect-src directive |
| `app/(app)/layout.tsx` | Improved error handling (secondary fix) |
| `app/(app)/dashboard/page.tsx` | Changed `.single()` to `.maybeSingle()` for resilience |

### Key Lesson
When using Supabase with CSP headers, always include `wss:` in `connect-src` for realtime WebSocket support. Firefox enforces CSP strictly; Chrome does not.

---

## Security Audit Fixes (January 2026)

| Task | Status | Notes |
|------|--------|-------|
| File Upload Hardening | ✅ Done | Added magic number validation for JPEG/PNG/WebP |
| Content Security Policy | ✅ Done | Added CSP header to next.config.ts |
| Timing-Safe Seed Token | ✅ Done | Using timingSafeEqual in seed route |
| Timing-Safe Webhook Secret | ✅ Done | Using timingSafeEqual in webhook route |
| Debug Endpoint Protection | ✅ Done | Added admin check to /api/geo/readers/debug |
| Reviews Rate Limiting | ✅ Done | Added 10/minute limit to createReview |

### Files Modified
| File | Change |
|------|--------|
| `app/api/geo/places/[id]/photos/route.ts` | Added file signature validation |
| `next.config.ts` | Added CSP header |
| `app/api/seed/route.ts` | timingSafeEqual for token comparison |
| `app/api/webhooks/supabase/route.ts` | timingSafeEqual for secret comparison |
| `app/api/geo/readers/debug/route.ts` | Admin-only access |
| `lib/actions/reviews.ts` | Rate limiting for createReview |

---

## Execution Log

| Task | Status | Notes |
|------|--------|-------|
| 1.1 OAuth Redirect Validation | ✅ Done | Added `validateRedirectUrl()` function |
| 1.2 Seed Route Protection | ✅ Done | Require SEED_TOKEN always for force ops |
| 1.3 CSV Import ISBN Validation | ✅ Done | Added `validateISBN()`, switched to `.in()` |
| 2.1 reading_stats Public SELECT | ✅ Done | In migration 029 |
| 2.2 user_books Public SELECT | ✅ Done | In migration 029 |
| 2.3 friend_requests WITH CHECK | ✅ Done | In migration 029 |
| 3.1 Messages Rate Limiting | ✅ Done | Added to `sendMessage` action |
| 3.2 AI Route Validation | ✅ Exists | Already has rate limiting & validation |
| 3.3 Geohash Validation | ✅ Exists | `isValidGeohash` validates base32 |
| 3.4 Webhook Dev Bypass | ✅ Secure | Fails closed in production |
| 4.1 Performance Indexes | ✅ Done | In migration 029 |
| 4.2 Audit Columns | ✅ Done | In migration 029 |
| 5.x Optional Improvements | ✅ Done | In migration 029 |

---

## Files Modified

| File | Change |
|------|--------|
| `app/(auth)/login/page.tsx` | Added redirect URL validation |
| `app/api/seed/route.ts` | Require SEED_TOKEN for force operations |
| `lib/actions/import.ts` | ISBN validation + `.in()` filter |
| `lib/actions/messages.ts` | Added rate limiting to sendMessage |
| `supabase/migrations/029_rls_and_indexes.sql` | New migration (RLS, indexes, constraints) |

---

## Migration 029 Contents

1. **RLS Fixes**
   - `reading_stats`: Public SELECT policy
   - `user_books`: Public SELECT policy (replaces own-only)
   - `friend_requests`: UPDATE policy with WITH CHECK

2. **Performance Indexes**
   - `idx_activity_feed_user_id`
   - `idx_reviews_created_at`

3. **Audit Columns**
   - `comments.updated_at` + trigger
   - `books.updated_at` + trigger

4. **Optional Constraints**
   - `dm_content_length`: 10KB max for messages
   - `social_links_user_platform_unique`: One link per platform per user

---

## Next Steps

1. **Apply migration** in Supabase SQL Editor:
   - Open Supabase Dashboard > SQL Editor
   - Paste contents of `supabase/migrations/029_rls_and_indexes.sql`
   - Execute

2. **Test in development**:
   - Google OAuth login with redirect
   - Public profile viewing (stats, books)
   - Friend request accept/reject
   - CSV import with edge cases
   - Message sending (rate limit)

---

## Previous Tasks (Archive)

### Environment Variables (Vercel) - Optional
| Variable | Purpose | Status |
|----------|---------|--------|
| `RESEND_API_KEY` | Welcome/notification emails | Not set |
| `RESEND_FROM_EMAIL` | Sender email address | Not set |

### Production Checks
- [x] Verify map works in production - Fixed CSP to allow Mapbox workers

---

## Map Loading Fix (January 2026)

**Problem:** Map page (`/community/map`) didn't load on Vercel deployment.

**Root Cause:** Missing `worker-src` directive in Content Security Policy. Mapbox GL JS v3 uses Web Workers created from blob URLs for tile rendering. Without `worker-src`, CSP falls back to `default-src 'self'` which blocks blob URLs.

**Fix:** Added `worker-src 'self' blob:` to CSP in `next.config.ts`

| File | Change |
|------|--------|
| `next.config.ts` | Added `worker-src 'self' blob:` to CSP directives |

---

## Profile Creation Fix - Part 2 (January 2026)

**Problem:** Users with Supabase auth accounts but missing profile rows got "Something Went Wrong" error. The Part 1 fix redirected to `/callback?redirect=/dashboard`, but the callback route requires an OAuth `code` parameter to create profiles.

**Root Cause:** The callback route only creates profiles during OAuth code exchange (line 37: `if (code)`). Redirecting there without a code redirected users to `/login?error=auth_failed`.

**Solution:** Added `ensureUserProfile()` server action that creates profiles inline without needing OAuth code.

| File | Change |
|------|--------|
| `lib/actions/user.ts` | Added `ensureUserProfile()` function - creates profile if missing |
| `app/(app)/layout.tsx` | Calls `ensureUserProfile()` instead of redirecting to `/callback` |

### Verification Steps
1. Deploy to Vercel
2. Login with affected user (e.g., biancawroble@hotmail.com)
3. Should auto-create profile and load dashboard
4. Check Supabase profiles table - new row should exist
