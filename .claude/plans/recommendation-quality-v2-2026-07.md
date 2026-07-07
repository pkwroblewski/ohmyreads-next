# OhMyReads - Recommendation Quality v2

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
| 1 | Extract pure scoring module + unit tests | 🟠 High | Medium | [ ] Pending | `lib/queries/recommendation-scoring.ts` (new), `lib/queries/recommendations.ts`, `__tests__/lib/queries/recommendation-scoring.test.ts` (new) |
| 2 | Add author affinity + negative-signal scoring | 🟠 High | Medium | [ ] Pending | `lib/queries/recommendation-scoring.ts`, `lib/queries/recommendations.ts` |
| 3 | Diversify candidate pool beyond top-200-popular | 🟠 High | Medium | [ ] Pending | `lib/queries/recommendations.ts` |
| 4 | Feed taste summary into AI book-search prompt | 🟡 Medium | Low | [ ] Pending | `app/api/ai/book-search/route.ts` |
| 5 | Final QA | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 0/5 complete**

## Summary

Per `.claude/reports/assessment-devils-advocate.md`, recommendation quality is the product's moat. A scorer already exists (`lib/queries/recommendations.ts:51` `getPersonalizedRecommendations`) using taste-profile genres, loved-book genre similarity, vibe tags, and shelf exclusion — but it has three real gaps: (1) the candidate pool is just the **top 200 books by `ratings_count`** (`:114`), so niche matches never surface; (2) **no author affinity** and **no negative signals** (books you rated 1–2★ teach it nothing); (3) the scoring loop is inline and **untestable** — zero tests. Separately, the AI book-search chat ignores the user's reading history entirely. This plan extracts a pure, unit-tested scoring module, adds the two missing signals, widens the candidate pool per loved genre, and injects a compact taste summary into the AI search prompt. **No LLM calls in the scoring path** — it stays deterministic and testable.

## Existing code map (read these first in Task 1)

- `lib/queries/recommendations.ts:39-46` — `WEIGHTS` (GENRE_MATCH 30, VIBE_MATCH 25, SIMILAR_TO_LOVED 40, HIGH_RATING 10, POPULAR 5)
- `:51-150+` — `getPersonalizedRecommendations(userId, limit)`: fetches taste profile, user_books (exclusion set), loved books (rating ≥ 4), review vibe tags, then scores a 200-book pool
- `:83` — `ub.book as unknown as Book` cast (leave as-is; plan `supabase-generated-types-2026-07.md` removes it)
- Caller: `app/(public)/recommendations/page.tsx:49` — `getPersonalizedRecommendations(user.id, 24)`
- Taste profile columns (from `app/api/ai/curated-picks/route.ts:59`): `preferred_genres`, `preferred_vibes`, `preferred_pace`, `preferred_length` on table `user_taste_profiles`
- `rating` is `INTEGER | NULL` everywhere (optional-rating decision, Mar 2026) — always null-check

## Task 1: Extract pure scoring module + unit tests

**Source:** Devil's-advocate assessment ("recommendation quality is the moat") + audit (scorer untestable, 0 tests)
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/queries/recommendation-scoring.ts` (new), `lib/queries/recommendations.ts`, `__tests__/lib/queries/recommendation-scoring.test.ts` (new)

**Context:** Pure refactor — behavior must be IDENTICAL after this task. The scoring loop body (`recommendations.ts:143` onward inside `getPersonalizedRecommendations`) moves into a pure function that takes plain data, no Supabase client.

**Steps:**
1. [ ] Read `lib/queries/recommendations.ts` fully (all ~760 lines). Identify the exact scoring loop inside `getPersonalizedRecommendations` and the shapes it consumes.
2. [ ] Create `lib/queries/recommendation-scoring.ts` exporting:
   - `WEIGHTS` (moved verbatim from `recommendations.ts:40-46`; re-export or update the old import sites)
   - `interface ScoringSignals { tasteGenres: string[]; tasteVibes: string[]; lovedGenres: Map<string, string>; usedVibeTags: Set<string>; excludedBookIds: Set<string>; bookVibeTags: Map<string, string[]>; }`
   - `scoreBook(book: Book, signals: ScoringSignals): { score: number; reason: RecommendationReason | null }` — the moved loop body, logic UNCHANGED
   - `scoreAndRank(books: Book[], signals: ScoringSignals, limit: number): RecommendedBook[]` — filter excluded, score, drop `score <= 0 || !reason`, sort desc, slice
   Import `Book`/`RecommendationReason`/`RecommendedBook` types from their current locations (`types/database.ts` and `recommendations.ts`) — move type definitions only if required to avoid a circular import, and note it.
3. [ ] Rewrite `getPersonalizedRecommendations` to build `ScoringSignals` from its existing fetches and call `scoreAndRank`. Delete the now-duplicated inline loop.
4. [ ] Create `__tests__/lib/queries/recommendation-scoring.test.ts` (copy test-file boilerplate style from `__tests__/lib/validation/review.test.ts`). Fixtures MUST use valid v4 UUIDs (e.g. `550e8400-e29b-41d4-a716-446655440000`) — Zod v4 and consistency. Required cases:
   - fantasy-lover signals (tasteGenres `["Fantasy"]`, lovedGenres has `Fantasy`) → a fantasy book outscores a romance book
   - book in `excludedBookIds` → not present in `scoreAndRank` output
   - empty signals (cold start) → `scoreAndRank` returns `[]` for zero-scoring books
   - vibe-tag overlap adds score vs identical book without overlap
   - book with `rating: null` fields → no crash, scores normally
5. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `npm run test:run` exits 0 with ≥ 5 new tests passing
- [ ] `grep -n "scoreAndRank" lib/queries/recommendations.ts` shows the query file delegating to the module
- [ ] `npm run build` exits 0
- [ ] `/recommendations` page renders the same kind of results as before (manual dev check)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 2: Add author affinity + negative-signal scoring

**Source:** Gap analysis — loved authors and disliked genres are ignored
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/queries/recommendation-scoring.ts`, `lib/queries/recommendations.ts`, `__tests__/lib/queries/recommendation-scoring.test.ts`

**Context:** Two new deterministic signals. Author affinity: if the user rated a book by author X ≥ 4, other books by X score high. Negative: genres appearing in books the user rated ≤ 2 get penalized.

**Steps:**
1. [ ] Add to `WEIGHTS`: `AUTHOR_MATCH: 35` and `DISLIKED_GENRE: -20`.
2. [ ] Extend `ScoringSignals` with `lovedAuthors: Map<string, string>` (author → example loved title) and `dislikedGenres: Set<string>`.
3. [ ] In `scoreBook`: if `signals.lovedAuthors.has(book.author)` → `score += WEIGHTS.AUTHOR_MATCH` and (following the existing `bestReason` idiom for SIMILAR_TO_LOVED at `recommendations.ts:174-190`) set a reason like "By {author}, whose {title} you loved". Check `RecommendationReasonType` union at `recommendations.ts:6` — if no fitting variant exists, add `"loved_author"` to the union and handle it wherever reasons render (find with `grep -rn "RecommendationReasonType\|reason.type" components/ app/ --include="*.tsx"`).
4. [ ] In `scoreBook`: for each book genre in `signals.dislikedGenres` → `score += WEIGHTS.DISLIKED_GENRE` (i.e. subtract). Never produce a *reason* from a negative signal.
5. [ ] In `getPersonalizedRecommendations`, populate the new signals: `lovedAuthors` from the EXISTING loved-books query (`:73-78` — it already selects the joined book; add `author` to its select list if missing). `dislikedGenres`: new query, same shape as loved-books but `.lte("rating", 2)`.
6. [ ] Add tests: loved-author book outscores same-genre stranger book; a book whose only genre is disliked scores lower than the identical book without that genre; a book that is BOTH loved-genre and disliked-genre still nets positive (30 − 20 = 10) — assert exact arithmetic.
7. [ ] Run `npm run test:run` and `npm run build`.

**Verify:**
- [ ] `npm run test:run` exits 0 with the 3 new cases passing
- [ ] `grep -n "AUTHOR_MATCH\|DISLIKED_GENRE" lib/queries/recommendation-scoring.ts` shows both weights
- [ ] `npm run build` exits 0

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 3: Diversify candidate pool beyond top-200-popular

**Source:** Gap analysis — `recommendations.ts:110-114` pool is top-200 by `ratings_count`; niche matches can never be recommended
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/queries/recommendations.ts`

**Context:** Keep the popular-200 base (it serves cold-start), and UNION in genre-targeted candidates for users with signals.

**Steps:**
1. [ ] In `getPersonalizedRecommendations`, after building signals: take up to 3 genres = union of `tasteGenres` and `lovedGenres` keys (first 3 unique). For each, fetch: `supabase.from("books").select("*").overlaps("genres", [genre]).order("average_rating", { ascending: false, nullsFirst: false }).limit(30)`.
   - EDGE CASE: verify the books table column is `genres` (text[]) and the rating column name by checking `types/database.ts` `Book` interface — use `average_rating` only if it exists there; otherwise use the actual column name found.
2. [ ] Run the (up to 3) genre fetches with `Promise.all` ALONGSIDE nothing else — they are independent; do not make them sequential.
3. [ ] Merge: popular-200 + genre candidates, dedupe by `book.id` (Map keyed by id), then pass to `scoreAndRank` as before.
4. [ ] Cold start (no taste profile AND no loved books): skip genre fetches entirely — pool stays popular-200 (unchanged behavior).
5. [ ] Run `npm run test:run` and `npm run build`; load `/recommendations` in dev.

**Verify:**
- [ ] `grep -n "overlaps" lib/queries/recommendations.ts` shows the genre fetch
- [ ] `grep -n "Promise.all" lib/queries/recommendations.ts` present in `getPersonalizedRecommendations`
- [ ] `npm run test:run` and `npm run build` exit 0
- [ ] `/recommendations` renders without error in dev (manual)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 4: Feed taste summary into AI book-search prompt

**Source:** Devil's-advocate assessment — AI book search is "a Google Books chatbot" ignoring reading history
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `app/api/ai/book-search/route.ts`

**Context:** The route already authenticates. `app/api/ai/curated-picks/route.ts:55-141` shows exactly how to fetch the taste profile + recent books and compose a `userContext` string — copy that logic, don't invent a new one.

**Steps:**
1. [ ] Read `app/api/ai/book-search/route.ts` fully; locate where the system prompt is built (imported from `lib/ai/prompts.ts` or inline).
2. [ ] After the auth check, fetch `user_taste_profiles` (columns `preferred_genres, preferred_vibes`) and last 5 `user_books` with joined book title/author — copying the pattern at `curated-picks/route.ts:55-85`.
3. [ ] Build a one-line summary, HARD-CAPPED at 300 chars: `Reader profile — loves: {genres}; vibes: {vibes}; recent reads: {titles}`. Empty profile + empty history → skip entirely (prompt unchanged).
4. [ ] Append to the system prompt: `\n\nPersonalize suggestions using this reader profile when relevant: {summary}`.
5. [ ] Failure isolation: wrap the two fetches in try/catch — on any error, proceed WITHOUT the summary. The search must never break because personalization failed.
6. [ ] Run `npm run build`; manual dev test: ask the book-search AI for "something for me" while logged in.

**Verify:**
- [ ] `grep -n "user_taste_profiles" app/api/ai/book-search/route.ts` matches
- [ ] `grep -n "slice(0, 300)\|slice(0,300)" app/api/ai/book-search/route.ts` matches (the hard cap)
- [ ] `npm run build` exits 0
- [ ] Logged-in AI search still streams results (manual; else `CODE COMPLETE - Verification blocked`)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Task 5: Final QA

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Steps:**
1. [ ] `npm run lint`, `npm run test:run`, `npm run build` — all exit 0.
2. [ ] Manual: logged-in `/recommendations` shows books with reason strings; a user with rated books sees author/genre-connected reasons; logged-out or fresh user still gets a populated page (cold-start fallback).

**Verify:**
- [ ] All three npm commands exit 0
- [ ] Manual checks pass (or `CODE COMPLETE - Verification blocked` with reason)

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| SQL-side scoring (move scoring into Postgres) | Deferred in comprehensive plan — "before 10k users" | At scale |
| Collaborative filtering (users-like-you) | Needs user critical mass | At scale |
| Embedding-based similarity (pgvector) | Infra decision + cost | Product decision |
| Reworking `curated-picks` personalization | Covered by `ai-routes-fixes-2026-07.md` (caching/latency only) | Plan #6 |
| A/B measuring rec CTR | Needs analytics events | After analytics exist |

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
