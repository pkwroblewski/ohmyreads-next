# OhMyReads - Geo API Cost Protection

> **Workflow:**
> 1. Read this file
> 2. Find first PENDING task
> 3. Execute all steps (check off as you go)
> 4. Complete all verify checks
> 5. Fill in "Completed Notes" section
> 6. Change status from `[ ] PENDING` to `[x] COMPLETE`
> 7. Update progress counter in Status table
> 8. User runs `/clear` to reset context
> 9. Repeat from step 1

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Auth-gate `/api/geo/nearby-places` | 🔴 Critical | Low | [x] Complete | `app/api/geo/nearby-places/route.ts` |
| 2 | Origin check on all 6 external-API geo routes | 🟠 High | Low | [x] Complete | 6 route files under `app/api/geo/` + `lib/utils/csrf.ts` |
| 3 | Tighten per-minute limits + add daily caps | 🟠 High | Low | [x] Complete | `directions`, `isochrone`, `places/enrich` routes |
| 4 | Final QA | 🔴 Critical | Low | [x] Code Complete - Verification blocked | - |

**Progress: 4/4 done (task 4: all automated checks + curl matrix + map/search manual test green; only the place-panel details/directions UI flow is deferred to prod — needs place data + Mapbox MCP/Google Places keys, absent locally)**

## Summary

Six API routes proxy **paid/quota'd external APIs** (Mapbox and place-enrichment) with only per-IP rate limits and no auth or origin checks: `directions` (60/min/IP), `isochrone` (30/min), `search` (20/min), `nearby-places` (30/min), `ip-location` (10/min), `places/enrich` (20/min). An attacker rotating IPs can run up the Mapbox bill. This plan: (a) auth-gates `nearby-places` (its ONLY caller is the authenticated dashboard — `components/dashboard/places-near-you.tsx:79`); (b) adds a same-origin check to all six (cheap cross-site abuse block); (c) cuts per-minute limits and adds per-day caps on the three most expensive routes.

**Scope note (verified 2026-07-07):** the January map audit's XSS/debounce/aria-live findings are ALREADY FIXED in `components/geo/reader-map-immersive.tsx` (markers use `createElement`+`textContent`, `moveEndTimeoutRef` debounce at :736, `aria-live` at :1124). Do not touch that component. The remaining public-map routes (`directions`, `isochrone`, `search`, `ip-location`, `enrich`) CANNOT be auth-gated because `/community/map` is a public page — they get origin checks + tighter limits instead.

## Task 1: Auth-gate `/api/geo/nearby-places`

**Source:** Code-quality audit 2026-07-07 — paid-API route callable anonymously; sole caller is authed dashboard
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `app/api/geo/nearby-places/route.ts`

**Context:** `grep -rn "api/geo/nearby-places" components/ app/ lib/` shows exactly one caller: `components/dashboard/places-near-you.tsx:79`, which renders only on the authenticated dashboard. Requiring auth breaks nothing.

**Steps:**
1. [x] Re-verify the caller claim: run `grep -rn "nearby-places" components/ app/ lib/ --include="*.ts" --include="*.tsx" | grep -v "app/api"`. If any caller is on a public page, STOP and mark this task `[-] BLOCKED` with findings.
2. [x] In `app/api/geo/nearby-places/route.ts`, after the existing rate-limit block, add the auth guard (copy the exact idiom from `app/api/ai/curated-picks/route.ts:39-40`, but return 401 when no user):
   ```ts
   const supabase = await createClient();
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```
   Import `createClient` from `@/lib/supabase/server` (check the file's existing imports first — don't duplicate).
3. [x] Change the rate-limit key from IP to user: `` `geo-nearby:${user.id}` `` (move the `checkRateLimit` call AFTER the auth guard so `user` is in scope; keep 30/min).
4. [x] Run `npm run build`.

**Verify:**
- [x] `grep -n "getUser" app/api/geo/nearby-places/route.ts` returns ≥ 1 match (line 35)
- [x] `npm run dev` then `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/geo/nearby-places?lat=49.6&lng=6.1"` returns `401` ✓ (verified live against dev server)
- [x] Logged-in dashboard still shows "Places near you" — **verified 2026-07-07 during task 2**: Playwright browser session on localhost:3000 was logged in (Paul / myreadersplatform@gmail.com); the widget hides itself when geolocation is denied (Playwright default), so verified via `page.evaluate(fetch('/api/geo/nearby-places?lat=49.6116&lng=6.1319&limit=3'))` from the logged-in dashboard page — the exact call the widget makes — returned 200 with 3 places (first: "Café Bora")
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `app/api/geo/nearby-places/route.ts`
- Approach taken: Step 1 grep confirmed exactly one caller (`components/dashboard/places-near-you.tsx:79`, authenticated dashboard widget) — safe to gate. Auth guard placed FIRST in the handler (before the rate limit, not after as the step's prose said — see deviations), copying the curated-picks `getUser` idiom with a 401 on no user. Rate limit re-keyed from `geo-nearby:${ip}` to `geo-nearby:${user.id}` (still 30/min). The auth client variable is named `authClient` (not `supabase`) because the function body already uses `supabase = createPublicClient()` inside the try block — per the project gotcha about renaming second client instances. `getClientIp` import removed (no longer used).
- Deviations from plan: (1) Step 2 said to add the auth guard "after the existing rate-limit block" while step 3 said to move the rate limit after the auth guard — contradictory; followed step 3's end state (auth → rate limit), which matches the hardening pattern used across all server actions. (2) Left the `Cache-Control: public, s-maxage=300` response headers untouched: the response depends only on lat/lng query params (no user data), so shared caching keyed by URL remains semantically safe post-gating.
- Issues encountered: None. The logged-in dashboard widget check needs a dev login (Google OAuth from localhost lands on prod) — same blocker as the server-actions smoke test; verify with the widget on `/dashboard` when logged in.

**Status:** [x] COMPLETE (401-when-anonymous verified live via curl; logged-in fetch verified 200 with places via Playwright on 2026-07-07)

## Task 2: Origin check on all 6 external-API geo routes

**Source:** Audit — cross-site abuse of paid proxies
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/api/geo/directions/route.ts`, `app/api/geo/isochrone/route.ts`, `app/api/geo/search/route.ts`, `app/api/geo/nearby-places/route.ts`, `app/api/geo/ip-location/route.ts`, `app/api/geo/places/enrich/route.ts`

**Context:** The repo already has a CSRF/origin utility at `lib/utils/csrf.ts` (added in security-audit-2026-02-07) used by `app/api/ai/book-search/route.ts`. Browsers send an `Origin` header on all cross-origin fetches — rejecting foreign origins blocks other websites from farming these endpoints via visitors' browsers. Same-origin GETs may omit the header, so the rule is: **reject only when Origin/Referer is present AND foreign; allow when absent.**

**Steps:**
1. [x] Read `lib/utils/csrf.ts` fully. If it exports a check usable for GET routes with the allow-when-absent semantics above, reuse it. If it is POST-only/strict (rejects missing Origin), add a new exported function `isForeignOrigin(request: NextRequest): boolean` to `lib/utils/csrf.ts` that returns true only when an `origin` (or, failing that, `referer`) header exists and its host differs from the request's own host (`request.nextUrl.host`) and from `ohmyreads.vercel.app`.
2. [x] In each of the 6 route files, add as the FIRST check in the handler:
   ```ts
   if (isForeignOrigin(request)) {
     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
   }
   ```
3. [x] Run `npm run build`.

**Verify:**
- [x] `grep -l "isForeignOrigin"` lists all 6 files ✓
- [x] `curl -H "Origin: https://evil.example" http://localhost:3000/api/geo/ip-location` → `403` ✓ (also 403 on all other 5 routes, and on foreign `Referer`)
- [x] Same curl WITHOUT the Origin header → `200` (not 403) ✓; same-origin `Origin: http://localhost:3000` → `200` ✓
- [x] The public map at `http://localhost:3000/community/map` still loads readers/places and search works — verified via Playwright: map tiles render, searching "Berlin" hit `/api/geo/search` (200) and showed results, clicking the result moved the map and fired `/api/geo/readers` + `/api/geo/places` (all 200). Only console errors: pre-existing Radix hydration id mismatch + `events.mapbox.com` telemetry DNS failures (network-blocked env) — neither related to this change.
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/utils/csrf.ts` (new `isForeignOrigin` export), plus the 6 route files: `app/api/geo/{directions,isochrone,search,nearby-places,ip-location}/route.ts` and `app/api/geo/places/enrich/route.ts`
- Approach taken: The existing `validateOrigin` is strict (rejects missing Origin in production) — wrong semantics for public GETs — so added `isForeignOrigin(request: Request)`: returns true only when Origin (or Referer) is present AND its host is not in {request's own host} ∪ {hosts of `ALLOWED_ORIGINS`}. Malformed header values (e.g. `Origin: null` from sandboxed iframes) count as foreign. Each route got the 403 guard as the first statement in its GET handler.
- Deviations from plan: (1) Signature is `Request`, not `NextRequest` — `ip-location/route.ts` types its param as plain `Request` (no `nextUrl`), so the host comes from `new URL(request.url).host`, which works for both. (2) Did NOT hardcode `ohmyreads.vercel.app` as the plan suggested — that isn't even the real prod domain (`ohmyreads-next.vercel.app` per project memory); instead reused the module's `ALLOWED_ORIGINS` (driven by `NEXT_PUBLIC_SITE_URL`), with `.trim()` to survive the stray `\r\n` in `.env.local`'s value. The own-host check covers the serving domain regardless of env config.
- Issues encountered: None. Bonus: the Playwright browser profile is logged in on localhost:3000 (Paul / myreadersplatform@gmail.com), which allowed closing task 1's blocked "logged-in dashboard" verification (see task 1).

**Status:** [x] COMPLETE

## Task 3: Tighten per-minute limits + add daily caps

**Source:** Audit — `directions` at 60/min/IP is generous for a paid API; no daily backstop anywhere
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/api/geo/directions/route.ts`, `app/api/geo/isochrone/route.ts`, `app/api/geo/places/enrich/route.ts`

**Context:** `checkRateLimit(key, max, windowMs)` from `lib/utils/rate-limit.ts` is KV-backed and supports any window. A second call with a 24h window gives a daily cap. A human user gets directions a handful of times per session — 15/min and 100/day is ample.

**Steps:**
1. [x] In `directions/route.ts`: change `checkRateLimit(\`geo-directions:${ip}\`, 60, 60000)` → `(..., 15, 60000)`. Directly below it, add a daily cap:
   ```ts
   const daily = await checkRateLimit(`geo-directions-daily:${ip}`, 100, 86400000);
   if (!daily.allowed) {
     return NextResponse.json({ error: "Daily limit reached." }, { status: 429 });
   }
   ```
2. [x] In `isochrone/route.ts`: 30/min → 10/min; add daily cap 50/day (key `geo-isochrone-daily:${ip}`).
3. [x] In `places/enrich/route.ts`: keep 20/min; add daily cap 200/day (key `places-enrich-daily:${ip}`).
4. [x] Match each file's existing 429 response shape exactly (read the existing `if (!allowed)` block and mirror it).
5. [x] Run `npm run build`.

**Verify:**
- [x] `grep -n "86400000"` shows exactly 1 match per file (directions:42, isochrone:42, enrich:29) ✓
- [x] `15, 60000` in directions:32 and `10, 60000` in isochrone:32 ✓
- [x] `npm run build` exits 0 ✓

**Completed Notes:**
- Files modified: `app/api/geo/directions/route.ts`, `app/api/geo/isochrone/route.ts`, `app/api/geo/places/enrich/route.ts`
- Approach taken: Per-minute limits cut (directions 60→15, isochrone 30→10, enrich unchanged at 20) and a second `checkRateLimit` call with a 24h window (`86400000`) added directly below each per-minute block as a daily backstop: directions 100/day, isochrone 50/day, enrich 200/day. Daily blocks mirror the existing 429 shape (`NextResponse.json({ error }, { status: 429 })`) with the plan's "Daily limit reached." message so clients can distinguish it from the per-minute 429.
- Deviations from plan: None.
- Issues encountered: None. (Step 1 of the plan checked itself off in the same edit batch — all three files changed together since the edits were independent.)

**Status:** [x] COMPLETE

## Task 4: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [x] Manual: `npm run dev`, open `/community/map` — map loads, readers/places render, place search works, clicking a place shows details (enrich route), directions work from a place panel. *(Partially verifiable locally — see notes.)*
3. [x] Curl matrix (record actual codes in Completed Notes): nearby-places no-auth → 401; ip-location foreign Origin → 403; ip-location no Origin → not 403.

**Verify:**
- [x] All three npm commands exit 0 (lint: 0 errors / 25 pre-existing warnings; tests: 80/80 pass; build green)
- [x] Map manual test passes — **partially; using the pre-authorized blocked status for the remainder.** PASSED via Playwright: map loads, tiles render, search (`/api/geo/search` 200) returns and centers on results, layer toggles work, `readers`/`places` endpoints return 200, zero app console errors (only `events.mapbox.com` telemetry DNS failures — network-blocked env). BLOCKED (local env, not regressions): place-panel click → details → directions flow cannot be driven because (a) the community `places` table has no rows in the tested region and Overpass/OSM is unreachable from this environment, so no place markers render; (b) `directions`/`isochrone` return 503 "not configured" locally (no Mapbox MCP env vars) and `enrich` returns its designed `{found:false, reason:"Google Places API not configured"}` — all three responses came back AFTER passing the new origin check, proving the guards don't block legitimate traffic. Full flow needs prod (or a local env with Mapbox MCP + Google Places keys and place data).
- [x] Curl matrix recorded with expected codes (see notes)

**Completed Notes:**
- Files modified: None (QA only; plan file updated).
- Approach taken: Ran the three npm commands sequentially (all exit 0). Started dev server; curl matrix: `nearby-places` no-auth → **401**, `ip-location` foreign Origin → **403**, `ip-location` no Origin → **200**. Playwright walkthrough of `/community/map` as logged-in user (see [[playwright-dev-login]] memory): map + search verified working; route-level checks for `enrich`/`directions`/`isochrone` made from the page context (same-origin fetches, the exact calls the place panel makes) all responded per design.
- Deviations from plan: Place-panel UI portion of step 2 verified at route level instead of via marker clicks — no markers can exist locally (empty community places + Overpass unreachable + Mapbox MCP/Google Places unconfigured in `.env.local`).
- Issues encountered: None caused by this plan. Observations for later: local `.env.local` lacks `MAPBOX_*` MCP vars and `GOOGLE_PLACES_API_KEY` (directions/isochrone 503, enrich found:false locally); community `places` table appears empty around Luxembourg.

**Status:** [x] CODE COMPLETE - Verification blocked (all automated + curl + map/search checks green; place-panel details/directions UI flow needs prod env with place data — pre-authorized by this task's verify wording)

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Refactoring 1255-line `reader-map-immersive.tsx` into hooks | High-risk refactor, audit P1 | Dedicated map sprint |
| Consolidating `readers`+`places` into one endpoint (audit P3) | Moderate refactor, needs perf measurement first | Map sprint |
| Marker clustering (audit V1) | UX feature, not cost/security | Map sprint |
| Fixing 4 `react-hooks/exhaustive-deps` disables in map component (audit Q1) | Stale-closure risk needs careful manual analysis | Map sprint |
| Auth-gating `directions`/`isochrone`/`search`/`ip-location` | Would break the public `/community/map` page — product decision needed | If map goes auth-only |
| Mapbox token URL restrictions (Mapbox dashboard setting) | Not a code change; needs Mapbox account access | User action — recommended! |

## Final QA Checklist

- [x] All files created/modified exist (csrf.ts + 6 geo routes)
- [x] No broken imports or references (build + 80 tests green)
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint` — 0 errors, 25 pre-existing warnings)
- [x] Feature works as expected (manual test — map + search verified; place-panel flow deferred to prod, see Task 4)
- [x] No console errors (only pre-existing Radix hydration mismatch + `events.mapbox.com` DNS failures from the network-blocked env)

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-07-07 | 1 | CODE COMPLETE - Verification blocked | nearby-places auth-gated (401 anonymous, verified live via curl); rate limit re-keyed IP→user.id 30/min; build green; logged-in widget check needs dev login |
| 2026-07-07 | 2 | COMPLETE | `isForeignOrigin` added to csrf.ts; 403 guard first in all 6 geo routes; curl matrix green (foreign Origin/Referer→403, absent/same-origin→200, all 6 routes); /community/map verified working via Playwright; build green |
| 2026-07-07 | 1 | COMPLETE (upgraded) | Blocked verify closed: Playwright session on localhost is logged in; authed fetch to nearby-places from dashboard page → 200 with 3 places |
| 2026-07-07 | 3 | COMPLETE | directions 60→15/min + 100/day, isochrone 30→10/min + 50/day, enrich 20/min + 200/day; daily 429 says "Daily limit reached."; build green |
| 2026-07-07 | 4 | CODE COMPLETE - Verification blocked | lint/tests/build green; curl matrix 401/403/200 as expected; map + search verified via Playwright; place-panel details/directions flow needs prod (no local place data; Mapbox MCP + Google Places unconfigured locally) |
