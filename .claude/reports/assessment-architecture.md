# Technical Architecture Assessment — OhMyReads
**Date:** 2026-02-17
**Assessor:** Technical Architecture Specialist
**Scope:** Read-only research — no source code modified

---

## Executive Summary

OhMyReads is a well-structured Next.js 16 (App Router) book-tracking platform with a Supabase backend, Vercel hosting, and multi-provider AI integration. The codebase (~47k LOC, 43 migrations) reflects iterative investment in security hardening, performance optimisation, and feature breadth. Overall, the architecture is coherent and follows current best practices for the stack. The most pressing concerns are in the data-fetching layer (unbounded in-memory caches, a missing full-text search index, and a multi-query recommendation algorithm), dependency versions that are tracking unstable pre-release ranges, and a few proxy/middleware edge cases. No critical structural regressions were found; issues are primarily scalability- and correctness-related.

---

## Strengths

### 1. App Router Usage
- Route groups (`(app)`, `(auth)`, `(public)`) provide clean auth-boundary separation.
- `force-dynamic` on the app layout ensures session-fresh rendering for authenticated routes (`app/(app)/layout.tsx:10`).
- Nested `<Suspense>` boundaries on the dashboard (`dashboard/page.tsx:93–133`) enable independent streaming for 6 distinct sections (stats, currently reading, friends, recommendations, recent activity, new-user quick actions).
- Root `error.tsx` and `global-error.tsx` capture all unhandled errors and forward them to Sentry.

### 2. Data Layer Discipline
- FK-based joins (`profiles!reviews_user_profile_fkey`) are used consistently in `lib/queries/books.ts` (lines 64–70, 140–146) to eliminate N+1 patterns.
- `unstable_cache` is applied appropriately for public, user-independent data: popular books (1 h), recent books (30 min), genres (1 h), community sidebar (2 min), initial community feed (30 s) — `lib/queries/books.ts:275–328`, `lib/queries/community.ts:293–349`.
- Cursor pagination with validated `date|uuid` format is implemented in the community feed (`lib/queries/community.ts:39–63`), preventing open-ended offset queries.

### 3. Database Design
- 43 migrations with clear, numbered naming and source annotation.
- Composite index `idx_user_books_user_status_updated` covers the most common shelf query pattern (`039_composite_indexes.sql:22–23`).
- Full-text GIN indexes on `books.title` and `books.author` were created in migration 001 (`001_initial_schema.sql:67–68`).
- RLS enabled on all tables. Admin privilege escalation was patched via trigger in `043_security_hardening.sql`.
- `protect_admin_columns()` SECURITY DEFINER function correctly includes `SET search_path = public` (`043_security_hardening.sql:35`).

### 4. Auth Flow
- `proxy.ts` is the correct file name for Next.js 16 middleware (no conflicting `middleware.ts` present).
- Session refresh pattern follows Supabase SSR docs exactly: `setAll` updates both request and response cookies (`proxy.ts:50–65`).
- Admin route guard fetches `is_admin` from `profiles` and fails closed on errors (`proxy.ts:114–129`).
- Env-var guard fails closed in production when Supabase config is missing (`proxy.ts:30–38`).

### 5. Security Posture
- CSP, HSTS (1 year + preload), X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy all configured in `next.config.ts`.
- Rate limiting uses Vercel KV in production with in-memory fallback for dev; fails closed in production on KV errors (`lib/utils/rate-limit.ts:163–174`).
- CSRF origin validation applied to all AI routes (`app/api/ai/book-search/route.ts:43–48`).
- Cron endpoint validates `Bearer` token and fails closed when `CRON_SECRET` is unset (`app/api/cron/weekly-digest/route.ts:22–30`).
- External user input to PostgREST `.or()` filters is sanitized (`lib/utils/sanitize.ts`).
- Sentry error capture with PII redaction in place.

### 6. AI Integration
- Multi-provider fallback pattern: Gemini Flash → GPT-4o-mini → Claude Haiku, in cost order (`app/api/ai/book-search/route.ts:14–28`).
- `stopWhen: stepCountIs(3)` prevents runaway agentic loops (`app/api/ai/book-search/route.ts:87`).
- AI tools (`bookSearchTools`) access the public Supabase client, appropriate for read-only catalog search.
- External Google Books queries sanitize the query before URL encoding (`lib/ai/tools.ts:106`).

### 7. Build Config
- `reactCompiler: true` in `next.config.ts` enables React 19 compiler optimisations.
- Sentry source maps deleted after upload, avoiding client-side leakage (`next.config.ts:130`).
- TypeScript strict mode enabled (`tsconfig.json:8`).
- Single-region Vercel deployment (`iad1`) with per-route `maxDuration` overrides for cron (`vercel.json`).

---

## Issues

### Critical

**None identified.** The security audit (migration 043) addressed the two previously identified critical privilege-escalation vectors.

---

### High

#### H1 — Unbounded In-Memory Trending Cache (server process memory leak)
**File:** `lib/queries/recommendations.ts:598–739`

`getTrulyTrending()` uses a module-level `Map` as a cache:
```ts
const trendingCache = new Map<string, { data: TrendingBook[]; timestamp: number }>();
```
In a serverless environment (Vercel), each function instance has its own memory — the cache is not shared and does not help across instances. More critically, the cache key includes `genre` (user-supplied via query params `app/api/ai/trending-insights/`), so an adversary can enumerate genre strings to grow the map indefinitely within a single warm instance. TTL eviction only fires on the *next read*, meaning entries accumulate until the lambda is killed. Use `unstable_cache` or Vercel KV here, same as the rest of the codebase.

#### H2 — Book Search Uses `ilike` Full-Scan, Not the GIN Full-Text Index
**File:** `lib/queries/books.ts:207`, `lib/ai/tools.ts:107–109`

Both `searchBooks()` and the AI `searchBooksTool` use:
```ts
.or(`title.ilike.%${query}%,author.ilike.%${query}%`)
```
PostgREST's `.ilike` with a leading `%` wildcard (`%term%`) cannot use the GIN full-text indexes that exist on `books.title` and `books.author` (migration 001). The query results in a full-table scan. At scale this degrades to O(n). A full-text search approach (`to_tsquery` via Supabase `.textSearch()`) would use the existing indexes. The `books_title_idx` and `books_author_idx` GIN indexes are presently unused.

#### H3 — Personalised Recommendation Algorithm Fetches All Books In-Process
**File:** `lib/queries/recommendations.ts:109–113`

```ts
const { data: allBooks } = await supabase
  .from("books")
  .select("*")
  .order("ratings_count", { ascending: false })
  .limit(200);
```
Then a separate query fetches vibe tags for all 200 book IDs (line 120–125). The entire scoring loop runs in JavaScript. This pattern does not scale: as the catalog grows past a few hundred books, recommendation quality degrades (only top-200 by popularity are considered), and the two-query approach adds network overhead. At 10k+ books, 200 is an arbitrary hard cap that will silently bias recommendations toward early popular titles. Consider a PostgreSQL function or materialised view for this.

#### H4 — `handle_new_user` Trigger Lacks `SET search_path`
**File:** `supabase/migrations/001_initial_schema.sql:217–239`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
This SECURITY DEFINER function does **not** include `SET search_path = public`. All subsequent migration functions added this correctly (e.g., `protect_admin_columns` in 043). The `handle_new_user` function runs on every new user signup and its `search_path` can be exploited if an attacker can create a schema with identically named tables. This is a known Supabase RLS hardening requirement.

---

### Medium

#### M1 — App Layout Makes Multiple Sequential Round-Trips on Every Page Load
**File:** `app/(app)/layout.tsx:23–79`

The layout awaits:
1. `supabase.auth.getUser()` (line 27)
2. `supabase.from("profiles").select("*")` (line 42–46)
3. `getConversations()` and `getUnreadCount()` in parallel (line 72–75)

The profile and auth calls are sequential (profile depends on user). The dashboard page then independently calls `supabase.auth.getUser()` again (line 44–46 in `dashboard/page.tsx`) and fetches profiles a second time (line 56). This results in 5+ Supabase round-trips before the first byte of dashboard content is serialised. The auth token is validated twice per layout+page combination.

#### M2 — `getAllGenres` Fetches Full Books Table, Processes In-Process
**File:** `lib/queries/books.ts:311–328`

```ts
const { data, error } = await supabase.from("books").select("genres");
// Flatten and deduplicate genres
const allGenres = data?.flatMap((b) => b.genres || []) || [];
return [...new Set(allGenres)].sort();
```
This fetches the `genres` column for **every book** in the catalog to compute a distinct list in JavaScript. Even with a 1-hour cache, a cold cache hit (e.g., after deployment) transfers O(n) rows. A SQL `SELECT DISTINCT UNNEST(genres) FROM books ORDER BY 1` would return only distinct values from the database engine, using the existing GIN index.

#### M3 — Community Feed Map-Join for Profiles (manual N+1 mitigation)
**File:** `lib/queries/home.ts:125–163`

`getCommunityFeed()` fetches reviews, collects user IDs, then does a second query for profiles. While the code correctly batches the profile fetch (`profiles.select(...).in("id", userIds)`), this is a two-round-trip pattern that exists because `reviews` lacks a FK join to `profiles`. The formalised FK join approach used in `lib/queries/books.ts` (via `reviews!reviews_user_profile_fkey`) should be used here too, or the community feed in `home.ts` should be consolidated with the already-correct implementation in `lib/queries/community.ts`.

#### M4 — Dependency Version Pinning Issues
**File:** `package.json`

Several packages are pinned with `^` to major versions that are actively in flux:
- `ai: "^5.0.116"` — Vercel AI SDK v5 is a recent major version with breaking changes; `^5` will auto-upgrade to any 5.x
- `@ai-sdk/anthropic: "^2.0.56"`, `@ai-sdk/google: "^2.0.51"`, `@ai-sdk/openai: "^2.0.88"` — all v2 which is new
- `zod: "^4.1.13"` — Zod v4 was recently released with a different API surface
- `sonner: "^2.0.7"` — Sonner v2 is also a new major
- `lucide-react: "^0.556.0"` — minor version is 556, indicating rapid iteration

These are all `^` ranges, meaning a `npm install` in CI will silently pull breaking changes. Consider locking to exact versions or using a lockfile-only install (`npm ci`) and upgrading deliberately.

#### M5 — Mapbox MCP Cache Is Process-Local (same issue as H1)
**File:** `lib/services/mapbox-mcp.ts:68–93`

```ts
const cache = new Map<string, CacheEntry<unknown>>();
```
Same pattern as trending cache: module-level `Map` in a serverless context. Cache is not shared across instances. POI and geocoding results will be re-fetched on every cold-start and across concurrent instances. Use Vercel KV or `unstable_cache` with a proper TTL.

#### M6 — Stats Query Loads All User Books Into Memory For In-JS Aggregation
**File:** `lib/queries/stats.ts:82–109`

`getUserReadingStats()` fetches **all** read books for a user in a single query, then performs all aggregations (monthly bucketing, genre distribution, rating distribution, fastest/slowest book) in JavaScript. For power users with hundreds of books this works fine, but there is no pagination or limit. A user with 2,000+ books would transfer all records per stats page visit. Consider pushing aggregations to SQL or caching aggressively.

#### M7 — `protect_admin_columns` Uses `current_setting('role', true)` — Relies on Non-Standard Behaviour
**File:** `supabase/migrations/043_security_hardening.sql:18–20`

```sql
db_role := current_setting('role', true);
IF db_role != 'service_role' THEN
```
`current_setting('role')` returns the GUC `role` setting, which is a *configuration parameter*, not the actual PostgreSQL role. The actual current role is `current_role` (a keyword) or `current_user`. In Supabase's connection pooling environment, `current_setting('role')` may return an empty string rather than `'service_role'`, meaning the guard could unexpectedly pass for non-service-role callers. The correct check is `current_user = 'service_role'` or checking for the `service_role` claim in the JWT via `auth.jwt() -> 'role'`.

---

### Low

#### L1 — `proxy.ts` Admin Check Makes an Extra DB Query on Every Admin Route Visit
**File:** `proxy.ts:114–129`

Every request to an `/admin/*` route triggers a `supabase.from("profiles").select("is_admin")` query. If the admin role were encoded in the JWT (custom claims via a Supabase hook), this could be a JWT decode (no DB) instead. As admin traffic is low, this is acceptable now but worth noting for future optimisation.

#### L2 — `QuickActionsForNewUsers` Calls `auth.getUser()` Again
**File:** `app/(app)/dashboard/page.tsx:153–163`

This server component makes a third `auth.getUser()` call within the same request tree (layout also called it). In Next.js App Router, `cookies()` and auth calls are deduplicated per-request via `AsyncLocalStorage`, but only within the same component tree render. Since `QuickActionsForNewUsers` is in a separate `<Suspense>` boundary, it initiates its own Supabase client, resulting in an additional auth cookie validation.

#### L3 — `vercel.json` Applies 30-Second Timeout to All `app/**/*.ts` Routes
**File:** `vercel.json:7–9`

```json
"app/**/*.ts": { "maxDuration": 30 }
```
This applies to all routes including lightweight ones that should complete in 1–3 seconds. Vercel charges for function duration; unnecessarily high timeouts can mask slow queries that should be investigated and fixed. Consider explicit timeouts per route type.

#### L4 — Google Fonts Are Loaded Via `next/font/google` In Root Layout
**File:** `app/layout.tsx:8–20`

This is correct usage, but `Inter` (a large variable font) and `Merriweather` (loaded at 400/700/900 weights) are both requested. Verify that only used weights/subsets are specified, and consider whether both fonts are actively used throughout the UI.

#### L5 — `handle_new_user` Trigger Creates Username From Email Prefix Without Uniqueness Guarantee
**File:** `supabase/migrations/001_initial_schema.sql:223`

```sql
COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
```
Two users with `john@gmail.com` and `john@yahoo.com` would both attempt `username = 'john'`, causing a unique constraint violation on signup. The app layout handles this gracefully by calling `ensureUserProfile()` on failure, but the error is swallowed silently. A suffix-based collision strategy in the trigger (similar to `insertBookWithUniqueSlug` in `lib/actions/books.ts`) would be more robust.

---

## Scalability Concerns

### 1. Recommendation Engine (Critical Path)
At current scale the in-JS scoring of 200 books is acceptable. At 10k+ books and 10k+ users with concurrent dashboard loads, the `getPersonalizedRecommendations` function will become a bottleneck. Each call: 4 DB queries + 200-book JS scoring loop. Recommended: push scoring to a PostgreSQL function or pre-compute recommendations nightly in a cron job.

### 2. Community Feed Architecture
The cursor-pagination approach in `lib/queries/community.ts` is correct and will scale well. However, the `activity_feed` table will grow unboundedly. No archival or TTL policy is visible in the migrations. At 100 users posting 5 events/day, the table grows 500 rows/day — manageable. At 10k active users it becomes a significant table requiring periodic archival.

### 3. Weekly Digest Cron — Sequential Processing Bottleneck
**File:** `app/api/cron/weekly-digest/route.ts:68–219`

The cron processes users in batches of 10. For each user in the batch, 5 queries are executed (stats, books, activity, challenge, auth). With 1000 users and batches of 10, this is 100 batch iterations × 5 queries = 500+ sequential DB round-trips, plus email sends. The 300-second timeout will be hit at ~300–500 users. This needs a queue-based architecture (Vercel Queue, Inngest, or similar) to scale beyond a few hundred subscribers.

### 4. Full-Text Search is a Stub
The `searchBooks` function uses `ilike` (H2 above). As the book catalog grows, this will degrade. A proper full-text search solution (PostgreSQL `tsvector` or Supabase's built-in `textSearch`) is needed before the catalog exceeds ~10k titles.

### 5. Single Vercel Region
Deployed to `iad1` (US East). If the user base becomes international, edge functions or multi-region deployments should be considered. Supabase is also single-region by default.

---

## Dependency Analysis

| Package | Version | Concern |
|---|---|---|
| `next` | `16.0.10` | Pinned to exact — good |
| `react` / `react-dom` | `^19.2.3` | `^` allows 19.x patch — acceptable |
| `ai` | `^5.0.116` | v5 is new; `^` allows breaking 5.x changes |
| `@ai-sdk/*` | `^2.x` | v2 is new; `^` allows breaking 2.x changes |
| `zod` | `^4.1.13` | v4 API differs from v3; `^` is risky |
| `@supabase/ssr` | `^0.8.0` | Stable; `^0.x` allows minor-but-breaking changes (pre-1.0) |
| `@supabase/supabase-js` | `^2.86.2` | Stable v2; acceptable |
| `mapbox-gl` | `^3.17.0` | v3 is stable; minor version churn |
| `lucide-react` | `^0.556.0` | Rapid versioning; individual icon names change between minors |
| `@sentry/nextjs` | `^10.32.1` | v10 is current; acceptable |
| `recharts` | `^3.5.1` | v3 is relatively new |
| `resend` | `^6.6.0` | `^6` — check breaking changes between 6.x minors |
| `dotenv` | `^17.2.3` | `^17` — new major; verify compatibility |
| `@tanstack/react-query` | `^5.90.12` | v5 stable; `^` acceptable |

**Primary risk:** AI SDK packages (`ai`, `@ai-sdk/*`) are in v2/v5 which are relatively new. The Vercel AI SDK v5 introduced significant streaming API changes. A `npm install` after a new minor could break the `createUIMessageStreamResponse` / `streamText` usage (`app/api/ai/book-search/route.ts`).

**Recommendation:** Pin all `@ai-sdk/*` and `ai` to exact versions. Use `npm ci` in CI/CD.

---

## Recommendations

### Immediate (address before scaling)

1. **Add `SET search_path = public` to `handle_new_user`** — patch `001_initial_schema.sql` via a new migration. Low effort, security hardening.

2. **Fix `protect_admin_columns` role check** — replace `current_setting('role', true)` with `current_user` or JWT claim check. Low effort, correctness.

3. **Replace `ilike` search with `textSearch`** — use Supabase `.textSearch('title', query)` to leverage existing GIN indexes. Medium effort, significant search performance at scale.

4. **Migrate in-memory caches to `unstable_cache` or Vercel KV** — `getTrulyTrending` and Mapbox MCP cache. Low-to-medium effort.

### Short Term (next sprint)

5. **Eliminate duplicate `auth.getUser()` calls** — pass user context down from layout to page components via React Context or layout data props. Medium effort.

6. **Replace `getAllGenres` JavaScript aggregation with SQL** — `SELECT DISTINCT UNNEST(genres) FROM books ORDER BY 1`. Low effort.

7. **Consolidate community feed queries** — use FK join in `lib/queries/home.ts:getCommunityFeed` instead of two-query approach.

8. **Pin AI SDK dependency versions exactly** — prevents surprise breakages from upstream API changes.

### Medium Term (before significant user growth)

9. **Externalise personalised recommendation scoring** — move to PostgreSQL function, materialised view, or pre-computed cache.

10. **Implement weekly digest queue architecture** — Inngest or Vercel Queue to handle 500+ user digest sends within timeout constraints.

11. **Add `activity_feed` archival policy** — partition or soft-delete entries older than 6 months.

12. **Add username uniqueness collision handling to `handle_new_user` trigger** — use suffix strategy similar to `insertBookWithUniqueSlug`.

---

*Assessment based on static code analysis of commit `55d3b7b` (main branch, 2026-02-17). No source code was modified.*
