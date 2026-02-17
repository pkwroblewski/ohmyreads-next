# Code Quality & Security Assessment - OhMyReads
**Date:** 2026-02-17
**Assessor:** Code Quality & Security Specialist
**Scope:** Full codebase static analysis, API security, RLS, dependencies, lint, tests

---

## Executive Summary

OhMyReads demonstrates a solid security foundation from recent hardening work (Feb 7, 2026). Authentication, RLS, CSRF for mutation AI routes, rate limiting, and CSP headers are all in place. However, three specific areas need attention: (1) a **critical broken security feature** where `geolocation=()` in Permissions-Policy blocks a core app feature, (2) a **high-severity Next.js vulnerability** with a known patch available, and (3) **3 lint errors** in React components that cause performance-degrading re-render cascades. The 80 lint warnings are primarily cosmetic (unused imports) and do not create security risks.

---

## Strengths

- **Authentication pattern is correct across all server actions**: Every action calls `supabase.auth.getUser()` before operating on user data.
- **Zod validation is comprehensive**: reviews, comments, profiles, search params, taste profiles, and book submissions all have server-side schemas.
- **Rate limiting is production-grade**: Vercel KV-backed, fail-closed in production, LRU in-memory fallback for dev.
- **Cron auth is secure**: CRON_SECRET checked with exact `Bearer ${CRON_SECRET}` match, fails closed when not configured.
- **Webhook verification uses `timingSafeEqual`**: Prevents timing-attack credential comparison.
- **Admin privilege escalation patched**: `protect_admin_columns` trigger (migration 043) correctly prevents non-service-role writes to `is_admin`. `SET search_path = public` is present.
- **CSP is well-scoped**: No wildcard `*` in `connect-src`; Mapbox, Supabase, Google, Sentry explicitly listed.
- **HSTS configured**: `max-age=31536000; includeSubDomains; preload` — correct.
- **Seed endpoint is production-blocked**: `NODE_ENV === "production"` check prevents data seeding in production.
- **Debug endpoint is production-blocked and admin-gated**: `app/api/geo/readers/debug/route.ts` checks both NODE_ENV and `is_admin`.
- **TypeScript strict mode enabled**: `"strict": true` in tsconfig.json with no `@ts-ignore` or `as any` anywhere in `lib/` or `app/`.
- **No SQL injection surface**: All database access goes through Supabase PostgREST client (parameterized by design); `.rpc()` calls use parameter objects, not string interpolation.
- **innerHTML usage is static**: All uses in `reader-map-immersive.tsx` and `location-mini-map.tsx` assign hardcoded SVG/HTML strings with no user data interpolated — not an XSS risk.

---

## Code Quality Issues (Prioritized)

### CQ-1: setState-in-Effect Anti-Pattern (3 Lint Errors) — Medium Priority

**Files:**
- `components/books/cover-image.tsx:85` and `cover-image.tsx:208`
- `components/books/book-card.tsx:103`

**Pattern (simplified):**
```tsx
useEffect(() => {
  const controller = new AbortController();
  setIsValidating(true);   // synchronous setState inside effect body
  setValidatedUrl(null);
  // ... async work follows
}, [coverUrls]);
```

**Impact:** `setIsValidating(true)` and `setValidatedUrl(null)` fire synchronously at effect start, causing an immediate re-render before the async URL validation completes. This creates a double-render cycle on every `coverUrls` change — visible on every page that renders a list of books. The ESLint `react-hooks/set-state-in-effect` rule flags these correctly.

The overall architecture (abort controller, async chain, cleanup) is sound. The fix is to initialize state directly in `useState` as already-validating, eliminating the synchronous resets from the effect body, or use a `useReducer` to batch the transitions.

---

### CQ-2: Missing `exhaustive-deps` in Geo Components — Low Priority

**Files:**
- `components/geo/place-checkins-list.tsx:54` — `fetchCheckins` missing from deps
- `components/geo/place-photos-list.tsx:53` — `fetchPhotos` missing from deps
- `components/geo/place-reviews-list.tsx:63` — `fetchReviews` missing from deps
- `components/geo/reader-map-immersive.tsx:169,241,461,899` — 4 suppressed with `eslint-disable-next-line`

**Impact:** Functions defined inside the component are recreated each render, but the effect that calls them is not re-subscribed. This can produce stale closures that read outdated state. The disable comments in `reader-map-immersive.tsx` suggest intentional Mapbox lifecycle management — acceptable. The three unsuppressed warnings in the list components indicate potentially stale data fetching patterns.

---

### CQ-3: Unused Imports Across ~50 Files — Low Priority (80 warnings)

**Breakdown by category:**

| Category | Count | Examples |
|---|---|---|
| Unused Lucide icon imports | ~35 | `XCircle`, `CheckCircle`, `Navigation`, `Clock`, `Star` |
| Unused type imports | ~15 | `BookCoverData`, `TrendingBook`, `ReaderSearchFilters`, `Review` |
| Unused component imports | ~8 | `Input`, `LogFilters`, `Image` (in onboarding) |
| Unused variables | ~12 | `csvContent`, `loadingInsights`, `directionsUrl`, `endDate` |
| `<img>` instead of `<Image />` | ~14 | OG image routes, admin pages, clubs page |

**Risk:** Zero security risk. The `<img>` warnings in OG image routes (`/api/og/*`) are **intentionally correct** — `@vercel/og` runs in Edge runtime and cannot use Next.js `<Image>`. The others in admin pages and components could be replaced with `<Image />` for performance.

---

### CQ-4: `as unknown as` Type Assertions — Low Priority

**Count:** 25 occurrences in `lib/`, 4 in `app/`

**Example from `app/api/cron/weekly-digest/route.ts`:**
```ts
const book = item.book as unknown as { title: string; author: string; cover_url?: string };
const actor = item.actor as unknown as { username: string };
```

**Cause:** Supabase's TypeScript types for joined relations return `Json | null` in some cases when using complex select strings with aliases. This is a known Supabase SDK limitation. Not a bug, but indicates type safety gaps in the data access layer that could mask runtime errors.

---

### CQ-5: `public/sw.js` OFFLINE_URL Unused — Negligible

**File:** `public/sw.js:5`

Service worker defines `OFFLINE_URL` constant but never uses it. Stale draft code; no functional or security impact.

---

## Security Vulnerabilities

### SEC-1: CRITICAL — Permissions-Policy Blocks Core App Feature

**File:** `next.config.ts:53`

```ts
"Permissions-Policy",
value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
```

**Issue:** `geolocation=()` disables geolocation for the entire application domain. The app uses `navigator.geolocation.getCurrentPosition()` in at least 5 components:

- `components/dashboard/places-near-you.tsx:69`
- `components/geo/directions-display.tsx:94`
- `components/geo/place-submission-form.tsx:53`
- `components/geo/reader-map-immersive.tsx:432`
- `components/settings/location-section.tsx:121`

**Actual impact:** In browsers that enforce Permissions-Policy strictly (Chrome, Firefox), all location features silently fail or throw `GeolocationPositionError`. Users who have enabled location in their account settings will receive browser-blocked permission errors regardless of their preference. The Places Near You widget, Reader Map, and check-in flow are all broken.

**Fix:** Change to `geolocation=(self)` to allow geolocation for the app's own origin while still blocking it in any iframe embedding context.

---

### SEC-2: HIGH — Next.js 16.0.10 Has Known Vulnerabilities (Patch Available)

**File:** `package.json:37` — `"next": "16.0.10"`

**Vulnerabilities from `npm audit`:**

| Advisory | CVSS | Title | Affected Range |
|---|---|---|---|
| GHSA-h25m-26qc-wcjf | 7.5 (High) | HTTP request deserialization DoS via RSC | `>=16.0.0-beta.0 <16.0.11` |
| GHSA-9g9p-9gw9-jx7f | 5.9 (Moderate) | Image Optimizer DoS via remotePatterns | `>=15.6.0 <16.1.5` |
| GHSA-5f7q-jpqc-wp7h | 5.9 (Moderate) | Unbounded memory via PPR resume endpoint | `>=16.0.0-beta.0 <16.1.5` |

**Fix available:** `npm install next@16.1.6` (semver-compatible). The CVSS 7.5 RSC deserialization DoS requires no authentication and is directly relevant to this deployment (RSC is enabled by default in Next.js App Router).

---

### SEC-3: MEDIUM — CSRF Validation Not Consistently Applied

**Context:** `lib/utils/csrf.ts` provides `validateOrigin()`. Used on:
- `app/api/ai/book-search/route.ts`
- `app/api/ai/place-search/route.ts`
- `app/api/geo/places/[id]/photos/route.ts`
- `app/api/geo/places/[id]/reviews/route.ts`

**Not used on:** `app/api/geo/places/route.ts`, `app/api/community/feed/route.ts`, and all `geo/` routes that currently have GET-only handlers.

**Note:** Next.js Server Actions have built-in CSRF protection via SameSite cookie and Origin header validation. Current exposure is low. The risk is that future developers adding mutation handlers to existing routes may not know to add `validateOrigin()`.

**Recommendation:** Document that all `POST`/`PATCH`/`DELETE` route handlers must call `validateOrigin()` — add this to CLAUDE.md or a developer guide.

---

### SEC-4: MEDIUM — Admin Middleware Check Uses anon-Key Client

**File:** `proxy.ts:115–128`

The admin check in middleware uses the anon-key Supabase client (RLS-restricted), not the service-role client. This means:
1. The `profiles` table RLS must permit authenticated users to read their own `is_admin` column.
2. If RLS changes to restrict that field, the middleware silently fails closed (redirects to `/dashboard`) — which is correct behavior.
3. But it's an inconsistency with `lib/actions/admin-books.ts` which uses the same client pattern in `requireAdmin()`.

**Severity:** Low operational risk due to fail-closed behavior; worth documenting that RLS on `profiles` must allow `SELECT is_admin` for the authenticated user.

---

### SEC-5: LOW — `x-forwarded-for` Header Trusted as First Value (Spoofable)

**Files:** Multiple API routes including:
- `app/api/geo/ip-location/route.ts:12`
- `app/api/geo/isochrone/route.ts:26`
- `app/api/geo/directions/route.ts:27`
- `app/api/books/external-search/route.ts:8`
- `app/api/community/feed/route.ts:7`

**Pattern:**
```ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
```

**Issue:** On Vercel, the platform appends the real client IP as the last value in `x-forwarded-for`. Reading index `[0]` (leftmost) takes a value the client could have injected. An attacker can send `x-forwarded-for: 1.2.3.4` to spoof their IP and bypass rate limits.

**Fix:** Use Vercel's `x-real-ip` header as the primary source (platform-set, not user-controllable), with `x-forwarded-for` split and popped (last value) as fallback:
```ts
const ip = request.headers.get("x-real-ip")
  || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
  || "unknown";
```

---

### SEC-6: LOW — Unbounded In-Memory Cache in AI Insights Route

**File:** `app/api/ai/trending-insights/route.ts:8`

```ts
const insightsCache = new Map<string, { data: TrendingInsight[]; timestamp: number }>();
```

Currently uses only one cache key. If caching evolves to per-user or per-book, the unbounded map will grow without eviction in long-running containers. Should add a size check similar to the 10,000-entry LRU pattern in `lib/utils/rate-limit.ts`.

---

### SEC-7: LOW — `displayName` Allows Potentially Deceptive Characters

**File:** `lib/validation/profile.ts:4`

`displayName` is validated only with `max(100)` — no character set restriction. Control characters, RTL override characters (U+202E), and zero-width joiners can be submitted. This poses a low-severity phishing/impersonation risk in social contexts (friend lists, book clubs, reviews).

**Username** (same file) is correctly restricted to `/^[a-z0-9_]+$/` — no issue there.

---

## Test Coverage Gaps

### Current Coverage

| Area | Files | Tests | Status |
|---|---|---|---|
| `lib/utils/rate-limit.ts` | 1 | 18 | Good (in-memory path only) |
| `lib/validation/search.ts` | 1 | 20+ | Good — comprehensive |
| KV-backed rate limit path | 0 | 0 | Gap — requires KV mock |
| Server actions (`lib/actions/`) | 25 | 0 | Major gap |
| Zod schemas (review, comment, profile, taste) | 4 | 0 | Gap |
| `proxy.ts` middleware logic | 1 | 0 | Gap |
| API route handlers | 29 | 0 | Gap |
| Hooks (`hooks/`) | ~8 | 0 | Gap |

### Priority Missing Tests

1. **Server action auth guards** — Confirm unauthenticated requests return `{ error: "..." }` from `createReview`, `createComment`, `updateProfile`, and admin actions.
2. **Zod validation schemas** — `createReviewSchema`, `createCommentSchema`, `updateProfileSchema` should have tests matching the pattern in `__tests__/lib/validation/search.test.ts`.
3. **`proxy.ts` middleware** — Protected route redirect, admin route check, auth route redirect for logged-in users.
4. **Rate limit KV path** — Mock `@vercel/kv` to test production rate limiting behavior.

---

## Dependency Audit

### npm audit summary

| Severity | Count | Package | Fix |
|---|---|---|---|
| High | 1 | `next@16.0.10` | `npm install next@16.1.6` |
| Moderate | 0 | — | — |
| Low | 0 | — | — |
| Critical | 0 | — | — |

### Other observations

- `zod@^4.1.13` — Current major version. Good.
- `@supabase/ssr@^0.8.0` — Appropriate for App Router. Good.
- `@sentry/nextjs@^10.32.1` — Recent; source map deletion correctly configured.
- `dotenv@^17.2.3` — Listed as runtime dependency; should be `devDependencies` (Next.js handles env natively). Low risk.
- `babel-plugin-react-compiler@1.0.0` — Pinned to exact version. Appropriate for compiler stability.
- `vitest@^4.0.18` — Very recent 2026 release; no known issues.

---

## Recommendations

### Immediate (before next deployment)

1. **Fix `geolocation=()` in Permissions-Policy** (SEC-1): Change to `geolocation=(self)` in `next.config.ts:53`. This actively breaks core location features.
2. **Upgrade Next.js to 16.1.6** (SEC-2): `npm install next@16.1.6`. Patches CVSS 7.5 DoS. One-line change, no breaking API changes.

### Short-term (next sprint)

3. **Fix the 3 setState-in-effect lint errors** (CQ-1): Restructure `useEffect` in `cover-image.tsx:83–103`, `cover-image.tsx:206–219`, and `book-card.tsx:101–121` to eliminate synchronous state updates in effect bodies.
4. **Fix `x-forwarded-for` reading** (SEC-5): Standardize on `x-real-ip` across all rate-limited routes.
5. **Add server action auth tests** (Test Coverage): Cover `createReview`, `createComment`, and at minimum one admin action to confirm unauthenticated rejection.

### Medium-term

6. **Add Zod validation tests** for review, comment, and profile schemas matching the existing `search.test.ts` pattern.
7. **Clean up unused imports** (CQ-3): `eslint --fix` handles most automatically. 80 warnings with zero functional impact but indicate accumulated draft code.
8. **Document CSRF policy**: Explicitly require `validateOrigin()` on all future mutation API routes in developer documentation or CLAUDE.md.
9. **Add `displayName` character sanitization** (SEC-7): Strip or reject RTL override and zero-width characters.
10. **Add size limit to AI insights cache** (SEC-6): Follow the LRU pattern from `lib/utils/rate-limit.ts`.

---

## Summary Scorecard

| Category | Score | Notes |
|---|---|---|
| Auth & Session Management | A | Correct `getUser()` throughout; middleware fail-closed |
| Input Validation | A- | Zod on all key actions; `AdminBookInput` relies on TypeScript types only (no runtime schema) |
| SQL Injection | A | No raw SQL; PostgREST parameterized; RPC uses parameter objects |
| XSS Prevention | A- | No unsafe HTML rendering with user data; `displayName` char restriction missing |
| CSRF Protection | B+ | Server actions protected by Next.js; AI routes protected; pattern not templated for future routes |
| Rate Limiting | B+ | Comprehensive; IP header trust issue reduces score |
| Dependencies | B | 1 High vulnerability; fixable patch available |
| Security Headers | B+ | CSP tight; HSTS correct; Permissions-Policy self-defeating for geolocation |
| Code Quality | B | 3 lint errors, 80 warnings; TypeScript strict throughout; 29 type double-assertions |
| Test Coverage | C+ | 2 test files (rate-limit, search validation); no action/API/middleware tests |
