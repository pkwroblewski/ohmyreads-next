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
| 1 | Auth-gate `/api/geo/nearby-places` | 🔴 Critical | Low | [ ] Pending | `app/api/geo/nearby-places/route.ts` |
| 2 | Origin check on all 6 external-API geo routes | 🟠 High | Low | [ ] Pending | 6 route files under `app/api/geo/` |
| 3 | Tighten per-minute limits + add daily caps | 🟠 High | Low | [ ] Pending | `directions`, `isochrone`, `places/enrich` routes |
| 4 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/4 complete**

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
1. [ ] Re-verify the caller claim: run `grep -rn "nearby-places" components/ app/ lib/ --include="*.ts" --include="*.tsx" | grep -v "app/api"`. If any caller is on a public page, STOP and mark this task `[-] BLOCKED` with findings.
2. [ ] In `app/api/geo/nearby-places/route.ts`, after the existing rate-limit block, add the auth guard (copy the exact idiom from `app/api/ai/curated-picks/route.ts:39-40`, but return 401 when no user):
   ```ts
   const supabase = await createClient();
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```
   Import `createClient` from `@/lib/supabase/server` (check the file's existing imports first — don't duplicate).
3. [ ] Change the rate-limit key from IP to user: `` `geo-nearby:${user.id}` `` (move the `checkRateLimit` call AFTER the auth guard so `user` is in scope; keep 30/min).
4. [ ] Run `npm run build`.

**Verify:**
- [ ] `grep -n "getUser" app/api/geo/nearby-places/route.ts` returns ≥ 1 match
- [ ] `npm run dev` then `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/geo/nearby-places?lat=49.6&lng=6.1"` returns `401`
- [ ] Logged-in dashboard still shows "Places near you" (manual check; if login unavailable, mark `CODE COMPLETE - Verification blocked`)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Origin check on all 6 external-API geo routes

**Source:** Audit — cross-site abuse of paid proxies
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/api/geo/directions/route.ts`, `app/api/geo/isochrone/route.ts`, `app/api/geo/search/route.ts`, `app/api/geo/nearby-places/route.ts`, `app/api/geo/ip-location/route.ts`, `app/api/geo/places/enrich/route.ts`

**Context:** The repo already has a CSRF/origin utility at `lib/utils/csrf.ts` (added in security-audit-2026-02-07) used by `app/api/ai/book-search/route.ts`. Browsers send an `Origin` header on all cross-origin fetches — rejecting foreign origins blocks other websites from farming these endpoints via visitors' browsers. Same-origin GETs may omit the header, so the rule is: **reject only when Origin/Referer is present AND foreign; allow when absent.**

**Steps:**
1. [ ] Read `lib/utils/csrf.ts` fully. If it exports a check usable for GET routes with the allow-when-absent semantics above, reuse it. If it is POST-only/strict (rejects missing Origin), add a new exported function `isForeignOrigin(request: NextRequest): boolean` to `lib/utils/csrf.ts` that returns true only when an `origin` (or, failing that, `referer`) header exists and its host differs from the request's own host (`request.nextUrl.host`) and from `ohmyreads.vercel.app`.
2. [ ] In each of the 6 route files, add as the FIRST check in the handler:
   ```ts
   if (isForeignOrigin(request)) {
     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
   }
   ```
3. [ ] Run `npm run build`.

**Verify:**
- [ ] `grep -l "isForeignOrigin\|<name of reused csrf fn>" app/api/geo/directions/route.ts app/api/geo/isochrone/route.ts app/api/geo/search/route.ts app/api/geo/nearby-places/route.ts app/api/geo/ip-location/route.ts app/api/geo/places/enrich/route.ts` lists all 6 files
- [ ] `npm run dev` then `curl -s -o /dev/null -w "%{http_code}" -H "Origin: https://evil.example" "http://localhost:3000/api/geo/ip-location"` returns `403`
- [ ] Same curl WITHOUT the Origin header does NOT return 403
- [ ] The public map at `http://localhost:3000/community/map` still loads readers/places and search works (manual)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Tighten per-minute limits + add daily caps

**Source:** Audit — `directions` at 60/min/IP is generous for a paid API; no daily backstop anywhere
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/api/geo/directions/route.ts`, `app/api/geo/isochrone/route.ts`, `app/api/geo/places/enrich/route.ts`

**Context:** `checkRateLimit(key, max, windowMs)` from `lib/utils/rate-limit.ts` is KV-backed and supports any window. A second call with a 24h window gives a daily cap. A human user gets directions a handful of times per session — 15/min and 100/day is ample.

**Steps:**
1. [ ] In `directions/route.ts`: change `checkRateLimit(\`geo-directions:${ip}\`, 60, 60000)` → `(..., 15, 60000)`. Directly below it, add a daily cap:
   ```ts
   const daily = await checkRateLimit(`geo-directions-daily:${ip}`, 100, 86400000);
   if (!daily.allowed) {
     return NextResponse.json({ error: "Daily limit reached." }, { status: 429 });
   }
   ```
2. [ ] In `isochrone/route.ts`: 30/min → 10/min; add daily cap 50/day (key `geo-isochrone-daily:${ip}`).
3. [ ] In `places/enrich/route.ts`: keep 20/min; add daily cap 200/day (key `places-enrich-daily:${ip}`).
4. [ ] Match each file's existing 429 response shape exactly (read the existing `if (!allowed)` block and mirror it).
5. [ ] Run `npm run build`.

**Verify:**
- [ ] `grep -n "86400000" app/api/geo/directions/route.ts app/api/geo/isochrone/route.ts app/api/geo/places/enrich/route.ts` shows 1 match per file
- [ ] `grep -n "15, 60000" app/api/geo/directions/route.ts` and `grep -n "10, 60000" app/api/geo/isochrone/route.ts` each match
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 4: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [ ] Manual: `npm run dev`, open `/community/map` — map loads, readers/places render, place search works, clicking a place shows details (enrich route), directions work from a place panel.
3. [ ] Curl matrix (record actual codes in Completed Notes): nearby-places no-auth → 401; ip-location foreign Origin → 403; ip-location no Origin → not 403.

**Verify:**
- [ ] All three npm commands exit 0
- [ ] Map manual test passes (or `CODE COMPLETE - Verification blocked` with reason)
- [ ] Curl matrix recorded with expected codes

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

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

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (manual test)
- [ ] No console errors

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
