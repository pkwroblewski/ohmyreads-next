# OhMyReads - AI Routes: Caching, Latency, Cost Caps

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
| 1 | curated-picks: KV cache + parallel calls + structured output | 🟠 High | Medium | [ ] Pending | `app/api/ai/curated-picks/route.ts` |
| 2 | trending-insights: parallelize LLM fan-out | 🟠 High | Low | [ ] Pending | `app/api/ai/trending-insights/route.ts` |
| 3 | Output-token caps on all AI calls | 🟡 Medium | Low | [ ] Pending | all 4 `app/api/ai/*/route.ts` |
| 4 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/4 complete**

## Summary

Three defects in the AI routes (verified 2026-07-07): (1) `curated-picks/route.ts:9` caches in a **module-level `Map`** — on Vercel serverless each instance has its own Map, so the "1 hour cache" hits near-0% and every request pays 4 LLM calls; (2) those 4 calls run **sequentially** in a `for` loop (`:143`), and `trending-insights` runs 7 sequentially — 4–7× the necessary latency; (3) **no output-token caps** anywhere, and JSON is scraped out of prose with `match(/\{[\s\S]*\}/)` (`:160`) instead of AI SDK structured output. Fixes: Vercel KV cache (already a dependency — `lib/utils/rate-limit.ts:21` imports `@vercel/kv`), `Promise.all`, `maxOutputTokens`, `generateObject`. Note: cache is **per-user** (key `curated:${user.id}` / `curated:anonymous`) — that's why `unstable_cache` with a static key (the `trending-insights:149` pattern) is NOT reused here; KV with dynamic keys is the right tool.

**AI SDK version guardrails for the executor:** this repo uses the `ai` package v5 line. The option is `maxOutputTokens` (NOT `maxTokens`). Structured output = `generateObject({ model, schema, system, prompt })` → result in `.object` (typed by the Zod schema, no parsing). Import: `import { generateObject } from "ai"`. If `generateObject` is not exported by the installed version (check `node_modules/ai/dist/index.d.ts` or just try the import and typecheck), fall back to keeping `generateText` + existing regex parsing and note it — do not upgrade dependencies in this plan.

## Task 1: curated-picks — KV cache + parallel calls + structured output

**Source:** Code-quality audit 2026-07-07 — `curated-picks/route.ts:9,143,160`
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `app/api/ai/curated-picks/route.ts`

**Context:** Read the whole route first (~203 lines). Keep ALL existing graceful-degradation behavior: no-model fallback (`:110-119`), per-book catch fallbacks (`:175-189`), top-level catch. The response shape `{ picks, cached }` must not change (caller: find with `grep -rn "curated-picks" components/ app/ --include="*.tsx"`).

**Steps:**
1. [ ] Delete the module-level `curatedCache` Map and `CACHE_TTL` (`:8-10`).
2. [ ] Add `import { kv } from "@vercel/kv";` and replace the cache read (`:43-47`) with:
   ```ts
   const cacheKey = user ? `curated:${user.id}` : "curated:anonymous";
   let cached: CuratedPick[] | null = null;
   try {
     cached = await kv.get<CuratedPick[]>(cacheKey);
   } catch { /* KV unavailable (local dev) — proceed uncached */ }
   if (cached) {
     return NextResponse.json({ picks: cached, cached: true });
   }
   ```
   The try/catch is REQUIRED: local dev has no KV env vars and `kv.get` throws — the route must still work uncached. (See how `lib/utils/rate-limit.ts` guards its KV usage for the existing precedent.)
3. [ ] Replace the cache write (`:193`) with `try { await kv.set(cacheKey, picks, { ex: 3600 }); } catch {}` — `ex` is SECONDS (3600 = 1h), not ms.
4. [ ] Parallelize: convert the sequential `for (const book of recommendedBooks)` loop (`:143-190`) to:
   ```ts
   const picks = await Promise.all(recommendedBooks.map(async (book): Promise<CuratedPick> => { ...one book's logic, returning its pick or its fallback pick... }));
   ```
   Each mapped function keeps its own try/catch fallback so one failed call degrades ONLY that pick.
5. [ ] Structured output: inside the per-book function, replace `generateText` + regex with:
   ```ts
   const pickSchema = z.object({
     reason: z.string().max(200),
     matchType: z.enum(["mood", "theme", "author", "genre", "vibe"]),
   });
   const { object } = await generateObject({ model, schema: pickSchema, system: ..., prompt: ..., maxOutputTokens: 150 });
   ```
   (module-level schema, `import { z } from "zod"`). Keep system/prompt text; delete the "Format as JSON" sentence from the prompt (schema handles it). On throw → existing fallback pick.
6. [ ] Run `npm run build` and `npm run lint`.

**Verify:**
- [ ] `grep -n "new Map" app/api/ai/curated-picks/route.ts` returns nothing
- [ ] `grep -n "Promise.all" app/api/ai/curated-picks/route.ts` matches
- [ ] `grep -n "jsonMatch\|match(/" app/api/ai/curated-picks/route.ts` returns nothing (unless generateObject fallback triggered — then note why)
- [ ] `npm run build` exits 0
- [ ] Dev test: `curl -s "http://localhost:3000/api/ai/curated-picks"` returns `{"picks":[...]}` JSON without 500 (works uncached without KV locally)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: trending-insights — parallelize LLM fan-out

**Source:** Audit — 7 sequential `generateText` calls (`trending-insights/route.ts:77` area)
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/api/ai/trending-insights/route.ts`

**Context:** This route is correctly cached with `unstable_cache` (`:149`) — do NOT touch the caching. Only the call pattern inside the cached function changes. First cache-miss latency drops ~7× .

**Steps:**
1. [ ] Read the route; locate the sequential loop of `generateText` calls.
2. [ ] Convert to `Promise.all` with per-item try/catch fallbacks, same technique as Task 1 step 4 (each item degrades independently; the combined result shape is unchanged).
3. [ ] If the calls feed a shared JSON-regex parse, apply the same `generateObject` conversion as Task 1 step 5 with a matching Zod schema.
4. [ ] Run `npm run build`.

**Verify:**
- [ ] `grep -n "Promise.all" app/api/ai/trending-insights/route.ts` matches
- [ ] `grep -n "unstable_cache" app/api/ai/trending-insights/route.ts` still matches (caching untouched)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Output-token caps on all AI calls

**Source:** Audit — no `maxOutputTokens` anywhere; only step-count and prompt-wording limit output
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `app/api/ai/curated-picks/route.ts`, `app/api/ai/trending-insights/route.ts`, `app/api/ai/book-search/route.ts`, `app/api/ai/place-search/route.ts`

**Context:** A misbehaving model without a cap can emit thousands of tokens per call — cost + latency. Caps sized to each route's actual output.

**Steps:**
1. [ ] Find every `generateText`/`streamText`/`generateObject` call: `grep -n "generateText\|streamText\|generateObject" app/api/ai/*/route.ts lib/ai/*.ts`
2. [ ] Add `maxOutputTokens` to each: curated-picks 150 (done in Task 1); trending-insights 300 per call; book-search `streamText` 1500 (it streams conversational answers + tool calls); place-search 1000.
3. [ ] If any call site is in `lib/ai/tools.ts`/`place-tools.ts` (nested generation inside a tool), cap those at 500.
4. [ ] Run `npm run build`.

**Verify:**
- [ ] For every line matched by the grep in step 1, the same call now has `maxOutputTokens` — re-run the grep with `-A 5` and confirm; state the count in Completed Notes ("N calls, N capped")
- [ ] `npm run build` exits 0
- [ ] Dev test: book-search AI chat still streams a complete (non-truncated) answer for "recommend me a fantasy novel"

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
2. [ ] Dev latency check: hit `/api/ai/curated-picks` twice; record both wall times in Completed Notes. (Locally without KV both are uncached — verifying parallelization only: second call should be roughly similar to first, NOT 4× a single-call time. On production with KV, call 2 would be <200ms — note this expectation.)
3. [ ] Confirm all AI-consuming UI still works in dev: dashboard curated picks section, trending page insights, AI book search.

**Verify:**
- [ ] All three npm commands exit 0
- [ ] Latency numbers recorded
- [ ] UI checks pass (or `CODE COMPLETE - Verification blocked` with reason)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Consolidating 3 AI providers to 1–2 | Strategic/cost decision (comprehensive-plan deferral) | Product decision |
| Vercel AI Gateway migration (`"provider/model"` strings) | Larger refactor of provider wiring | With provider consolidation |
| Personalizing curated-picks candidate selection | Covered by `recommendation-quality-v2-2026-07.md` | Plan #4 |
| Weekly-digest queue architecture | Separate deferred item ("before 500 subscribers") | Growth milestone |

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
