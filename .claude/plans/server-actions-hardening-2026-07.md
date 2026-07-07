# OhMyReads - Server Actions Hardening (Zod + Rate Limits)

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
| 1 | Harden shelves + lists | 🔴 Critical | Medium | [ ] Pending | `lib/actions/shelves.ts`, `lib/actions/lists.ts`, `lib/validation/shelf.ts`, `lib/validation/list.ts` |
| 2 | Harden clubs + messages (+ remove debug log) | 🔴 Critical | Medium | [ ] Pending | `lib/actions/clubs.ts`, `lib/actions/messages.ts`, `lib/validation/club.ts`, `lib/validation/message.ts` |
| 3 | Harden follows + friends | 🟠 High | Low | [ ] Pending | `lib/actions/follows.ts`, `lib/actions/friends.ts`, `lib/validation/social.ts` |
| 4 | Harden books + challenges + goals + checkins | 🟠 High | Medium | [ ] Pending | `lib/actions/books.ts`, `lib/actions/challenges.ts`, `lib/actions/goals.ts`, `lib/actions/checkins.ts`, `lib/validation/*` |
| 5 | Harden badges + email + import + location + places + privacy | 🟡 Medium | Medium | [ ] Pending | 6 action files, `lib/validation/*` |
| 6 | Harden the 5 admin-* action files | 🟠 High | Medium | [ ] Pending | `lib/actions/admin-*.ts`, `lib/validation/admin.ts` |
| 7 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/7 complete**

## Summary

Only 5 of 26 server-action files validate input with Zod (`reviews.ts`, `taste.ts`, `user.ts`, `book-submissions.ts`, `comments.ts`) and only 7 call `checkRateLimit` (`reviews`, `taste`, `messages`, `location`, `comments`, `places`, `checkins`). The remaining files hand-roll checks or accept raw input — e.g. `updateBookShelves` in `shelves.ts` accepts an unbounded `shelfIds: string[]`. This plan brings every mutating action up to the gold-standard pattern in `lib/actions/reviews.ts:33-121`: auth check → rate limit (keyed by user id) → Zod `safeParse` → business logic. **Function signatures and return shapes must NOT change** — callers across `components/` depend on them.

## The Pattern (copy this exactly)

Reference implementation: `lib/actions/reviews.ts:33-121`. Every hardened mutating action follows this order:

```ts
export async function someAction(input: SomeInput) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "You must be logged in ..." };   // keep each file's existing error wording
    }
    // Rate limit: keyed by USER ID (not IP) for authed actions
    const { allowed } = await checkRateLimit(`<domain>:${user.id}`, <N>, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }
    const validationResult = someSchema.safeParse(input);
    if (!validationResult.success) {
      return { error: validationResult.error.issues[0]?.message || "Invalid input" };
    }
    const data = validationResult.data;
    // ... existing business logic, using `data.*` instead of raw input
  } catch (error) { /* keep existing catch */ }
}
```

**Universal rules for every task below:**
- Schemas live in `lib/validation/<domain>.ts`, exported alongside inferred types (`export type XInput = z.infer<typeof xSchema>`). Copy the file style of `lib/validation/review.ts` (read it first), including its exact UUID idiom — reuse whatever it uses (Zod v4: `z.string().uuid()` rejects nil/non-v4 UUIDs; never hand-write a different UUID regex).
- Do NOT change exported function names, parameter shapes, or return shapes (`{ error }` / `{ success, ... }`).
- Keep existing business-logic checks (ownership, duplicates) — Zod replaces only the *shape* validation (trim/length/type checks).
- Cap every array input: max 50 items unless the existing UI clearly needs more.
- Cap every free-text string: names/titles ≤ 100 chars, descriptions ≤ 2000, message content ≤ 2000.
- Rate limits: creation actions 10/min, updates 20/min, deletes 20/min, social toggles (follow/like) 30/min — per user id.
- Only MUTATING actions get rate limits. Read-only exported functions (pure `select`) get neither Zod-blocking nor rate limits, but DO get UUID validation on id params if they interpolate ids into queries.
- If a file's mutation already has `checkRateLimit`, leave its limits as-is; only add Zod.
- After each file, run `npm run test:run` — existing tests for `comments`/`reviews` must stay green.

## Task 1: Harden shelves + lists

**Source:** Code-quality audit 2026-07-07 — `shelves.ts:81-83,176-178` manual trim checks only; `updateBookShelves` (`shelves.ts:428`) accepts unbounded `shelfIds`; `lists.ts:27` inline length check
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `lib/actions/shelves.ts`, `lib/actions/lists.ts`, `lib/validation/shelf.ts` (new), `lib/validation/list.ts` (new)

**Context:** Shelves and lists are the highest-volume write paths with zero schema validation and zero rate limiting. `shelves.ts` is ~850 lines with many exported functions.

**Steps:**
1. [ ] Read `lib/validation/review.ts` fully — this is the schema-file style to copy.
2. [ ] Read `lib/actions/shelves.ts` and list every exported function. Classify each as mutating or read-only.
3. [ ] Create `lib/validation/shelf.ts`: one schema per mutating function's input (shelf name 1–100 chars trimmed, `shelfIds` array of UUIDs `.max(50)`, book ids as UUIDs).
4. [ ] Wire the pattern into every mutating function in `shelves.ts`: rate limit key `shelf:${user.id}` (10/min creates, 30/min for add/remove-book toggles), then `safeParse`. Replace the manual `name.trim().length` checks with the schema (schema does `.trim()`).
5. [ ] Repeat for `lib/actions/lists.ts` with `lib/validation/list.ts` (list title 3–100 chars to preserve the existing `< 3` rule at `lists.ts:27`, description ≤ 2000, item arrays `.max(50)`), rate key `list:${user.id}`.
6. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -c "safeParse" lib/actions/shelves.ts` ≥ number of mutating functions (count them in Completed Notes)
- [ ] `grep -c "checkRateLimit" lib/actions/shelves.ts` ≥ 1 and `grep -c "checkRateLimit" lib/actions/lists.ts` ≥ 1
- [ ] `npm run test:run` exits 0
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Harden clubs + messages (+ remove debug log)

**Source:** Audit — `clubs.ts:29` inline check, no rate limit; `clubs.ts:22` logs user id (`console.log("[createClub] User:", ...)`); `messages.ts` has rate limit but no Zod/content cap
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `lib/actions/clubs.ts`, `lib/actions/messages.ts`, `lib/validation/club.ts` (new), `lib/validation/message.ts` (new)

**Context:** Messages are user-to-user content (abuse surface); clubs currently log PII to console.

**Steps:**
1. [ ] Delete the `console.log` at `lib/actions/clubs.ts:22` (and any other `console.log` lines in the file that print user ids — keep `console.error` in catch blocks).
2. [ ] Create `lib/validation/club.ts`: club name 3–100 chars (preserves existing `< 3` rule), description ≤ 2000, UUIDs for ids.
3. [ ] Wire pattern into all mutating functions in `clubs.ts`; rate key `club:${user.id}` (10/min creates, 20/min joins/updates).
4. [ ] Create `lib/validation/message.ts`: `receiverId` UUID, `content` trimmed 1–2000 chars.
5. [ ] Wire `safeParse` into `messages.ts` mutations (rate limiting already exists there — do not change its keys/limits).
6. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -n "console.log" lib/actions/clubs.ts` returns nothing
- [ ] `grep -c "safeParse" lib/actions/clubs.ts` ≥ 1 and same for `messages.ts`
- [ ] `grep -c "checkRateLimit" lib/actions/clubs.ts` ≥ 1
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Harden follows + friends

**Source:** Audit — spammable social writes, no validation, no rate limit
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `lib/actions/follows.ts`, `lib/actions/friends.ts`, `lib/validation/social.ts` (new)

**Context:** Follow/unfollow and friend-request actions take a single target user id. Main risks: non-UUID injection into queries and follow-spam.

**Steps:**
1. [ ] Create `lib/validation/social.ts`: a `targetUserIdSchema` (single UUID) — one shared schema file for both actions.
2. [ ] Wire pattern into all mutating functions in both files. Rate keys `follow:${user.id}` and `friend:${user.id}`, 30/min (toggles are legitimately rapid).
3. [ ] Preserve any existing self-follow/self-friend guards.
4. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -c "safeParse" lib/actions/follows.ts` ≥ 1 and same for `friends.ts`
- [ ] `grep -c "checkRateLimit" lib/actions/follows.ts` ≥ 1 and same for `friends.ts`
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 4: Harden books + challenges + goals + checkins

**Source:** Audit — no Zod in any of the four; no rate limit in `books`, `challenges`, `goals`
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/actions/books.ts`, `lib/actions/challenges.ts`, `lib/actions/goals.ts`, `lib/actions/checkins.ts`, new schemas in `lib/validation/`

**Context:** `checkins.ts` already rate-limits — add Zod only there. Goals/challenges take numeric targets (validate as positive integers with sane caps, e.g. `target ≤ 10000`). Books actions may include reading-progress updates (page numbers: non-negative integers ≤ 50000).

**Steps:**
1. [ ] For each file: read it, list mutating functions, create matching schema file (`lib/validation/book-action.ts`, `challenge.ts`, `goal.ts`, `checkin.ts`), wire the pattern.
2. [ ] Rate keys: `book:${user.id}` 20/min, `challenge:${user.id}` 10/min, `goal:${user.id}` 10/min. `checkins.ts`: keep existing rate limiting untouched.
3. [ ] Edge case: dates (goal deadlines, challenge ranges) — validate as ISO strings the way `lib/validation/` schemas already handle dates (check `taste.ts`/`book-submission.ts` for the existing idiom and reuse it).
4. [ ] Edge case: `rating` fields are OPTIONAL/nullable everywhere (design decision Mar 2026) — never make rating required in a schema.
5. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -c "safeParse"` ≥ 1 in each of the four action files
- [ ] `grep -c "checkRateLimit"` ≥ 1 in `books.ts`, `challenges.ts`, `goals.ts`
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 5: Harden badges + email + import + location + places + privacy

**Source:** Audit — remaining non-admin files without Zod
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `lib/actions/badges.ts`, `lib/actions/email.ts`, `lib/actions/import.ts`, `lib/actions/location.ts`, `lib/actions/places.ts`, `lib/actions/privacy.ts`, new schemas in `lib/validation/`

**Context:** Mixed bag. `location.ts` and `places.ts` already rate-limit (add Zod only). `import.ts` handles CSV imports — validate the parsed row count (`.max(1000)` rows) and per-row fields, not the raw file. `email.ts` may be internally-called only — if a function is never called from a client component (check with `grep -rn "from \"@/lib/actions/email\"" app/ components/`), note it in Completed Notes and still add schema validation for defense in depth.
**Steps:**
1. [ ] For each file: read, classify functions, create/extend schema files, wire the pattern.
2. [ ] Rate keys for files lacking them: `badge:${user.id}` 20/min, `email:${user.id}` 5/min, `import:${user.id}` 3/min (imports are heavy), `privacy:${user.id}` 10/min.
3. [ ] `location.ts` edge case: latitude must be `z.number().min(-90).max(90)`, longitude `.min(-180).max(180)`.
4. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -c "safeParse"` ≥ 1 in each of the six files
- [ ] `grep -c "checkRateLimit"` ≥ 1 in `badges.ts`, `email.ts`, `import.ts`, `privacy.ts`
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 6: Harden the 5 admin-* action files

**Source:** Audit — admin actions have auth but no schema validation
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/actions/admin-books.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/admin-import.ts`, `lib/actions/admin-reviews.ts`, `lib/actions/admin-users.ts`, `lib/validation/admin.ts` (new)

**Context:** Admin actions mutate other users' data — the blast radius of malformed input is highest here. Every admin action must ALREADY check `is_admin`; while wiring Zod, verify that check exists in each function and flag any that lack it in Completed Notes (do not silently fix — report).

**Steps:**
1. [ ] For each of the 5 files: read, list mutating functions, confirm each checks admin status before mutating (note any that don't).
2. [ ] Create `lib/validation/admin.ts` with schemas grouped by domain (book edits, user role changes, review moderation). Book URLs (`cover_url` etc.): validate with `z.string().url().max(2000)`.
3. [ ] Wire `safeParse` into every mutating admin function. Rate key `admin:${user.id}` 30/min (admins do bulk work — do not go lower).
4. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `grep -c "safeParse"` ≥ 1 in each of the 5 admin files
- [ ] `grep -c "checkRateLimit"` ≥ 1 in each of the 5 admin files
- [ ] Completed Notes explicitly states whether every admin function had an admin check (yes/no + list)
- [ ] `npm run test:run` and `npm run build` exit 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 7: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] Run `grep -L "safeParse" lib/actions/*.ts` — the output must be EMPTY or contain only files that have zero mutating functions (justify each in Completed Notes).
2. [ ] Run `grep -L "checkRateLimit" lib/actions/*.ts` — output must contain only files with zero mutating functions (justify each).
3. [ ] Run `npm run typecheck` (if script exists), `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
4. [ ] Manual smoke test: `npm run dev`, log in, create a shelf, add a book to it, send a message — all succeed.

**Verify:**
- [ ] Both grep checks pass with justifications recorded
- [ ] All four npm commands exit 0
- [ ] Manual smoke test passes (if blocked — no dev login available — use status `CODE COMPLETE - Verification blocked` and say so)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Replacing 191 raw `console.*` calls with `lib/utils/log.ts` | Separate mechanical sweep; only PII logs removed here | Logging cleanup pass |
| Rate limiting read-only queries | Low risk, high noise | If abuse observed |
| Tests for the new schemas | Covered by `test-coverage-core-2026-07.md` (plan #8) | Plan #8 |
| CSRF origin checks on server actions | Next.js server actions have built-in origin protection | N/A |

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
