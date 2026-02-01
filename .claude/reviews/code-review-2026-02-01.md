# OhMyReads - Comprehensive Code Review

**Date:** 2026-02-01
**Reviewer:** Claude Code (Opus 4.5)
**Project:** OhMyReads - Next.js 16 Book Tracking App
**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vercel, AI SDK

---

## Critical Issues

### ~~1. Hardcoded Secrets in `.env.local` Committed to Repository~~ **[FALSE POSITIVE - REMOVED]**

> **Correction (2026-02-01):** This issue was incorrectly flagged. Verification confirmed:
> - No `.env` files are tracked in git (`git ls-files | grep .env` returns empty)
> - No `.env` files exist in git history
> - `.gitignore` properly excludes `.env*` and `.env*.local` patterns
>
> The `.env.local` file is correctly configured as a local-only file. No action required.

### 1. Content Security Policy Too Permissive
- **Location:** `next.config.ts` (lines 66-75)
- **Severity:** CRITICAL
- **Details:** CSP allows dangerous directives:
  - `'unsafe-inline'` and `'unsafe-eval'` in script-src undermines XSS protection
  - Wildcard `https:` in connect-src allows data exfiltration to any HTTPS domain
  - Wildcard `wss:` allows WebSocket connections to any domain
- **Risk:** XSS vulnerabilities in user content (reviews, bios) could execute arbitrary scripts
- **Recommendation:**
  1. Remove `'unsafe-inline'` and `'unsafe-eval'` - use nonces or hashes instead
  2. Restrict connect-src to explicit domains only (Supabase, Vercel, Mapbox)
  3. Use environment-specific CSP (looser in dev, strict in production)

### 3. No Test Suite Exists
- **Location:** Entire codebase (0 test files found)
- **Severity:** CRITICAL
- **Details:** Zero tests across 344 TypeScript/TSX files for critical paths:
  - Authentication flow with race conditions
  - Book shelf operations and stats updates
  - Admin operations and permission checks
  - Realtime messaging subscriptions
  - Rate limiting edge cases
- **Risk:** Regression bugs, security vulnerabilities, and logic errors go undetected
- **Recommendation:** Implement test coverage starting with:
  1. Authentication callback flow
  2. Server actions (books, reviews, shelves)
  3. Admin permission checks
  4. Rate limiting boundaries

---

## High Priority Issues

### 4. Admin Access via Environment Variables Without Database Persistence
- **Location:** `app/(auth)/callback/route.ts` (lines 79-96, 147-170), `lib/actions/user.ts` (lines 264-270)
- **Severity:** HIGH
- **Details:** Admin status determined by comparing email against `ADMIN_EMAILS` env var at login
- **Risk:**
  - If env var is cleared, all admins lose access immediately
  - No audit trail of admin grants/revocations
  - Race condition between env changes and user sessions
- **Recommendation:** Store admin role in database with proper grant/revoke audit trail; use env var only for initial provisioning

### 5. Weak Username Collision Resolution Using Math.random()
- **Location:** `app/(auth)/callback/route.ts` (lines 99-107), `lib/actions/user.ts` (lines 282-290)
- **Severity:** HIGH
- **Details:** Uses `Math.random().toString(36).slice(2, 6)` for collision suffix (not cryptographically random, only 1.6M combinations)
- **Risk:** Race condition with concurrent signups could produce identical usernames; predictable suffixes enable guessing
- **Recommendation:** Use `crypto.getRandomValues()` for suffix generation with database-level unique constraint and retry logic

### 6. N+1 Query Patterns in Data Fetching
- **Location:** `lib/queries/books.ts` (lines 104-118), `lib/queries/community.ts` (lines 306-316)
- **Severity:** HIGH
- **Details:**
  - Reviews fetched first, then separate query for all author profiles
  - Community sidebar fetches 100 reviews then aggregates in JavaScript
- **Impact:** Extra database roundtrips, slow page loads as data grows
- **Recommendation:**
  1. Use Supabase foreign key joins: `.select('*, user:profiles!user_id(...)')`
  2. Use SQL aggregation: `SELECT user_id, COUNT(*) GROUP BY user_id`

### 7. Missing Composite Database Indexes for Common Query Patterns
- **Location:** `supabase/migrations/001_initial_schema.sql`
- **Severity:** HIGH
- **Details:** Missing indexes for:
  - `user_books(user_id, status, updated_at DESC)` - shelf queries
  - `reviews(user_id, book_id)` - duplicate checking
  - `activity_feed(created_at DESC, user_id)` - cursor pagination
  - `profiles(location_geohash)` - geohash prefix matching
- **Impact:** Full table scans on common operations, degrading performance at scale
- **Recommendation:** Create a new migration adding composite indexes for these query patterns

### 8. Dashboard Page Component Overload
- **Location:** `app/(app)/dashboard/page.tsx` (14KB, lines 84-121)
- **Severity:** HIGH
- **Details:** Single component fetches 8 different data sources in parallel; one slow query blocks entire page
- **Impact:** Hard to test, cache, or optimize individual sections; poor user experience during slow network
- **Recommendation:** Split into separate server components with React Suspense boundaries:
  - `<DashboardStats />`
  - `<CurrentlyReading />`
  - `<PersonalizedRecommendations />`
  - `<FriendActivity />`

---

## Medium Priority Issues

### 9. Console.error Logging of Full Database Errors
- **Location:** `app/(auth)/callback/route.ts` (10 instances: lines 50, 109, 113, 117, 127, 131, 142, 163, 167, 184)
- **Severity:** MEDIUM
- **Details:** Full Supabase error objects logged without sanitization
- **Risk:** Error logs could expose SQL structure, file paths, and internal data to monitoring systems
- **Recommendation:** Use the existing `logger` utility with `extractErrorInfo()` that filters stack traces in production

### 10. Missing Input Validation on API Query Parameters
- **Location:** `app/api/books/search/route.ts` (lines 21-35)
- **Severity:** MEDIUM
- **Details:** `genre` parameter extracted but not validated against allowlist; `sort` uses inline switch without schema
- **Risk:** No documentation of valid values, fuzzing attacks possible
- **Recommendation:** Validate with Zod schema similar to book submission validation; use TypeScript enums for sort/filter values

### 11. Rate Limiting Fallback Uses In-Memory Store
- **Location:** `lib/utils/rate-limit.ts` (lines 17-20, 111-114)
- **Severity:** MEDIUM
- **Details:** When Vercel KV unavailable, falls back to in-memory Map not shared across server instances
- **Risk:** Distributed denial attacks bypass limits by hitting different instances; no memory limit on fallback map
- **Recommendation:** Fail-closed in production (return 429 if KV unavailable); add maximum size limit to prevent memory exhaustion

### 12. Race Condition in Book Slug Generation
- **Location:** `lib/actions/books.ts` (lines 72-98, `ensureUniqueSlug`)
- **Severity:** MEDIUM
- **Details:** While loop checks for slug existence, but between check and insert another request could create same slug
- **Risk:** Duplicate slugs possible under concurrent book creation
- **Recommendation:** Use PostgreSQL unique constraint with `ON CONFLICT` clause instead of application-level check

### 13. Missing Error Boundaries Across Route Segments
- **Location:** `app/` directory (no `error.tsx` files found in most routes)
- **Severity:** MEDIUM
- **Details:** Failed data fetches in `Promise.all()` queries have no graceful degradation
- **Risk:** Single API failure crashes entire page instead of showing partial content
- **Recommendation:** Add `error.tsx` boundaries for major route segments with appropriate fallback UI

### 14. Fire-and-Forget Email Sending
- **Location:** `app/(auth)/callback/route.ts` (lines 137-143, 179-185)
- **Severity:** MEDIUM
- **Details:** `sendWelcomeEmail()` errors caught but only logged; no retry mechanism or job queue
- **Risk:** Critical onboarding emails silently lost on transient failures
- **Recommendation:** Implement email queue with retry logic, or use Supabase database trigger with deferred processing

### 15. Accessibility Gaps Throughout UI
- **Location:** Multiple components
- **Severity:** MEDIUM
- **Details:**
  - Icon-only buttons missing ARIA labels
  - Interactive divs should be semantic buttons (e.g., `app/(app)/admin/page.tsx` lines 112-147)
  - Color-only status indicators (trend badges line 75-76) not accessible to colorblind users
  - Form inputs missing `<label>` associations
- **Recommendation:** Audit all interactive elements for proper ARIA attributes; add text/icon indicators alongside color

---

## Low Priority Issues

### 16. Type Safety Gaps with Unsafe Casts
- **Location:** `lib/queries/community.ts` (lines 136-140), `lib/queries/books.ts` (line 120)
- **Severity:** LOW
- **Details:** Excessive `as unknown as` type casts bypass TypeScript checks for Supabase response types
- **Recommendation:** Create proper Supabase response types or use generics to maintain type safety

### 17. Code Duplication in Realtime Hooks
- **Location:** `hooks/use-realtime-messages.ts` (lines 75-80, 153-158)
- **Severity:** LOW
- **Details:** `useConversationMessages` and `useRealtimeMessages` share 95% of logic; admin status check duplicated in callback
- **Recommendation:** Extract shared logic to utility hook; create `getAdminEmails()` utility function

### 18. Missing Column Limiting in Some Queries
- **Location:** `lib/queries/users.ts` (line 92): `select('*, book:books(*)')`
- **Severity:** LOW
- **Details:** Some queries fetch full objects including unused fields (description, isbn) when only partial data needed
- **Recommendation:** Specify exact columns needed to reduce bandwidth and improve performance

### 19. Inconsistent Metadata Configuration
- **Location:** `app/(app)/dashboard/page.tsx` (line 36), `app/(app)/admin/page.tsx` (lines 25-28)
- **Severity:** LOW
- **Details:** Pages have title but missing description, Open Graph tags, and structured data
- **Recommendation:** Add comprehensive metadata for SEO; consider JSON-LD for book pages

### 20. Aggressive Caching on Personalized Data
- **Location:** `lib/queries/community.ts` (line 350): `revalidate: 120`
- **Severity:** LOW
- **Details:** Community sidebar cached 2 minutes; new top readers don't appear immediately
- **Recommendation:** Reduce cache time or implement stale-while-revalidate pattern

### 21. Rate Limiting Uses IP Instead of User ID for Authenticated Routes
- **Location:** `app/api/community/feed/route.ts` (line 8), other API routes
- **Severity:** LOW
- **Details:** Multiple authenticated users behind same IP (office, school) share rate limit
- **Recommendation:** For authenticated endpoints, use user ID as rate limit key instead of IP

---

## Positive Observations

### Security Best Practices Implemented
- Zod schema validation on all user inputs prevents injection attacks
- Supabase parameterized queries prevent SQL injection throughout
- Row Level Security (RLS) policies properly defined for all user-facing tables
- Rate limiting implemented on sensitive operations (auth, export, search, AI)
- Open redirect protection with explicit whitelist of allowed redirect paths
- Safe JSON-LD serialization with character escaping prevents XSS in structured data
- Secure password reset flow using OIDC protocol

### Architecture Strengths
- Excellent separation between browser and server Supabase clients
- Server-first architecture with proper use of Server Components
- Parallel data fetching with `Promise.all()` where appropriate
- Proper "use client" directive usage only where interactivity needed
- Clean folder structure following Next.js App Router conventions
- Realtime subscription cleanup prevents memory leaks in messaging hooks

### Code Quality Wins
- No `any` types found across the codebase - good TypeScript discipline
- Proper list key usage throughout React components
- Image optimization configured with remote pattern whitelisting
- React Compiler enabled for automatic memoization
- Audit logging infrastructure exists for admin operations
- Defensive filtering of orphaned records in activity feeds

### Developer Experience
- Well-documented CLAUDE.md with clear workflow instructions
- Planning workflow with structured task management
- Migration history showing thoughtful schema evolution
- Consistent code style and naming conventions

---

## Recommendations

### Immediate (This Week)
1. **Tighten CSP policy** - Remove `'unsafe-inline'` and `'unsafe-eval'`, restrict domains explicitly

### Short-term (This Sprint)
2. **Add composite database indexes** - Create migration for `user_books`, `reviews`, `activity_feed`, and `profiles` indexes
3. **Fix N+1 query patterns** - Refactor `getBookReviews` and `getCommunitySidebar` to use SQL joins/aggregation
4. **Implement database-backed admin roles** - Migrate from env-var-based admin to persisted role with audit trail
5. **Add error boundaries** - Create `error.tsx` files for major route segments

### Medium-term (Next Month)
6. **Start test suite** - Begin with authentication callback, server actions, and admin permissions
7. **Split dashboard component** - Refactor into smaller server components with Suspense boundaries
8. **Fix race conditions** - Use database constraints for username and slug uniqueness
9. **Audit accessibility** - Add ARIA labels, fix button semantics, add non-color status indicators

### Long-term (Ongoing)
10. **Implement email queue** - Add retry logic for transient email failures
11. **Enhance rate limiting** - Use user ID for authenticated routes, fail-closed in production
12. **Improve type safety** - Replace unsafe type casts with proper Supabase response types
13. **Add comprehensive metadata** - SEO optimization with Open Graph and JSON-LD for shareable pages

---

## Summary

**Overall Assessment:** B+

OhMyReads is a well-architected Next.js application with solid fundamentals - proper client/server separation, good TypeScript discipline, and comprehensive RLS policies. The codebase follows modern React patterns and Next.js best practices.

**Critical Concerns:**
1. The overly permissive CSP undermines XSS protection
2. Zero test coverage poses significant regression and security risks

**Strengths to Build On:**
- Excellent Supabase integration patterns
- Proper secret management (`.env.local` correctly gitignored)
- Good input validation with Zod
- Clean architecture with clear separation of concerns

**Path Forward:**
Address CSP hardening first, then focus on database optimization (indexes, N+1 queries) and the dashboard refactoring. The test suite should be started in parallel with feature development to prevent technical debt accumulation.

The codebase is well-positioned for scaling once the identified performance bottlenecks are addressed. The security foundation is solid with proper secret management and comprehensive RLS policies.

---

*Review generated by Claude Code on 2026-02-01*
