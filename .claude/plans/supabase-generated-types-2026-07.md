# OhMyReads - Generated Supabase Types

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
| 1 | Generate types + drift report | 🟠 High | Low | [ ] Pending | `types/database.generated.ts` (new), `package.json` |
| 2 | Alias shim: rewire `types/database.ts` onto generated types | 🟠 High | Medium | [ ] Pending | `types/database.ts`, `types/app.ts` (new) |
| 3 | Type the Supabase clients + remove `as unknown as` casts | 🟠 High | Medium | [ ] Pending | `lib/supabase/server.ts`, `client.ts`, `admin.ts`, 3 cast sites |
| 4 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/4 complete**

## Summary

`types/database.ts` (715 lines) is **hand-written** — every one of the 48 migrations must be manually mirrored, and drift is invisible until runtime. Symptom: `as unknown as` casts papering over join typing at `lib/queries/recommendations.ts:83`, `app/api/ai/curated-picks/route.ts:78`, `lib/actions/shelves.ts:837`. This plan generates types from the live schema (project id `bgczdbmqievfilvdzlgl`), keeps ALL existing imports working via an alias shim (so 100+ import sites don't change), types the Supabase clients with the `Database` generic, and removes the casts. This deferred item comes from `bug-fixes-2026-03.md` Out of Scope ("Regenerating Supabase types").

## Task 1: Generate types + drift report

**Source:** Audit — `types/database.ts:1` manual interfaces; deferred in bug-fixes-2026-03.md
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `types/database.generated.ts` (new), `package.json`

**Context:** Requires the Supabase CLI with access to the project. HARD GATE: if generation cannot run, this whole plan is blocked — stop immediately, do not hand-write "generated-looking" types.

**Steps:**
1. [ ] Run `npx supabase --version`. Then attempt: `npx supabase gen types typescript --project-id bgczdbmqievfilvdzlgl --schema public > types/database.generated.ts`
2. [ ] If it fails with an auth error: try `npx supabase login` only if a `SUPABASE_ACCESS_TOKEN` env var is available (check `.env.local`). If no token is available, STOP: set this task to `[-] BLOCKED`, write the exact error in Completed Notes, and tell the user: "Run `npx supabase login` yourself (interactive browser auth), then re-run the generation command above." Do NOT proceed to Task 2.
3. [ ] Sanity-check output: file must start with `export type Json =` and contain `public: {` and `Tables: {`. If it contains an error message instead, treat as failed.
4. [ ] Add script to `package.json`: `"types:gen": "supabase gen types typescript --project-id bgczdbmqievfilvdzlgl --schema public > types/database.generated.ts"`
5. [ ] Drift report: for each interface in the old `types/database.ts` (Profile, Book, etc.), check the generated file has the matching table with the same fields. List every mismatch (missing column, extra column, type difference) in Completed Notes — this list is valuable output even before the swap.

**Verify:**
- [ ] `types/database.generated.ts` exists, > 500 lines, contains `Tables:` and a `profiles:` entry
- [ ] `grep -c "Row:" types/database.generated.ts` ≥ 20 (one per table; repo has ~30+ tables)
- [ ] Drift report written in Completed Notes (even if empty: "no drift found")

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Alias shim — rewire `types/database.ts` onto generated types

**Source:** Continuation of Task 1
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `types/database.ts`, `types/app.ts` (new)

**Context:** ~100+ files import named types (`Profile`, `Book`, ...) from `types/database.ts` (find them: `grep -rln "from \"@/types/database\"" app/ lib/ components/`). Instead of touching every import, `types/database.ts` becomes a shim of aliases into the generated file. Types in the old file that do NOT correspond to a DB table (view models, unions like `AdminRoleChange["action"]` style helpers, enums) move to `types/app.ts`.

**Steps:**
1. [ ] Read the entire current `types/database.ts`. Build two lists: (A) interfaces matching a generated table, (B) app-only types with no table.
2. [ ] Rewrite `types/database.ts` as:
   ```ts
   import type { Database } from "./database.generated";
   export type { Database, Json } from "./database.generated";

   export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
   export type Book = Database["public"]["Tables"]["books"]["Row"];
   // ... one alias per list-A type, matching the generated table name exactly
   ```
   Re-export everything from `types/app.ts` at the bottom (`export * from "./app";`) so list-B imports keep working unchanged.
3. [ ] Create `types/app.ts` with the list-B types moved verbatim.
4. [ ] EDGE CASES:
   - Field-level unions the manual types had (e.g. `action: "granted" | "revoked"`) — generated types may say `string` if the DB column isn't an enum. Where code depends on the narrow union, keep a narrowed alias in `types/app.ts` (e.g. `export type AdminRoleAction = "granted" | "revoked";`) and fix the few usages; do NOT edit the generated file (it gets overwritten by `types:gen`).
   - Nullability differences are REAL drift — the generated (DB-true) version wins; fix consuming code, don't widen types.
   - NEVER hand-edit `types/database.generated.ts`.
5. [ ] Run `npx tsc --noEmit`. Fix resulting errors file-by-file. Expect most errors to be newly-visible nullability — handle with the codebase's existing idioms (`?? null`, optional chaining). If more than ~40 files error, STOP and report the count before continuing.

**Verify:**
- [ ] `npx tsc --noEmit` exits 0
- [ ] `grep -c "Database\[\"public\"\]" types/database.ts` ≥ 15
- [ ] `grep -rn "interface Profile" types/` returns nothing (no duplicated manual table types remain)
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Type the Supabase clients + remove `as unknown as` casts

**Source:** Audit — untyped clients are why join results need casts
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`, `lib/queries/recommendations.ts:83`, `app/api/ai/curated-picks/route.ts:78`, `lib/actions/shelves.ts:837`

**Context:** With `createClient<Database>(...)`, PostgREST infers row and join types, making the casts unnecessary.

**Steps:**
1. [ ] Read the three files in `lib/supabase/`. Add the `Database` generic to every `createServerClient` / `createBrowserClient` / `createClient` call: e.g. `createServerClient<Database>(...)`, importing `type { Database } from "@/types/database"`.
2. [ ] Run `npx tsc --noEmit` — typed clients will surface new errors where code assumed looser shapes. Fix them (again: DB-truth wins).
3. [ ] Remove the three `as unknown as` casts. For joined selects (`books(title, author)`), Supabase types joins from the query string; if inference still yields `T | T[]` ambiguity, the accepted narrow idiom is `Array.isArray(x) ? x[0] : x` — NOT a cast.
4. [ ] Sweep for stragglers: `grep -rn "as unknown as" lib/ app/ components/` — remove every one that a typed client now makes unnecessary; list any that must remain (with one-line justification each) in Completed Notes.
5. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -rn "as unknown as" lib/queries/recommendations.ts app/api/ai/curated-picks/route.ts lib/actions/shelves.ts` returns nothing
- [ ] `grep -n "Database" lib/supabase/server.ts lib/supabase/client.ts lib/supabase/admin.ts` shows the generic on each client
- [ ] `npx tsc --noEmit`, `npm run test:run`, `npm run build` all exit 0

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
1. [ ] `npm run lint`, `npm run test:run`, `npm run build`, `npx tsc --noEmit` — all exit 0.
2. [ ] Manual dev smoke: dashboard loads, a book page loads, `/recommendations` loads, admin users page loads (touches Profile/AdminRoleChange types).
3. [ ] Confirm `types:gen` script re-runs cleanly and produces zero git diff (`npm run types:gen && git diff --stat types/database.generated.ts`).

**Verify:**
- [ ] All four commands exit 0
- [ ] Smoke pages load without console errors (or `CODE COMPLETE - Verification blocked`)
- [ ] `types:gen` reproducibility check passes

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Including `scripts/` in typecheck (`tsconfig.json:33` excludes it) | Separate small change; scripts use own patterns | Type-safety pass |
| DB enums for string-union columns (e.g. `action`) | Requires migrations; types-only plan | Schema sprint |
| Zod-from-DB-types generation (`supazod` etc.) | Extra tooling decision | If schema churn grows |
| CI step running `types:gen` and failing on diff | Needs `SUPABASE_ACCESS_TOKEN` secret in GitHub | After CI plan lands |

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
