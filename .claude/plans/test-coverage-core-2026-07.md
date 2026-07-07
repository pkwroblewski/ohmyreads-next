# OhMyReads - Test Coverage: Core Utils, Validation, Actions

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

> **DEPENDENCY:** Execute AFTER `server-actions-hardening-2026-07.md` (plan #2). Task 2 below tests the validation schemas that plan creates. If plan #2 is not complete, Task 2 covers only the 4 pre-existing untested schemas and you must note the reduced scope in Completed Notes.

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Unit tests: 6 pure util modules | 🟡 Medium | Medium | [ ] Pending | 6 new files in `__tests__/lib/utils/` |
| 2 | Unit tests: validation schemas | 🟡 Medium | Medium | [ ] Pending | new files in `__tests__/lib/validation/` |
| 3 | Action tests: shelves + messages | 🟠 High | Medium | [ ] Pending | 2 new files in `__tests__/lib/actions/` |
| 4 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/4 complete**

## Summary

5 test files exist (~80 tests) against 26 action files, 21 query files, 18 util files, and 7+ validation schemas. This plan targets the highest value-per-test code: pure utils (zero mocking cost, real bug surface — cover URL fallbacks, sanitization, slugs, geohash), every validation schema (they now guard all server actions after plan #2), and the two riskiest actions (`shelves` — highest write volume; `messages` — user-to-user content). Vitest + happy-dom is already configured (`vitest.config.ts`, `__tests__/setup.ts`). Components, queries, and API routes stay out of scope.

**Fixture rules (all tasks):** valid v4 UUIDs only (e.g. `550e8400-e29b-41d4-a716-446655440000`) — Zod v4 `.uuid()` rejects nil/malformed UUIDs. `rating` is nullable by design — always include a null-rating case. Copy `describe`/`it` style from the existing five test files, not from memory.

## Task 1: Unit tests — 6 pure util modules

**Source:** Coverage gap analysis 2026-07-07 — 1/18 utils tested (only `rate-limit`)
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s) (new):** `__tests__/lib/utils/covers.test.ts`, `sanitize.test.ts`, `slug.test.ts`, `geohash.test.ts`, `format.test.ts`, `affiliate-links.test.ts`

**Context:** These six are pure(ish) modules — no Supabase, no network in their core functions. If a function inside them DOES fetch (e.g. a cover-URL validator that pings a URL), test only its pure siblings and note the skip.

**Steps:**
1. [ ] For each module: read the source file first, list its exported functions, then write tests. Minimum cases per module:
   - `covers.ts`: cover-URL priority/fallback order for a book with all sources vs only open_library id vs none; malformed URL input doesn't throw. (Known context: Open Library covers redirect to archive.org; google placeholder detection is impossible client-side — do not test for it.)
   - `sanitize.ts`: strips/escapes `<script>` payloads; preserves plain text; handles empty string and very long input (10k chars) without throwing.
   - `slug.ts`: basic title → slug; diacritics (`Żółć`), emoji, multiple spaces, leading/trailing hyphens; empty string; two calls with same input are deterministic.
   - `geohash.ts`: known coordinate → known geohash prefix (Luxembourg 49.6116, 6.1319 should start with `u0u6`); precision parameter respected; round-trip/neighbor functions if exported.
   - `format.ts`: each exported formatter with a normal value, a zero/empty value, and a null/undefined value (if signature allows).
   - `affiliate-links.ts`: builds expected URL for a known ISBN/title; encodes special characters; missing-field behavior.
2. [ ] Aim ≥ 5 tests per module (≥ 30 total for this task).
3. [ ] Run `npm run test:run`.

**Verify:**
- [ ] `npm run test:run` exits 0; total test count increased by ≥ 30 (record before/after counts)
- [ ] All 6 new files exist and each has ≥ 5 `it(` blocks (`grep -c "it(" <file>`)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Unit tests — validation schemas

**Source:** Coverage gap — only `review` and `search` schemas tested
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s) (new):** `__tests__/lib/validation/<name>.test.ts` — one per untested schema file in `lib/validation/` (pre-existing: `book-submission`, `comment`, `profile`, `taste`; plus every schema file created by plan #2: `shelf`, `list`, `club`, `message`, `social`, etc. — enumerate with `ls lib/validation/`)

**Context:** These schemas are the security boundary for all server actions after plan #2 — each needs proof it accepts valid input and rejects each class of invalid input. Template: `__tests__/lib/validation/review.test.ts`.

**Steps:**
1. [ ] Run `ls lib/validation/` and `ls __tests__/lib/validation/` — build the list of untested schema files; record it in Completed Notes.
2. [ ] Per schema file, per exported schema, cover: (a) a fully valid input parses and preserves values; (b) each required field missing → failure; (c) each length/size cap: at-cap passes, cap+1 fails (exact boundary, e.g. 100-char name passes, 101 fails); (d) UUID fields: valid v4 passes, `"not-a-uuid"` AND `"00000000-0000-0000-0000-000000000000"` both fail; (e) arrays: at max passes, max+1 fails; (f) trimming: `"  name  "` parses to `"name"` where schema trims.
3. [ ] Run `npm run test:run`.

**Verify:**
- [ ] `npm run test:run` exits 0
- [ ] Every file in `lib/validation/` except `index.ts` has a matching test file — `ls` both dirs and diff; record result
- [ ] Boundary tests assert EXACT limits (a reviewer can grep `101` / `max + 1` style cases)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Action tests — shelves + messages

**Source:** Coverage gap — 24/26 actions untested; these two have the highest blast radius
**Priority:** 🟠 High
**Effort:** Medium
**File(s) (new):** `__tests__/lib/actions/shelves.test.ts`, `__tests__/lib/actions/messages.test.ts`

**Context:** `__tests__/lib/actions/reviews.test.ts` is the template — it already solves mocking `@/lib/supabase/server` and `@/lib/utils/rate-limit`. Read it COMPLETELY and clone its mock setup; do not invent a new mocking strategy.

**Steps:**
1. [ ] Read `__tests__/lib/actions/reviews.test.ts` and `__tests__/setup.ts` in full.
2. [ ] `shelves.test.ts` — for the 3–4 most important exported mutations (e.g. create shelf, add book to shelf, updateBookShelves): unauthenticated → `{ error }` mentioning login; rate-limited (mock `checkRateLimit` → `{ allowed: false }`) → `{ error }`; invalid input (empty name / 51 shelfIds / bad UUID) → `{ error }`, and assert the mocked supabase `insert`/`update` was NOT called; happy path → success shape with mocked DB responses.
3. [ ] `messages.test.ts` — sendMessage: unauthenticated; rate-limited; empty content; 2001-char content; receiverId = own user id (if the action guards this — read the source first and test actual behavior, do not assume); happy path.
4. [ ] Run `npm run test:run`.

**Verify:**
- [ ] `npm run test:run` exits 0; both files ≥ 8 tests each
- [ ] Negative tests assert the DB mutation was NOT called (`expect(mock).not.toHaveBeenCalled()` pattern present in both files)

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
1. [ ] `npm run test:run` — record final total test count (target: ≥ 80 existing + ≥ 60 new).
2. [ ] `npx vitest run --coverage` — record coverage % for `lib/validation/` (target: every file ≥ 90% lines) and `lib/utils/` (the 6 tested modules ≥ 80%).
3. [ ] `npm run lint` and `npm run build` — exit 0.

**Verify:**
- [ ] All commands exit 0
- [ ] Coverage numbers recorded in Completed Notes with the targets met (or shortfall explained per-file)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Component tests (144 components) | Different tooling investment (testing-library) | Dedicated testing sprint |
| Query-layer tests (21 files) | Requires Supabase test doubles or local db | After test-db decision |
| API route tests | Needs request mocking harness | With query tests |
| E2E (Playwright) | Infra decision | Pre-launch hardening |
| Coverage thresholds in vitest.config | Add once baseline is known from Task 4 | Immediately after this plan |

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
