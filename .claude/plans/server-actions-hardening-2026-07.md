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
| 1 | Harden shelves + lists | 🔴 Critical | Medium | [x] Complete | `lib/actions/shelves.ts`, `lib/actions/lists.ts`, `lib/validation/shelf.ts`, `lib/validation/list.ts` |
| 2 | Harden clubs + messages (+ remove debug log) | 🔴 Critical | Medium | [x] Complete | `lib/actions/clubs.ts`, `lib/actions/messages.ts`, `lib/validation/club.ts`, `lib/validation/message.ts` |
| 3 | Harden follows + friends | 🟠 High | Low | [x] Complete | `lib/actions/follows.ts`, `lib/actions/friends.ts`, `lib/validation/social.ts` |
| 4 | Harden books + challenges + goals + checkins | 🟠 High | Medium | [x] Complete | `lib/actions/books.ts`, `lib/actions/challenges.ts`, `lib/actions/goals.ts`, `lib/actions/checkins.ts`, `lib/validation/*` |
| 5 | Harden badges + email + import + location + places + privacy | 🟡 Medium | Medium | [x] Complete | 6 action files, `lib/validation/*` |
| 6 | Harden the 5 admin-* action files | 🟠 High | Medium | [x] Complete | `lib/actions/admin-*.ts`, `lib/validation/admin.ts` |
| 7 | Final QA | 🔴 Critical | Low | [x] Code Complete - Verification blocked | `lib/actions/book-submissions.ts`, `lib/actions/user.ts`, `lib/validation/book-submission.ts` |

**Progress: 7/7 complete (task 7: code complete, manual smoke test blocked — no dev login)**

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
1. [x] Read `lib/validation/review.ts` fully — this is the schema-file style to copy.
2. [x] Read `lib/actions/shelves.ts` and list every exported function. Classify each as mutating or read-only.
3. [x] Create `lib/validation/shelf.ts`: one schema per mutating function's input (shelf name 1–100 chars trimmed, `shelfIds` array of UUIDs `.max(50)`, book ids as UUIDs).
4. [x] Wire the pattern into every mutating function in `shelves.ts`: rate limit key `shelf:${user.id}` (10/min creates, 30/min for add/remove-book toggles), then `safeParse`. Replace the manual `name.trim().length` checks with the schema (schema does `.trim()`).
5. [x] Repeat for `lib/actions/lists.ts` with `lib/validation/list.ts` (list title 3–100 chars to preserve the existing `< 3` rule at `lists.ts:27`, description ≤ 2000, item arrays `.max(50)`), rate key `list:${user.id}`.
6. [x] Run `npm run test:run` and `npm run build`.

**Verify:**
- [x] `grep -c "safeParse" lib/actions/shelves.ts` ≥ number of mutating functions (count them in Completed Notes) — 11 occurrences ≥ 8 mutating functions
- [x] `grep -c "checkRateLimit" lib/actions/shelves.ts` ≥ 1 (9) and `grep -c "checkRateLimit" lib/actions/lists.ts` ≥ 1 (7)
- [x] `npm run test:run` exits 0 (80 tests, 5 files, all green)
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/validation/shelf.ts` (new), `lib/validation/list.ts` (new), `lib/actions/shelves.ts`, `lib/actions/lists.ts`
- Approach taken: Copied `review.ts` schema style (`z.string().uuid("...")`, per-field messages, `z.infer` type exports). **shelves.ts** — 11 exported functions: 8 mutating (`createShelf`, `updateShelf`, `deleteShelf`, `addBookToShelf`, `removeBookFromShelf`, `updateBookShelves`, `addBookToShelfByBookId`, `updateBookShelvesByBookId`) all got auth → rate limit → safeParse; 3 read-only (`getBookShelves`, `getBookShelvesByBookId`, `getShelfBooks`) got UUID validation on id params only (no rate limit), per plan rule. `getUserShelves` (no params) untouched. **lists.ts** — all 6 exported functions mutating (`createList`, `updateList`, `deleteList`, `addBookToList`, `removeBookFromList`, `likeList`); all got the full pattern; preserved the `{ success: false, error }` return shape and title 3–100 rule. `shelfIds` arrays capped `.max(50)`; names/titles ≤ 100; descriptions/notes ≤ 2000; color/icon ≤ 50. Manual trim/length checks replaced by schema `.trim()`.
- Deviations from plan: Rate-limit keys use per-operation segments (`shelf:create:`, `shelf:update:`, `shelf:delete:`, `shelf:book:`, `list:create:`, `list:update:`, `list:delete:`, `list:book:`, `list:like:`) instead of a single `shelf:${user.id}` / `list:${user.id}` key — the plan assigns different limits (10/20/30 per min) to different operations, and sharing one KV bucket key across different limits would make them interfere. Limits themselves match the plan (creates 10, updates/deletes 20, book/like toggles 30).
- Issues encountered: None. Minor behavior tightening: `updateList` previously ignored an empty-string title (truthy check); it now returns a validation error — degenerate input no UI caller sends.

**Status:** [x] COMPLETE

## Task 2: Harden clubs + messages (+ remove debug log)

**Source:** Audit — `clubs.ts:29` inline check, no rate limit; `clubs.ts:22` logs user id (`console.log("[createClub] User:", ...)`); `messages.ts` has rate limit but no Zod/content cap
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `lib/actions/clubs.ts`, `lib/actions/messages.ts`, `lib/validation/club.ts` (new), `lib/validation/message.ts` (new)

**Context:** Messages are user-to-user content (abuse surface); clubs currently log PII to console.

**Steps:**
1. [x] Delete the `console.log` at `lib/actions/clubs.ts:22` (and any other `console.log` lines in the file that print user ids — keep `console.error` in catch blocks).
2. [x] Create `lib/validation/club.ts`: club name 3–100 chars (preserves existing `< 3` rule), description ≤ 2000, UUIDs for ids.
3. [x] Wire pattern into all mutating functions in `clubs.ts`; rate key `club:${user.id}` (10/min creates, 20/min joins/updates).
4. [x] Create `lib/validation/message.ts`: `receiverId` UUID, `content` trimmed 1–2000 chars.
5. [x] Wire `safeParse` into `messages.ts` mutations (rate limiting already exists there — do not change its keys/limits).
6. [x] Run `npm run test:run` and `npm run build`.

**Verify:**
- [x] `grep -n "console.log" lib/actions/clubs.ts` returns nothing
- [x] `grep -c "safeParse" lib/actions/clubs.ts` ≥ 1 (6) and same for `messages.ts` (3)
- [x] `grep -c "checkRateLimit" lib/actions/clubs.ts` ≥ 1 (7 = 1 import + 6 calls)
- [x] `npm run test:run` exits 0 (80 tests, 5 files, all green) and `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/validation/club.ts` (new), `lib/validation/message.ts` (new), `lib/actions/clubs.ts`, `lib/actions/messages.ts`
- Approach taken: **clubs.ts** — removed both `console.log` lines (line 22 user-id log and line 50 slug log; all `console.error` kept). All 6 exported functions are mutating (`createClub`, `joinClub`, `leaveClub`, `setCurrentBook`, `updateClub`, `deleteClub`); each got auth → rate limit → safeParse in that order. Schema preserves the existing rules: name 3–100 trimmed, description ≤ 2000 trimmed, `visibility` as `z.enum(["public","private"])` matching `ClubVisibility`; `clubSlug` (used in `revalidatePath`) capped at 100. Single-UUID positional params (`joinClub`/`leaveClub`/`deleteClub`) validated with `clubIdSchema.safeParse(clubId)`, same idiom as task 1's `deleteShelf`. **messages.ts** — `sendMessage` got `sendMessageSchema` (receiverId UUID, content trimmed 1–2000 with the file's existing error wording); the manual trim/length checks were removed and its existing `message:${user.id}` 30/min rate limit was left untouched. `markMessagesAsRead` and `deleteMessage` got single-UUID safeParse (`friendIdSchema`/`messageIdSchema`).
- Deviations from plan: (1) Same per-operation rate-key deviation as task 1: `club:create:` (10/min), `club:member:` (20/min shared by join/leave), `club:update:` (20/min shared by setCurrentBook/updateClub), `club:delete:` (20/min) instead of one `club:${user.id}` key, because different limits can't share one bucket. (2) Plan step 5 said messages.ts rate limiting "already exists" — true only for `sendMessage`; `markMessagesAsRead` and `deleteMessage` have no rate limit. Followed the step literally (Zod only, no new rate limits there); flagging for awareness — both are low-abuse-value (self-scoped update / RLS-guarded delete).
- Issues encountered: None. Minor behavior tightening mirroring task 1: `updateClub` previously ignored an empty-string name (truthy check); the schema now rejects it with a validation error — degenerate input no UI caller sends. `createClub` gained a try-catch-free structure unchanged (file had no try/catch before; kept as-is per minimal-changes rule).

**Status:** [x] COMPLETE

## Task 3: Harden follows + friends

**Source:** Audit — spammable social writes, no validation, no rate limit
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `lib/actions/follows.ts`, `lib/actions/friends.ts`, `lib/validation/social.ts` (new)

**Context:** Follow/unfollow and friend-request actions take a single target user id. Main risks: non-UUID injection into queries and follow-spam.

**Steps:**
1. [x] Create `lib/validation/social.ts`: a `targetUserIdSchema` (single UUID) — one shared schema file for both actions.
2. [x] Wire pattern into all mutating functions in both files. Rate keys `follow:${user.id}` and `friend:${user.id}`, 30/min (toggles are legitimately rapid).
3. [x] Preserve any existing self-follow/self-friend guards.
4. [x] Run `npm run test:run` and `npm run build`.

**Verify:**
- [x] `grep -c "safeParse" lib/actions/follows.ts` ≥ 1 (3) and same for `friends.ts` (5)
- [x] `grep -c "checkRateLimit" lib/actions/follows.ts` ≥ 1 (3 = 1 import + 2 calls) and same for `friends.ts` (6 = 1 import + 5 calls)
- [x] `npm run test:run` exits 0 (80 tests, 5 files, all green) and `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/validation/social.ts` (new), `lib/actions/follows.ts`, `lib/actions/friends.ts`
- Approach taken: `social.ts` exports `targetUserIdSchema` and `friendRequestIdSchema` (accept/reject/cancel take a friend-request id, not a user id — kept them distinct for clearer error messages). **follows.ts** — 3 exported functions, all mutating: `followUser` and `unfollowUser` got the full auth → rate limit (`follow:${user.id}`, 30/min) → safeParse pattern; `toggleFollow` got safeParse only because it delegates to the other two, which carry the rate limit (see deviations). **friends.ts** — 5 exported functions, all mutating (`sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`, `cancelFriendRequest`, `removeFriend`); all got the full pattern with shared key `friend:${user.id}` 30/min (single key is fine here since — unlike tasks 1/2 — all operations share one limit). Self-follow guard in `followUser`/`toggleFollow` and self-friend guard in `sendFriendRequest` preserved, placed after validation per the pattern. UUID validation notably closes the `.or()` string-interpolation surface in `sendFriendRequest`/`removeFriend` (targetUserId was interpolated raw into PostgREST filter strings).
- Deviations from plan: `toggleFollow` has no checkRateLimit call of its own — it internally calls the rate-limited `followUser`/`unfollowUser`, and a second check on the same key would consume 2 tokens per toggle, silently halving the effective limit to 15/min. Validation still runs in `toggleFollow` before its own pre-check query. File-level verify (`checkRateLimit` ≥ 1 in follows.ts) still passes.
- Issues encountered: None.

**Status:** [x] COMPLETE

## Task 4: Harden books + challenges + goals + checkins

**Source:** Audit — no Zod in any of the four; no rate limit in `books`, `challenges`, `goals`
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/actions/books.ts`, `lib/actions/challenges.ts`, `lib/actions/goals.ts`, `lib/actions/checkins.ts`, new schemas in `lib/validation/`

**Context:** `checkins.ts` already rate-limits — add Zod only there. Goals/challenges take numeric targets (validate as positive integers with sane caps, e.g. `target ≤ 10000`). Books actions may include reading-progress updates (page numbers: non-negative integers ≤ 50000).

**Steps:**
1. [x] For each file: read it, list mutating functions, create matching schema file (`lib/validation/book-action.ts`, `challenge.ts`, `goal.ts`, `checkin.ts`), wire the pattern.
2. [x] Rate keys: `book:${user.id}` 20/min, `challenge:${user.id}` 10/min, `goal:${user.id}` 10/min. `checkins.ts`: keep existing rate limiting untouched.
3. [x] Edge case: dates (goal deadlines, challenge ranges) — validate as ISO strings the way `lib/validation/` schemas already handle dates (check `taste.ts`/`book-submission.ts` for the existing idiom and reuse it).
4. [x] Edge case: `rating` fields are OPTIONAL/nullable everywhere (design decision Mar 2026) — never make rating required in a schema.
5. [x] Run `npm run test:run` and `npm run build`.

**Verify:**
- [x] `grep -c "safeParse"` ≥ 1 in each of the four action files (books 4, challenges 3, goals 1, checkins 4)
- [x] `grep -c "checkRateLimit"` ≥ 1 in `books.ts` (5 = 1 import + 4 calls), `challenges.ts` (4 = 1 import + 3 calls), `goals.ts` (2 = 1 import + 1 call)
- [x] `npm run test:run` exits 0 (80 tests, 5 files, all green) and `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/validation/book-action.ts` (new), `lib/validation/challenge.ts` (new), `lib/validation/goal.ts` (new), `lib/validation/checkin.ts` (new), `lib/actions/books.ts`, `lib/actions/challenges.ts`, `lib/actions/goals.ts`, `lib/actions/checkins.ts`
- Approach taken: **books.ts** — 4 client-facing mutating actions (`addToShelf`, `updateReadingProgress`, `removeFromShelf`, `importAndAddToShelf`) got auth → rate limit (`book:${user.id}` 20/min) → safeParse. `updateReadingProgress`'s hand-rolled `UUID_RE`/`MAX_PAGES` checks were replaced by the schema (same 50000-page cap, same error wordings). `importAndAddToShelf` validates the whole `ExternalBookData` object — title ≤ 500 / author ≤ 200 / description ≤ 5000 (matching `book-submission.ts` caps, since real book titles exceed the generic 100-char rule), coverUrl `.url()` allowing `""`/null, genres `.max(50)`, pageCount ≤ 50000 — and reassigns the params from validated data so `.trim()` applies. **challenges.ts** — mutating: `createChallenge`, `updateChallenge`, `deleteChallenge` got the full pattern (`challenge:${user.id}` 10/min); `abandonChallenge` delegates to `updateChallenge` (no separate limit, same rationale as task 3's `toggleFollow`). Manual name/target checks replaced by schema (target int 1–10000); cross-field checks (end > start, genre required for genre_books) kept in code per plan rule; dates use the existing loose-string idiom plus a `Date.parse` refine so garbage strings fail before hitting the DB. `updateChallenge` now spreads `validationResult.data.updates` instead of raw `updates` — Zod strips unknown keys, closing a mass-assignment hole (previously any extra keys in `updates` were spread into the DB update). **goals.ts** — `updateReadingGoal` got the full pattern (`goal:${user.id}` 10/min); schema keeps the existing 1–1000 rule and message. **checkins.ts** — Zod only, existing rate limits untouched (per plan): `createCheckin` got `createCheckinSchema` (placeId/bookId UUIDs, note ≤ 500 trimmed — replaces the manual note check), `deleteCheckin` got `checkinIdSchema`; read-only `getPlaceCheckins`/`getUserCheckinStats` got UUID validation on id params returning their existing empty shapes (same as task 1's read-only treatment). No `rating` field exists in any of these inputs, so step 4 was a no-op.
- Deviations from plan: (1) In `createCheckin`, safeParse runs BEFORE the existing `checkRateLimit` call (pattern says rate limit first) because the rate key embeds `input.placeId` — validating first keeps garbage in the KV key space out; the key/limit themselves are unchanged. (2) `syncChallengeProgress` (mutating, no params) got neither Zod (nothing to validate) nor a rate limit — it is invoked internally by `addToShelf`/`removeFromShelf`/`importAndAddToShelf` on every shelf change; a 10/min `challenge:` limit would silently drop syncs under the 20/min book limit. (3) Exported helper `updateReadingStats(supabase, userId)` in books.ts left untouched — it takes a Supabase client as a param so it is not remotely invocable in any meaningful way; flagging that exporting it from a "use server" file is a smell worth revisiting.
- Issues encountered: None.

**Status:** [x] COMPLETE

## Task 5: Harden badges + email + import + location + places + privacy

**Source:** Audit — remaining non-admin files without Zod
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `lib/actions/badges.ts`, `lib/actions/email.ts`, `lib/actions/import.ts`, `lib/actions/location.ts`, `lib/actions/places.ts`, `lib/actions/privacy.ts`, new schemas in `lib/validation/`

**Context:** Mixed bag. `location.ts` and `places.ts` already rate-limit (add Zod only). `import.ts` handles CSV imports — validate the parsed row count (`.max(1000)` rows) and per-row fields, not the raw file. `email.ts` may be internally-called only — if a function is never called from a client component (check with `grep -rn "from \"@/lib/actions/email\"" app/ components/`), note it in Completed Notes and still add schema validation for defense in depth.
**Steps:**
1. [x] For each file: read, classify functions, create/extend schema files, wire the pattern.
2. [x] Rate keys for files lacking them: `badge:${user.id}` 20/min, `email:${user.id}` 5/min, `import:${user.id}` 3/min (imports are heavy), `privacy:${user.id}` 10/min.
3. [x] `location.ts` edge case: latitude must be `z.number().min(-90).max(90)`, longitude `.min(-180).max(180)`.
4. [x] Run `npm run test:run` and `npm run build`.

**Verify:**
- [x] `grep -c "safeParse"` ≥ 1 in each of the six files (badges 1, email 1, import 1, location 5, places 3, privacy 1)
- [x] `grep -c "checkRateLimit"` ≥ 1 in `badges.ts` (3 = 1 import + 2 calls), `email.ts` (2), `import.ts` (2), `privacy.ts` (2)
- [x] `npm run test:run` exits 0 (80 tests, 5 files, all green) and `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/validation/badge.ts`, `email.ts`, `import.ts`, `location.ts`, `place.ts`, `privacy.ts` (all new), `lib/actions/badges.ts`, `email.ts`, `import.ts`, `location.ts`, `places.ts`, `privacy.ts`
- Approach taken: **badges.ts** — `syncUserBadges` (no params → rate limit only) and `removeBadge` (rate limit + Zod) at `badge:${user.id}` 20/min; badge ids are string slugs like `"first-checkin"`, NOT UUIDs, so `badgeIdSchema` is a 1–100-char string. **email.ts** — `sendWelcomeEmail` got Zod (email `.email()` ≤ 254, username 1–100, displayName ≤ 100) + rate limit; per the plan's grep check it is never imported from `app/` client components or `components/` — only from `lib/actions/user.ts`, the Supabase webhook route, and the auth callback route. **import.ts** — `importFromGoodreads` got `import:${user.id}` 3/min and post-parse Zod on the parsed rows per plan: `.max(1000)` row cap plus per-row bounds (title ≤ 500, author ≤ 200, ISBNs ≤ 32, rating 0–5, pages ≤ 50000); the raw CSV string is not schema-validated (per plan). **location.ts** — Zod only (existing `location:`/`presence:` 10/min limits untouched): `updateLocation` (lat/lng ranges per step 3, label 1–200), `updateLocationFromGeohash` (shape via Zod, `isValidGeohash` domain check kept in code), `toggleLocationSharing` (boolean), `updateLocationPrecision` (int check catches NaN before the 4–8 clamp, which stays in code), `setPresence` (type enum, note ≤ 140, placeName ≤ 200, geohash ≤ 12; the 1/2/4-hour duration business check kept in code). `clearPresence`/`clearLocation` take no input — nothing to validate. **places.ts** — Zod only (existing `place-submit:` 5/hr limit untouched): `submitPlace` schema replaces the manual name/type/coordinate checks; `approvePlaceSubmission`/`rejectPlaceSubmission` (admin) got `placeModerationSchema` (submissionId UUID, notes ≤ 2000). **privacy.ts** — `updateDiscoveryVisibility` got the full pattern at `privacy:${user.id}` 10/min.
- Deviations from plan: (1) **email.ts has NO auth check** — it's invoked from pre-auth contexts (signup webhook, OAuth callback), so the planned `email:${user.id}` key is impossible; the rate limit is keyed by normalized recipient address (`email:${email.toLowerCase()}`, 5/min) instead, and validation runs before the limit because the key embeds the email. Note: since it lives in a `"use server"` file, `sendWelcomeEmail` is a publicly invocable endpoint with no auth — anyone can trigger welcome emails to arbitrary addresses (now capped at 5/min/address). Recommended follow-up: remove the `"use server"` directive from `lib/actions/email.ts` (all three callers are server-side; nothing needs it to be an action), which would close the endpoint entirely — not done here to stay within plan scope. (2) `updateLocationPrecision` (location.ts) has no rate limit — plan said location.ts "already rate-limits" which is true for the other mutations; followed the Zod-only instruction literally and flagging it (low risk: self-scoped single-column update). Same for `clearPresence`/`clearLocation` (no limit, no params, self-scoped clears). (3) `approvePlaceSubmission`/`rejectPlaceSubmission` are admin mutations in places.ts with no rate limit; left as-is per the places.ts Zod-only instruction — task 6's `admin:${user.id}` 30/min convention could be extended to them if desired.
- Issues encountered: None.

**Status:** [x] COMPLETE

## Task 6: Harden the 5 admin-* action files

**Source:** Audit — admin actions have auth but no schema validation
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/actions/admin-books.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/admin-import.ts`, `lib/actions/admin-reviews.ts`, `lib/actions/admin-users.ts`, `lib/validation/admin.ts` (new)

**Context:** Admin actions mutate other users' data — the blast radius of malformed input is highest here. Every admin action must ALREADY check `is_admin`; while wiring Zod, verify that check exists in each function and flag any that lack it in Completed Notes (do not silently fix — report).

**Steps:**
1. [x] For each of the 5 files: read, list mutating functions, confirm each checks admin status before mutating (note any that don't).
2. [x] Create `lib/validation/admin.ts` with schemas grouped by domain (book edits, user role changes, review moderation). Book URLs (`cover_url` etc.): validate with `z.string().url().max(2000)`.
3. [x] Wire `safeParse` into every mutating admin function. Rate key `admin:${user.id}` 30/min (admins do bulk work — do not go lower).
4. [x] Run `npm run test:run` and `npm run build`.

**Verify:**
- [x] `grep -c "safeParse"` ≥ 1 in each of the 5 admin files (books 4, users 4, reviews 2, enrichment 3, import 1)
- [x] `grep -c "checkRateLimit"` ≥ 1 in each of the 5 admin files (books 4, users 4, reviews 2, enrichment 2, import 2)
- [x] Completed Notes explicitly states whether every admin function had an admin check (YES — see below)
- [x] `npm run test:run` exits 0 (80 tests, 5 files, all green) and `npm run build` exits 0

**Completed Notes:**
- Files modified: `lib/validation/admin.ts` (new), `lib/actions/admin-books.ts`, `lib/actions/admin-users.ts`, `lib/actions/admin-reviews.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/admin-import.ts`
- Approach taken: All schemas in one `lib/validation/admin.ts` grouped by domain (book edits, user actions, review moderation, enrichment, CSV import); `cover_url` uses `z.string().url().max(2000).or(z.literal(""))` per plan (the empty-string branch preserves existing `?.trim() || null` call-site behavior). **Admin-check audit (step 1): YES — every exported function in all 5 files calls `requireAdmin()` before doing anything** — admin-books (adminGetBooks, adminGetBook, adminCreateBook, adminUpdateBook, adminDeleteBook, adminGetGenres), admin-users (adminGetUsers, adminGetUser, adminToggleAdmin, adminDisableUser, adminEnableUser, adminGetUserStats), admin-reviews (adminGetReviews, adminGetReview, adminDeleteReview, adminGetReviewStats), admin-enrichment (getBooksNeedingEnrichment, enrichSingleBook, enrichBooks), admin-import (parseCSVForPreview, importBooksFromCSV). None lacked the check. Mutations hardened with `admin:${user.id}` 30/min + Zod: adminCreateBook, adminUpdateBook, adminDeleteBook, adminToggleAdmin, adminDisableUser, adminEnableUser, adminDeleteReview, enrichSingleBook, enrichBooks, importBooksFromCSV (10 total). Read-only single-id functions (adminGetBook, adminGetUser, adminGetReview) got UUID checks; getBooksNeedingEnrichment validates its `limit` param (int 1–200). Bonus fix: `adminGetBooks` interpolated raw `search` into a PostgREST `.or()` filter — now sanitized with the existing `sanitizePostgrestValue` util, matching what admin-users already did (query-manipulation surface, admin-only but trivial to close consistently).
- Deviations from plan: (1) `enrichBooks` loops over `enrichSingleBook` internally — to avoid burning one 30/min token per book in a batch (a 50-book batch would trip the limit at 30 and fail the rest), the enrichment body was extracted into non-exported `enrichSingleBookCore`; the exported `enrichSingleBook` does auth → rate limit → Zod → core, while `enrichBooks` does auth → rate limit → Zod (ids array, `.max(50)` matching the UI's 50-book listing cap) → loops the core directly. Signatures/returns unchanged. (2) `admin-enrichment.ts`'s `requireAdmin` returned `void` (unlike the other 4 files) — it now returns `{ userId }` so the rate key can be built; private helper, no exported signature change. (3) `importBooksFromCSV`'s `ImportResult` has no top-level error field, so rate-limit/validation failures are surfaced as a synthetic `results[0]` row (rowNumber 0) carrying the message, keeping the return shape intact. (4) `parseCSVForPreview` (admin-import) is read-only (parses, no DB writes) — no rate limit/Zod per the plan's mutating-only rule; the file-level greps still pass via importBooksFromCSV.
- Issues encountered: None.

**Status:** [x] COMPLETE

## Task 7: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [x] Run `grep -L "safeParse" lib/actions/*.ts` — the output must be EMPTY or contain only files that have zero mutating functions (justify each in Completed Notes).
2. [x] Run `grep -L "checkRateLimit" lib/actions/*.ts` — output must contain only files with zero mutating functions (justify each).
3. [x] Run `npm run typecheck` (if script exists), `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
4. [ ] Manual smoke test: `npm run dev`, log in, create a shelf, add a book to it, send a message — all succeed. **BLOCKED — no dev login available.**

**Verify:**
- [x] Both grep checks pass with justifications recorded (both outputs EMPTY after gap fix — see notes)
- [x] All four npm commands exit 0 (typecheck 0; lint 0 errors / 25 pre-existing warnings; test:run 80/80; build 0)
- [ ] Manual smoke test passes — **blocked: no dev login available** (Google OAuth from localhost lands on prod per known gotcha; no email/password test account on hand). Using pre-authorized status per this verify item.

**Completed Notes:**
- Files modified: `lib/actions/book-submissions.ts`, `lib/actions/user.ts`, `lib/validation/book-submission.ts` (added `submissionIdSchema` export)
- Approach taken: First grep sweep (`safeParse`) came back EMPTY on the initial run. The `checkRateLimit` sweep initially flagged `book-submissions.ts` and `user.ts` — both have mutating functions (they were in the "already have Zod" group and were never assigned to tasks 1–6), so the "zero mutating functions" justification was impossible and the gap was closed instead, per the plan's stated goal of bringing EVERY mutating action up to the pattern: **book-submissions.ts** — `submitBook` (`submission:create:` 10/min), `updateBookSubmission` (`submission:update:` 20/min + UUID check on the previously-unvalidated `submissionId` param), `deleteBookSubmission` (`submission:delete:` 20/min + UUID check), `moderateSubmission` (`admin:${user.id}` 30/min, matching task 6's admin convention); `approveBookSubmission`/`rejectBookSubmission` delegate to `moderateSubmission` (no separate limit, same rationale as `toggleFollow`/`abandonChallenge`). **user.ts** — `updateProfile` and `updateSocialLinks` share `profile:${user.id}` 20/min; `ensureUserProfile` got `profile-create:${user.id}` 5/min placed AFTER the existing-profile early return, so routine page loads with existing profiles are never rate-limited — only the actual one-time creation path is. After the fix, both grep sweeps are EMPTY: all 28 files in `lib/actions/` contain both `safeParse` and `checkRateLimit`.
- Deviations from plan: Task 7 was specified as QA-only but required the two-file gap fix above to make the grep gates pass honestly. Rate keys follow the per-operation-segment convention established in tasks 1–2 where limits differ within a file.
- Issues encountered: Manual smoke test (step 4) blocked — no dev login available. All automated verification passes. Suggested completion: run the smoke test with a real account (create shelf, add book, send message, plus one book submission and one profile update to exercise the newly rate-limited paths).

**Status:** [x] CODE COMPLETE - Verification blocked (manual smoke test needs dev login; all automated checks green)

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Replacing 191 raw `console.*` calls with `lib/utils/log.ts` | Separate mechanical sweep; only PII logs removed here | Logging cleanup pass |
| Rate limiting read-only queries | Low risk, high noise | If abuse observed |
| Tests for the new schemas | Covered by `test-coverage-core-2026-07.md` (plan #8) | Plan #8 |
| CSRF origin checks on server actions | Next.js server actions have built-in origin protection | N/A |

## Final QA Checklist

- [x] All files created/modified exist (12 new `lib/validation/` files + 1 extended; 21 action files hardened)
- [x] No broken imports or references (`npm run typecheck` exits 0)
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint` — 0 errors, 25 pre-existing warnings)
- [ ] Feature works as expected (manual test) — BLOCKED: no dev login
- [ ] No console errors — BLOCKED: requires running app session

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-07-07 | 1 | COMPLETE | shelves + lists hardened: 14 mutating actions got rate limit + Zod, 3 read-only got UUID checks; 2 new schema files; tests + build green |
| 2026-07-07 | 2 | COMPLETE | clubs + messages hardened: 6 club actions got rate limit + Zod, 3 message actions got Zod (existing 30/min limit kept); 2 PII/debug console.logs removed; 2 new schema files; tests + build green |
| 2026-07-07 | 3 | COMPLETE | follows + friends hardened: 7 actions got rate limit + Zod at 30/min, toggleFollow got Zod only (delegates to rate-limited follow/unfollow); closed raw string interpolation of targetUserId into `.or()` filters; 1 new schema file; tests + build green |
| 2026-07-07 | 4 | COMPLETE | books + challenges + goals + checkins hardened: 8 mutating actions got rate limit + Zod, 2 checkin mutations got Zod (existing limits kept), 2 read-only got UUID checks; closed mass-assignment in updateChallenge spread; 4 new schema files; tests + build green |
| 2026-07-07 | 5 | COMPLETE | badges/email/import/location/places/privacy hardened: 4 files got new rate limits, 13 mutations got Zod; flagged sendWelcomeEmail as an unauthenticated public server action (now rate-limited 5/min/address; recommend dropping "use server"); 6 new schema files; tests + build green |
| 2026-07-07 | 6 | COMPLETE | 5 admin-* files hardened: all 21 exported functions confirmed to call requireAdmin (none missing); 10 mutations got admin: 30/min rate limit + Zod, 3 read-only got UUID checks; fixed unsanitized search interpolation in adminGetBooks; enrichment core extracted to avoid per-book token burn in batches; 1 new schema file; tests + build green |
| 2026-07-07 | 7 | CODE COMPLETE - Verification blocked | Final QA: closed rate-limit gap in book-submissions.ts + user.ts (7 mutations, the 2 files tasks 1–6 never covered); both grep sweeps now EMPTY across all 28 action files; typecheck/lint/tests/build all exit 0; manual smoke test blocked (no dev login) |
