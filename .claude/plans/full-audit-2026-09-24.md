# OhMyReads - Full Code Audit Remediation (2026-09-24)

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

---

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 0 | Full audit (5 parallel reviews + live DB checks) | - | Medium | [x] COMPLETE | - |
| 1 | Upgrade Next.js 16.1.6 → 16.3.6 (2 critical RCE advisories) | 🔴 Critical | Low | [x] COMPLETE | `package.json`, `package-lock.json`, `components/geo/map-page-client.tsx` |
| 2 | Migration 074: RLS holes (forged friendships, club takeover) + integrity | 🔴 Critical | Medium | [x] CODE COMPLETE - Verification blocked | `supabase/migrations/074_rls_integrity_fixes.sql` |
| 3 | Google Places API key leaked to browsers; enrich cache poisoning | 🔴 Critical | Medium | [x] CODE COMPLETE - Verification blocked | `app/api/geo/places/enrich/route.ts`, `components/geo/map-detail-panel.tsx` |
| 4 | Add-from-AI-search: SSRF via coverUrl, unmoderated catalog inserts, null/partial-date rejects | 🟠 High | Medium | [x] CODE COMPLETE - Verification blocked | `lib/actions/books.ts`, `lib/validation/book-action.ts`, `lib/covers/pipeline.ts` |
| 5 | Admin Add Book / CSV import always fail (`isbn13`); admin edit can't clear fields | 🟠 High | Low | [x] COMPLETE | `lib/actions/admin-books.ts`, `lib/actions/admin-import.ts`, `components/admin/book-form.tsx`, `lib/validation/admin.ts`, new `lib/utils/isbn.ts` |
| 6 | Remaining dependency advisories (sharp/libvips, resend/svix, sentry, dev tools) | 🟠 High | Medium | [x] COMPLETE | `package.json`, `package-lock.json`, `next.config.ts` |
| 7 | Caught errors never reach Sentry; env values not trimmed | 🟠 High | Low | [x] CODE COMPLETE - Verification blocked | `lib/utils/log.ts`, new `lib/utils/env.ts`, env readers |
| 8 | AI routes: input caps/roles, place-search pins, abort, timeouts, cached fallbacks | 🟠 High | Medium | [x] COMPLETE | `app/api/ai/*`, `lib/ai/tools.ts`, `lib/ai/trending-insights.ts` |
| 9 | Goodreads import: wrong-book matches, multiline CSV, 1,000-row caps, body limit | 🟠 High | Medium | [x] COMPLETE | `lib/actions/import.ts`, `lib/utils/csv-parser.ts`, `next.config.ts` |
| 10 | Messaging & friends: realtime channel clash, cancel-after-send, rejected pair stuck, unread race | 🟠 High | Medium | [x] COMPLETE | `components/messages/*`, `hooks/use-realtime-messages.ts`, `components/social/friend-button.tsx`, `lib/actions/friends.ts`, `lib/actions/messages.ts`, `supabase/migrations/075_*.sql` |
| 11 | Email: GET unsubscribes via link scanners, digest "this week" = all-time, duplicate welcome | 🟡 Medium | Medium | [x] COMPLETE | `app/api/email/unsubscribe/route.ts`, `app/api/cron/weekly-digest/route.ts`, `app/api/webhooks/supabase/route.ts`, `app/(auth)/callback/route.ts` |
| 12 | Date/timezone bugs: challenges, stats month overflow, locale hydration | 🟡 Medium | Low | [x] COMPLETE | `components/challenges/*`, `lib/queries/challenges.ts`, `lib/queries/stats.ts`, `components/stats/*` |
| 13 | Client state: edits can't clear fields, likes never shown, stale QuickRating/BookBrowser, search races | 🟡 Medium | Medium | [x] COMPLETE | `components/reviews/*`, `app/(app)/profile/edit/page.tsx`, `components/books/book-browser.tsx`, search components |
| 14 | Server-action correctness batch (badges, places, clubs, social links, cache tags, auth edge cases) | 🟡 Medium | Medium | [ ] PENDING | `lib/actions/*` |
| 15 | Queries: unstable pagination, capped counts, recs ignore in-app ratings, export gaps | 🟡 Medium | Medium | [ ] PENDING | `lib/queries/*`, `app/api/export/route.ts` |
| 16 | Reader map bugs (stale place panel, mark-spot type, presence, clipped overlays, CSP) | 🟡 Medium | Medium | [ ] PENDING | `components/geo/*`, `next.config.ts` |
| 17 | Accessibility + sign-out-by-prefetch | 🟡 Medium | Low | [ ] PENDING | file pickers, hand-rolled modals, `components/settings/account-section.tsx` |
| 18 | Migration 076: DM indexes/triggers, place-review freeze, feed of disabled users | 🟢 Low | Medium | [ ] PENDING | `supabase/migrations/076_*.sql` |
| 19 | Final QA | - | Medium | [ ] PENDING | - |

**Progress: 9/20 complete (+4 code complete, verification in Task 19)**

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

**Relationship to `launch-2026-09.md`:** that plan's Tasks 0 and 4-7 are still open. Tasks 2-5 here should land before its Task 6 (production smoke test). Its Task 0 (user dashboard work) is independent.

---

## Summary

A full audit on 2026-09-24 (lint, typecheck, 713 tests, `npm audit`, Supabase advisors, and five parallel read-only reviews covering security, data layer, UI, integrations and schema) found the codebase green on tooling but carrying real defects. Worst: Next.js 16.1.6 had two critical RCE advisories (fixed in Task 1); two RLS policies let any signed-in user forge an accepted friendship (bypassing friends-only DMs) or join any public club as admin (live data checked: neither has been exploited); the Google Places API key is shipped to browsers; admin Add Book and CSV import can never succeed; users can insert unmoderated catalog books and make the server fetch arbitrary URLs. Below those sit about 60 medium/low bugs, grouped by area into Tasks 7-18. Every high-severity claim was spot-checked against code or the live DB before it went into this plan. Approach: one task per session, smallest fix at the root cause, migrations numbered 074-076 (075 went to Task 10).

---

## Task 0: Full audit

**Source:** User Request > "perform full audit of the project code"
**Priority:** -
**Effort:** Medium
**File(s):** -

**Context:** Establish baseline and find defects before fixing anything.

**Steps:**
1. [x] Baseline: `npm run lint`, `tsc --noEmit`, `vitest run`, `npm audit`
2. [x] Supabase security + performance advisors
3. [x] Five parallel read-only audits (security; server actions/queries; UI; AI/import/email/cron; schema/RLS)
4. [x] Spot-verify every critical/high finding against code and live DB

**Verify:**
- [x] Baseline recorded: lint 0/0, tsc 0, tests 713 pass / 1 skip, npm audit 35 (1 critical)
- [x] Remaining advisor lints 0028/0029 are exactly the 13 justified in migration 073; live bodies of `approve_*`, `reject_place_submission`, `add_club_creator_as_admin`, `set_book_shelves` all guard on `auth.uid()`/admin
- [x] Live checks: 0 forged accepted friendships, 0 non-creator club admins, 0 `is_admin IS NULL`, 0 rejected friend requests

**Completed Notes:**
- Files modified: none (this plan)
- Approach taken: agents were read-only; findings verified by me: friend_requests INSERT WITH CHECK is only `auth.uid() = sender_id`; book_club_members public branch has no role check; `books` has no `isbn13` column; enrich route embeds `?key=` in photoUrl; place-search reads `.result` (ai@5 uses `.output`); Zod `.optional()` rejects `null`; `log.ts` has no Sentry call.
- Deviations from plan: none
- Issues encountered: agent claim B1 ("new profiles get is_admin NULL") not reproduced in data (0 rows); the missing INSERT branch is still fixed in Task 2 as defence in depth.

**Status:** [x] COMPLETE

---

## Task 1: Upgrade Next.js 16.1.6 → 16.3.6

**Source:** Audit Finding > `npm audit`: next <16.3.3 "Unauthenticated RCE in Image Optimization API when AVIF files are used", "Unauthenticated RCE on windows-hosted servers", plus proxy-bypass, SSRF, DoS, cache-poisoning advisories
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `package.json`, `package-lock.json`, `components/geo/map-page-client.tsx`

**Context:** The site serves every cover through next/image and gates auth in `proxy.ts`, so the image RCE and proxy bypasses applied directly.

**Steps:**
1. [x] `npm install next@16.3.6 eslint-config-next@16.3.6`
2. [x] Fix the one new lint warning (`@next/next/no-location-assign-relative-destination`, map-page-client.tsx:79) with `router.push`

**Verify:**
- [x] `npm ls next` = 16.3.6; npm audit shows no `next` entry
- [x] Lint 0 errors / 0 warnings; tsc clean; 713 tests pass
- [x] `npm run build` passes

**Completed Notes:**
- Files modified: `package.json`, `package-lock.json`, `components/geo/map-page-client.tsx`
- Approach taken: exact-version bump of both packages (keeps eslint-config in lockstep); signed-out "mark spot" redirect now uses `useRouter().push`.
- Deviations from plan: done ahead of plan creation at user request ("upgrade next now while agents run").
- Issues encountered: none. Not yet committed or deployed.

**Status:** [x] COMPLETE

---

## Task 2: Migration 074 — RLS holes and integrity

**Source:** Audit Finding > schema review A1, A2, B1, B2, B3, C3, C5, C6
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `supabase/migrations/074_rls_integrity_fixes.sql`, `types/database.generated.ts` (regenerated)

**Context:**
- A1: `friend_requests` INSERT only checks `sender_id`; `POST {status:'accepted'}` makes `are_friends()` true → DMs to anyone, fake friends, and friends_count underflow on unfriend.
- A2: `book_club_members` INSERT public branch doesn't pin `role` → join any public club as `admin` → delete/rewrite club, kick members.
- B1: migration 066 rewrote `protect_admin_columns()` without the `TG_OP='INSERT'` branch; still blocks self-grant only by NULL accident.
- B2: `book_submissions.book_id` FK has no ON DELETE → admins can't delete books that came from approved submissions (23503).
- B3: `get_top_reviewers` (SECURITY DEFINER, anon) shows disabled users on /community; `limit_count` uncapped.
- C3: club admins can PATCH `book_clubs.member_count`/`created_by` (not in 064's freeze set).
- C5: `shelf_books` INSERT/UPDATE don't check the `user_book_id` belongs to the caller.
- C6: `update_list_likes_count` decrement has no zero floor.
- SQL for each is in the schema-review output; re-derive from the FINAL definitions (068 for policies, 066 for the trigger, 041 for the function) rather than copying blindly.

**Steps:**
1. [x] Load `supabase:supabase-postgres-best-practices` skill; re-read final definitions in 068/066/041/026/002
2. [x] Write 074 (single transaction): A1 policy + `status` NOT NULL (backfill `pending`); A2 policy + `role` NOT NULL (backfill `member`); B1 function with INSERT branch; B2 FK `ON DELETE SET NULL`; B3 function + re-apply 073 grants; C3 freeze trigger (`is_api_role()`); C5 policies; C6 function
3. [x] Apply: `npx supabase db query --linked -f supabase/migrations/074_rls_integrity_fixes.sql`
4. [x] `npm run types:gen`
5. [x] Confirm app code paths still work: `lib/actions/friends.ts` send (inserts `pending`), `lib/actions/clubs.ts` create/join, shelves assignment

**Verify:**
- [ ] As a throwaway authenticated user (Playwright dev-login recipe or SQL `set local role authenticated` + `request.jwt.claims`): INSERT friend_request with `status='accepted'` → rejected; INSERT club member `role='admin'` on someone else's public club → rejected; normal join as member → OK
- [ ] PATCH `book_clubs.member_count` as club admin → value unchanged
- [x] `get_top_reviewers(1000)` returns ≤50 rows, no disabled users
- [x] Security advisors: no new lints
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `supabase/migrations/074_rls_integrity_fixes.sql` (new, applied 2026-09-24), `types/database.generated.ts` (regenerated: status/role now non-null)
- Approach taken: every definition re-derived from the LIVE DB (pg_policies, pg_get_functiondef), not old migration files. A1 INSERT requires `status='pending'`; A2 public branch requires `role='member'` (creator-admin branch kept; app uses the SECURITY DEFINER RPC anyway); B1 explicit INSERT branch forces is_admin=false, grant/disabled cols NULL; B2 FK `ON DELETE SET NULL`; B3 `WHERE p.disabled_at IS NULL`, `LIMIT LEAST(GREATEST(COALESCE(n,5),0),50)`, 073 grants re-applied; C3 new `freeze_book_club_columns()` BEFORE INSERT OR UPDATE trigger (API roles: INSERT forces member_count=0, UPDATE keeps member_count/created_by); `update_club_member_count()` is SECURITY DEFINER so its writes pass through; C5 INSERT+UPDATE WITH CHECK require own user_book; C6 `GREATEST(0, …)`. Backfills were no-ops (0 NULL rows).
- Deviations from plan: none in SQL. Verified live catalog state read-only: both policies, both NOT NULLs, FK, trigger, INSERT branch, likes floor, get_top_reviewers ACL unchanged; `get_top_reviewers(1000)` = 3 rows (only 3 reviewers exist), 0 disabled. Advisors: same 13+4 lints justified in 073 plus the known backup-table INFO, nothing new. Lint 0/0, tsc clean, 713 pass / 1 skip. App paths read: friends.ts inserts `pending`; clubs.ts joins with `role:"member"` and creates admin via RPC; shelves go through `set_book_shelves` (SECURITY DEFINER).
- Issues encountered: the impersonation checks (Verify items 1-2) were blocked by the permission classifier because they write to the production DB as a simulated user. My script also had no final ROLLBACK. User chose (2026-09-24): mark CODE COMPLETE; the two impersonation checks move to Task 19.

**Status:** [x] CODE COMPLETE - Verification blocked

---

## Task 3: Google Places API key leaked to browsers; enrich cache poisoning

**Source:** Audit Finding > security #1, #5; UI low (CSP blocks enriched photos)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `app/api/geo/places/enrich/route.ts`, new `app/api/geo/places/photo/route.ts`, `components/geo/map-detail-panel.tsx`, `next.config.ts`

**Context:** `enrich/route.ts:109` returns `https://places.googleapis.com/v1/{photo}/media?key=${GOOGLE_PLACES_API_KEY}` to the client, CDN-cached for a day. Anyone opening a place gets the raw key; once Google billing is enabled (launch Task 0) that is a direct cost exposure. Separately, the in-memory cache is keyed only on the client-supplied `osm_id`, so a crafted request stores another business's data under a real place.

**Steps:**
1. [x] Server: call `.../media?maxWidthPx=400&skipHttpRedirect=true` with header `X-Goog-Api-Key` and return only the resulting `photoUri` (googleusercontent host) — or add a proxy route if photoUri is short-lived; pick after checking Google docs
2. [x] Ensure the returned image host is allowed by CSP `img-src` (and remotePatterns if next/image is used)
3. [x] Key the enrich cache on `osm_id|name|lat|lng` (rounded)
4. [ ] ⚠️ USER ACTION: rotate `GOOGLE_PLACES_API_KEY` in Google Cloud and Vercel after deploy (the old key has been public)

**Verify:**
- [x] Enrich JSON contains no `key=` substring (route test with mocked Google; no local Places key to curl)
- [ ] Place photo renders in the map detail panel (no CSP violation in console) — deferred to Task 19 (needs deploy + real key)
- [x] Two requests with same `osm_id` but different `name` don't share a cache entry
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `app/api/geo/places/enrich/route.ts`, `components/geo/map-detail-panel.tsx`, new `__tests__/app/api/geo-places-enrich.test.ts`
- Approach taken: new `fetchPhotoUri()` calls `/media?maxWidthPx=400&skipHttpRedirect=true` with the `X-Goog-Api-Key` header and returns only `photoUri` (https, googleusercontent), or null on failure. Cache key is now `osm_id|name|lat.toFixed(4)|lng.toFixed(4)`. CDN `Cache-Control` cut from `s-maxage=86400, swr=604800` to `s-maxage=3600` (matches the memory TTL) because Google calls photoUri short-lived. Panel `<img>` hides its frame `onError` (expired URI) and is keyed on the URL so the hidden state resets per place.
- Deviations from plan: no proxy route and no `next.config.ts` change: CSP `img-src` already allows `https://*.googleusercontent.com`, and the panel uses a plain `<img>` so remotePatterns doesn't apply. Google's docs don't give a photoUri lifetime, hence the shorter CDN TTL plus the onError fallback instead of a proxy.
- Issues encountered: no `GOOGLE_PLACES_API_KEY` locally, so the header-auth media call and the rendered photo can't be checked until deploy. Tests: 3 new, full suite 716 passed, lint 0.

**Status:** [x] CODE COMPLETE - Verification blocked

---

## Task 4: Add-from-AI-search — SSRF, unmoderated catalog inserts, rejected nulls

**Source:** Audit Finding > security #2, #3; integrations #15; data-layer #2
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/actions/books.ts` (`importAndAddToShelf`), `lib/validation/book-action.ts`, `lib/covers/pipeline.ts`, `lib/utils/covers.ts`

**Context:** `importAndAddToShelf` inserts into `books` via the service-role client using fully client-supplied fields, so any user can publish books to public pages and SEO, bypassing `book_submissions`. `coverUrl` accepts any http(s) host and `processBook` fetches it with `redirect:"follow"` (blind SSRF, result copied into the public bucket). Meanwhile legitimate use breaks: the only caller passes `pageCount/publishedDate: null` which `.optional()` rejects, and Google dates like `"2004"` fail the DATE column.

**Steps:**
1. [x] ❓ Ask user: re-fetch the record server-side from Google Books / Open Library by id (recommended — keeps one-click add) vs. route through `book_submissions` moderation
2. [x] Implement chosen option; server-derived data only
3. [x] Cover fetch: `https:` only, host in `ALLOWED_IMAGE_HOSTS`, `redirect:"manual"` or re-check final host
4. [x] Schema: `.nullish()` for optional fields; normalise `publishedDate` with the existing `normalizeDate()` (admin-enrichment.ts:66)
5. [x] Tests for validation + host allow-list

**Verify:**
- [ ] AI search → add a book lacking page count → succeeds (unit-tested; the live check needs an LLM key and Google Books quota, neither available locally) — deferred to Task 19 (user, 2026-09-24)
- [x] Action called with fabricated title/cover for a real Google id → stored data comes from Google, not the client
- [x] Cover URL `http://169.254.169.254/` → never fetched (unit test)
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `lib/actions/books.ts`, `lib/validation/book-action.ts`, `lib/utils/external-book-search.ts`, `lib/covers/pipeline.ts`, `lib/actions/admin-enrichment.ts`, `components/ai/ai-book-search.tsx`, `__tests__/lib/actions/books.test.ts`, `__tests__/lib/covers/pipeline.test.ts`
- Approach taken: user chose "re-fetch by ID" (2026-09-24). `ExternalBookData` is now `{ googleBooksId?, openLibraryId? }` (`.nullish()`, regex-checked: Google `^[A-Za-z0-9_-]{1,40}$`, OL `^OL\d{1,10}W$`, at least one required). The action looks for an existing row by id, else calls new `getGoogleBookById()` (`/volumes/{id}`, HTML description stripped) or `getOpenLibraryWorkById()` (search `key:/works/…` + work description), re-checks by the fetched ISBN, then inserts only fetched data. `published_date` goes through `normalizeDate()` (moved from admin-enrichment into external-book-search and exported); `open_library_cover_id` is now stored too. The client sends only the id. `fetchAndScore()` now uses `redirect: "manual"`, follows at most 3 hops and runs `isAllowedImageHost()` (https + allow-listed host) on every hop before fetching.
- Deviations from plan: `lib/utils/covers.ts` needed no change; the allow-list check lives in the pipeline, the one place that fetches. The `.single()` duplicate lookups became `.maybeSingle()`.
- Issues encountered: Google Books' anonymous quota is exhausted from this machine and there is no local LLM key, so the full AI-search click-through can't run locally. Live checks run instead with tsx: OL lookup of OL468431W returned full data; real OL covers (302 → *.us.archive.org) and Google zoom-3 covers still score ok through manual redirects; `http://169.254.169.254/` is refused without a request. No DB cover_url is off the allow-list (5,191 bucket, 24 books.google.com, 1 covers.openlibrary.org), so existing rows are unaffected. Tests: 11 new (6 action, 5 pipeline), 1 pipeline expectation updated (example.com now refused); full suite 731 passed, lint 0, tsc 0.

**Status:** [x] CODE COMPLETE - Verification blocked

---

## Task 5: Admin Add Book / CSV import always fail; admin edit can't clear fields

**Source:** Audit Finding > data-layer #1; UI #1, #2, #6, low (slug rebuild)
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `lib/actions/admin-books.ts`, `lib/actions/admin-import.ts`, `components/admin/book-form.tsx`

**Context:** Both write `isbn13`, which doesn't exist on `books` (verified), so PostgREST rejects every insert; the import dedupe lookup on `isbn13` errors silently. Edit mode sends empty fields as `undefined`, which the action skips, so clearing a field "succeeds" but keeps the old value. Every edit also rebuilds the slug, breaking existing links.

**Steps:**
1. [x] Map ISBN-13 into `isbn` (prefer 13 over 10) in create/update/import; drop `isbn13` references; keep the form field or merge it with ISBN
2. [x] Edit mode: send `""` for cleared fields; action maps `""` → null
3. [x] Only regenerate slug when title/author changed (or never on edit — check how slugs are referenced)
4. [x] Unit tests for the insert payload shape

**Verify:**
- [x] Admin → Add Book → saves (then delete the test book)
- [x] Admin CSV import of a 2-row file → 2 created, re-import → 2 skipped as duplicates
- [x] Clearing description in edit → null in DB
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `lib/actions/admin-books.ts`, `lib/actions/admin-import.ts`, `components/admin/book-form.tsx`, `lib/validation/admin.ts`, new `lib/utils/isbn.ts`; tests `__tests__/lib/actions/admin-books.test.ts` (+5), new `__tests__/lib/actions/admin-import.test.ts` (2), new `__tests__/lib/utils/isbn.test.ts` (3)
- Approach taken: new `normalizeIsbn()` strips hyphens/spaces and converts ISBN-10 (incl. `X`) to ISBN-13; every one of the 5,499 stored ISBNs is 13 digits, and `books_isbn_unique_idx` is on `isbn`. Create/update/import write only `isbn` (normalised); import dedupes on the normalised ISBN (13 preferred over 10) with `.maybeSingle()`, and the title+author check uses `.limit(1).maybeSingle()` so several matches still count as a duplicate. The form merges ISBN-10/ISBN-13 into one "ISBN" field (the edit form used to show the stored 13-digit ISBN under an "ISBN-10" label with maxLength 10) and always sends strings, with `page_count: null` when blank, so clearing reaches the action. Schema: `isbn` refined to 10/13 digits, `isbn13` dropped from the form schema (the CSV row schema keeps it; the parser still emits it), `page_count` `.nullish()`. The slug is rebuilt only when the trimmed title differs from the stored one.
- Deviations from plan: slug is kept unless the title changes (author changes never touch it; slugs are title-based). Added: a unique-ISBN violation (23505 on `isbn`) now returns "A book with this ISBN already exists" instead of "Failed to create book". The live check hit exactly this, because Dune's ISBN is already in the catalog.
- Issues encountered: verified live on local dev against prod with a throwaway `omr-qa-*` admin (user approved, 2026-09-24): Add Book with a duplicate ISBN showed the new message; with an unused ISBN it saved (`isbn` 9799999999990). Edit with a custom slug `omr-qa-test-book-kept`, clearing description + page count → both null, slug unchanged. CSV import (ISBN-10 `0-8044-2957-X` + a no-ISBN row) → 2 imported (stored `9780804429573`), re-import → 2 skipped. All 3 test books and the account were deleted and the profile count is 0. Console showed only React's dev-mode eval/CSP notice. Suite 741 passed, lint 0, tsc 0.

**Status:** [x] COMPLETE

---

## Task 6: Remaining dependency advisories

**Source:** Audit Finding > `npm audit` (after Task 1: sharp high via libvips CVEs, resend→svix→uuid, @sentry/nextjs→opentelemetry, vitest critical (dev), happy-dom high (dev), assorted transitive)
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `package.json`, `package-lock.json`

**Context:** `sharp` is used by next/image in production and by the cover pipeline, so libvips CVEs matter; fix requires 0.35 (semver-major). Everything else is fixable non-breaking. Dev-only advisories (vitest, happy-dom, vite, rollup) don't ship but should still be closed.

**Steps:**
1. [x] `npm audit fix` (no `--force`)
2. [x] `npm install sharp@^0.35` — read its changelog for API breaks; grep `sharp(` usages in `lib/covers` and `scripts`
3. [x] Bump `@ai-sdk/*` patch versions only if within v2/ai@5 line (low advisory); do NOT move to AI SDK v7 here
4. [x] Re-run audit and record what remains with a reason

**Verify:**
- [x] `npm audit --omit=dev`: 0 high/critical
- [x] Cover pipeline unit tests pass; `npm run covers:process -- --dry-run` (or equivalent) runs
- [x] Build, lint, tsc, tests pass

**Completed Notes:**
- Files modified: `package.json`, `package-lock.json`, `next.config.ts` (1 line)
- Approach taken: `npm audit fix` (no `--force`) took 39 advisories down to 9. It resolved within existing ranges: `@sentry/nextjs` 10.75.3, `resend` 6.28.1 (svix/uuid fixed), `vitest` 4.1.11, `vite` 7.3.6, `happy-dom` 20.14.5, plus rollup/ws/serialize-javascript/picomatch/protocol-buffers-schema. `npm update brace-expansion` moved eslint's copy from 1.1.12 to 1.1.21. `sharp` ^0.34.5 → ^0.35.4, which Next 16.3.6 also requires, so it dedupes to one copy. The API calls we use (`resize`/`jpeg({mozjpeg})`/`rotate()`/`metadata()`/`toBuffer({resolveWithObject})`) are unchanged in 0.35. It now ships an `exports` map with CJS and ESM entries, and `import sharp from "sharp"` resolves in both Next and tsx. AI SDK kept on the v5 line, pinned exact: `ai` 5.0.265, `@ai-sdk/react` 2.0.268, `anthropic` 2.0.105, `google` 2.0.99, `openai` 2.0.129 (fixes provider-utils <3.0.28).
- Deviations from plan: (1) Added `"overrides": { "undici": "^6.28.1" }`. provider-utils ≥3.0.31 depends on `undici@^5.29.0` for its SSRF-safe download fetch, and every 5.x is flagged high (12 advisories). The alternative was pinning provider-utils 3.0.28–3.0.30, which predates the undici dependency but also loses that SSRF guard. provider-utils uses only `Agent({connect:{lookup}})` and `fetch`, which are unchanged in v6. Smoke-tested: the custom lookup fires and the fetch returns 200. Drop the override when an ai@5 patch moves to undici ≥6.27.1. (2) `next.config.ts` now imports `withSentryConfig` from `@sentry/nextjs/config`, because Sentry 10.75 warns at build time that the root import stops working in v11.
- Issues encountered: none. Results: `npm audit` 0 vulnerabilities (dev deps included); `covers:process -- --dry-run --force --limit 3` gave 3 stored, 0 failed (1 placeholder candidate rejected as designed); build OK with no Sentry warning; lint 0; tsc 0; vitest 741 passed / 1 skipped.

**Status:** [x] COMPLETE

---

## Task 7: Caught errors never reach Sentry; env values not trimmed

**Source:** Audit Finding > integrations #5, #11
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `lib/utils/log.ts`, new `lib/utils/env.ts` (or reuse `headerSafeEnv`), `app/api/cron/weekly-digest/route.ts`, `app/api/webhooks/supabase/route.ts`, `lib/email/resend.ts`, `app/api/geo/places/enrich/route.ts`, `lib/services/mapbox-mcp.ts`, email templates (`NEXT_PUBLIC_SITE_URL`)

**Context:** `logError`/`reportError` only console-log; every AI, cron, webhook, export and import route catches its errors, so Sentry sees none of them (and a comment in the rate limiter relies on it). Production env values are known to carry pasted CR-LF (memory `vercel-env-pasted-newlines`); `CRON_SECRET` with a trailing CR would make the cron 401 forever, and header values with CR are rejected by undici.

**Steps:**
1. [x] `logError`: `Sentry.captureException(error, { extra: context })` (guard for non-Error values; keep tests green / mock Sentry)
2. [x] Shared `env(name)` helper that strips `\r\n` and trims; use it in the listed readers
3. [x] Test for the helper and for logError → captureException

**Verify:**
- [x] Unit tests pass
- [x] Grep: no raw `process.env.X` used in a header/compare among the listed files
- [ ] (Blocked until Sentry DSN fixed in launch Task 0) an error thrown in a caught route appears in Sentry — deferred to Task 19 (user approved 2026-09-24)

**Completed Notes:**
- Files modified: `lib/utils/log.ts`, new `lib/utils/env.ts`, `lib/utils/rate-limit.ts`, `lib/covers/pipeline.ts`, `app/api/cron/weekly-digest/route.ts`, `app/api/webhooks/supabase/route.ts`, `app/api/geo/places/enrich/route.ts`, `lib/email/resend.ts`, `lib/email/unsubscribe-token.ts`, `lib/email/templates/welcome.ts`, `lib/email/templates/weekly-digest.ts`, `lib/services/mapbox-mcp.ts`; tests `__tests__/lib/utils/log.test.ts` (+3 Sentry cases), new `__tests__/lib/utils/env.test.ts` (5 cases), `__tests__/lib/utils/rate-limit-kv.test.ts` (mock gains `logError`)
- Approach taken: `logError` (and so `reportError`) now calls `Sentry.captureException`. It passes Error instances as they are and wraps anything else in `new Error(message)` so the event has a title. `extra` carries the scrubbed info plus the call-site context. `cleanEnv(value)` strips CR/LF and trims. It takes the value, not the name, so `NEXT_PUBLIC_*` reads stay literal and can still be inlined. The pipeline's private `headerSafeEnv` was replaced by it. Applied to CRON_SECRET, SUPABASE_WEBHOOK_SECRET, EMAIL_TOKEN_SECRET, RESEND_API_KEY/FROM_EMAIL, GOOGLE_PLACES_API_KEY, MAPBOX_ACCESS_TOKEN and NEXT_PUBLIC_SITE_URL in the digest route and both email templates.
- Deviations from plan: the rate limiter used `logger.error` (never Sentry) for the missing-KV warning and its three KV failure paths, although its comment said Sentry would see them. All four now go through `logError`. Only `logError` reports to Sentry; the ~50 bare `logger.error` calls elsewhere still only log (see Out of Scope).
- Issues encountered: none. vitest 749 passed / 1 skipped; `tsc --noEmit` and lint clean. The live Sentry check needs the DSN and ingest 403 fixed (launch Task 0).

**Status:** [x] CODE COMPLETE - Verification blocked

---

## Task 8: AI routes hardening + place-search pins

**Source:** Audit Finding > integrations #4, #9, #10, #13, #14; security #4
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `app/api/ai/book-search/route.ts`, `app/api/ai/place-search/route.ts`, `lib/ai/tools.ts`, `lib/ai/trending-insights.ts`, `app/api/ai/curated-picks/route.ts`, `app/api/geo/search/route.ts`, `app/api/geo/ip-location/route.ts`

**Context:** Place search reads `tr.result?.places`, but ai@5 tool results use `output` → map never gets pins (verified). Chat routes accept unbounded messages and any `role` (incl. `system`) → cost and prompt injection; `lat/lng` go unvalidated into the system prompt. Aborts aren't forwarded. External fetches lack timeouts; model-chosen `limit` unbounded. Failed Gemini calls return fallback text that `unstable_cache` stores for 24h.

**Steps:**
1. [x] Place search: read `.output?.places`
2. [x] Zod request schema for both chat routes: roles `user|assistant`, last 20 messages, per-message ≤2,000 chars, finite lat/lng in range
3. [x] Pass `abortSignal: request.signal`
4. [x] `AbortSignal.timeout(8000)` on Google Books, Nominatim, ipapi, Places, Mapbox MCP fetches; clamp tool `limit` ≤20
5. [x] Trending/curated: throw on any failed per-item call inside the cached fn; serve fallback outside the cache
6. [x] Tests for the schema and the `.output` extraction

**Verify:**
- [x] Unit tests pass (no LLM key locally — mock `generateText` result shape from `node_modules/ai` types)
- [x] Request with `role:"system"` or 101 messages → 400 (see Deviations: the cap is 100, not 50)
- [x] Lint, tsc pass

**Completed Notes:**
- Files modified: `app/api/ai/book-search/route.ts`, `app/api/ai/place-search/route.ts`, `app/api/ai/curated-picks/route.ts`, `lib/ai/schemas.ts` (+`chatRequestSchema`, `chatMessageText`, `CHAT_HISTORY_LIMIT`), `lib/ai/place-tools.ts` (+`extractPlaces`), `lib/ai/tools.ts`, `lib/ai/trending-insights.ts`, new `lib/cache/uncached-result.ts`, `app/api/geo/search/route.ts`, `app/api/geo/ip-location/route.ts`, `app/api/geo/places/enrich/route.ts`, `lib/services/mapbox-mcp.ts`; tests: new `__tests__/app/api/ai-chat-routes.test.ts` (8 cases), new `__tests__/lib/cache/uncached-result.test.ts` (3), `__tests__/lib/ai/schemas.test.ts` (+4)
- Approach taken: both chat routes `safeParse` the body with one shared schema. It allows the roles `user`/`assistant` only, 1–100 messages, and up to 100 parts per message. Text is capped at 2,000 chars for user messages and 8,000 for assistant ones. `lat`/`lng` must be numbers in range. Unknown fields pass through, so useChat's `id`/`trigger` and tool parts are fine. A bad body or bad JSON returns 400 before any model call. Only the last 20 messages go to the model, and both routes forward `request.signal`. `extractPlaces` reads `output.places` from `searchNearbyPlaces` results only. All six external fetches have an 8s timeout, and each one was already inside a try/catch. `searchBooks` clamps the model's `limit` to 1–20. The other tools were already bounded: 15 fetched, 20 community rows. For trending and curated picks, a failed per-book AI call still produces its fallback, but the cached function then throws `UncachedResult(value)`. `serveUncachedResult` wraps the `unstable_cache` and returns that value, so it is served but never stored. On a stale entry, Next keeps serving the old value when the refresh throws (checked in `unstable-cache.js`).
- Deviations from plan: the plan said "last 20 messages" and "50 messages → 400". Together those would break useChat, which resends the whole history: the 11th exchange would start failing with 400. So the hard cap is 100 messages, and the last 20 go to the model. The per-message 2,000-char cap applies to user text only. Assistant replies can run to ~800 tokens (~3,200 chars), so they get 8,000. `external-book-search.ts` fetches (Open Library) still have no timeout. They weren't in this task's list.
- Issues encountered: the first full run had one failure in `quick-rating.test.tsx` (an unrelated component). It passes on its own and on a second full run, so it looks like a flake under load. Final run: 767 passed / 1 skipped; tsc and lint clean. The first request from the route test's `origin` header got a 403: `ALLOWED_ORIGINS` is read at module load, so the test sends no Origin instead.

**Status:** [x] COMPLETE

---

## Task 9: Goodreads import correctness

**Source:** Audit Finding > integrations #1, #2, #3; data-layer #6; UI low (1 MB server-action body)
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `lib/actions/import.ts`, `lib/utils/csv-parser.ts`, `next.config.ts`

**Context:** `normalize()` strips `[^\w\s]` without `u`, so non-Latin titles become `""` and `includes("")` matches the first catalog book → wrong book silently shelved. The parser splits lines before quote handling, so multi-line reviews become fake rows. Title matching sees only PostgREST's 1,000-row cap of the catalog; `existingUserBooks` is also capped, so large shelves hit the unique constraint and the whole import fails. Server actions default to a 1 MB body; Goodreads exports with reviews exceed it.

**Steps:**
1. [x] Normalise with `/[^\p{L}\p{N}\s]/gu`; skip fuzzy match on empty strings; `includes` only when shorter ≥4 chars
2. [x] Quote-aware whole-file tokenizer (newlines inside quotes), strip BOM
3. [x] Title candidates via targeted query (ilike on normalised title, or RPC) instead of loading the catalog; existing-book check via `.in("book_id", matchedIds)`
4. [x] `experimental.serverActions.bodySizeLimit` (e.g. `"5mb"`) — confirm the Next 16 config key
5. [x] Tests: Cyrillic row, multi-line review, 3-char title

**Verify:**
- [x] New tests pass; existing csv/import tests pass
- [x] Import of a real Goodreads export sample (scratchpad fixture) produces correct matches
- [x] Lint, tsc pass

**Completed Notes:**
- Files modified: `lib/utils/csv-parser.ts`, `lib/actions/import.ts`, `next.config.ts`. Tests: `__tests__/lib/utils/csv-parser.test.ts` (+2: a multi-line CRLF review, a BOM), `__tests__/lib/actions/import.test.ts` (+2: a Cyrillic match next to an unknown Cyrillic title, a 3-char title; the shelf-skip test now asserts `.in("book_id", [...])`; `arrange()` routes `.in` by column and answers `.or`)
- Approach taken: `parseCSVRecords` walks the whole file once. Newlines inside quotes stay in the field; blank lines are dropped; a leading BOM is stripped. `normalize` keeps letters and digits from any script. `isSimilar` returns false for an empty side and allows containment only when the shorter string has ≥4 chars. Title candidates no longer come from loading the catalog. `titlePattern` takes a title's leading run of letters, digits and spaces, up to the first punctuation (subtitle colon, series parenthesis, apostrophe). It becomes an ilike prefix (`Dune*`), or an exact ilike when under 4 chars (`It`). Unmatched rows are queried 50 patterns per `.or()`, and the candidates are deduped by id. The existing matching logic then runs over those candidates. Matching now happens before the shelf check (`findMatch`), so the check can ask only about the matched ids: `.eq(user_id).in(book_id)` in chunks of 500. `bodySizeLimit: "4mb"`: the key is confirmed in `node_modules/next/dist/docs/.../serverActions.md`, and 4 MB stays under Vercel's 4.5 MB request cap.
- Deviations from plan: I used a 4 MB limit instead of 5 MB, because Vercel rejects bodies over 4.5 MB anyway. No RPC or migration was needed. The Zod 1,000-row-per-import cap stays: it is a deliberate bound, not the PostgREST cap.
- Issues encountered: the live check used a scratchpad fixture: the real 24-column Goodreads header, BOM, CRLF, multi-line quoted reviews, and 9 rows built from real catalog titles. A temporary vitest file ran the real action against the live catalog with the anon key; `user_books` reads and inserts were stubbed. Result: 7 matched correctly. The matches included "Escape from Mr. Lemoncello's Library (…, #1)" against the catalog's curly-apostrophe title, "Le royaume de Kensuké", a 4-char "Cell" and a 2-char "It". "Dune (Dune #1)" was deduped against the ISBN-matched Dune. The unknown "Мастер и Маргарита" came back not found; the old code would have shelved it as an arbitrary catalog book. The temp file is deleted. The first run got a 401 because `.env.local` values end in a literal `\r\n` (known, see the vercel-env-pasted-newlines memory). Full suite: 771 passed / 1 skipped; tsc and lint clean.

**Status:** [x] COMPLETE

---

## Task 10: Messaging & friends

**Source:** Audit Finding > UI #3, #4, low (chat stale guard); data-layer #3, #12
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `components/messages/conversation-list.tsx`, `components/messages/chat-wrapper.tsx`, `components/messages/chat-panel.tsx`, `components/social/friend-button.tsx`, `lib/actions/friends.ts`, `lib/actions/messages.ts`

**Context:** Two components subscribe to the same realtime channel name; the second `.on()` after `subscribe()` causes a binding mismatch/CHANNEL_ERROR and unmount tears down the shared channel → unread badge and list never update live. Cancel right after send does nothing (no `requestId`). After a rejection the pair can never be friends (unique pair index from 064 + delete policy excludes rejected). Unread counter recount overwrites concurrent increments; failed count writes 0.

**Steps:**
1. [x] Remove the subscription from `ConversationList` (it already re-syncs from props)
2. [x] `sendFriendRequest` returns the new id; button stores it
3. [x] Rejected-row resend: reopen the existing row (SECURITY DEFINER RPC or allow deleting rejected rows) — decide with Task 2's migration context; if SQL needed, add to 074 or 075
4. [x] `chat-panel` loadChat stale guard; drop the 300 ms reset race
5. [x] Unread recount: skip the write on count error

**Verify:**
- [x] Two browser sessions (Playwright dev-login): message arrives → badge increments without reload
- [x] Send then immediately cancel → request gone
- [x] Reject then re-send → works
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `components/messages/conversation-list.tsx`, `components/messages/chat-panel.tsx`, `components/messages/chat-wrapper.tsx`, `hooks/use-realtime-messages.ts`, `components/social/friend-button.tsx`, `lib/actions/friends.ts`, `lib/actions/messages.ts`, new `supabase/migrations/075_friend_request_rejected_delete.sql` (applied to prod 2026-09-24). Tests: new `__tests__/lib/actions/friends.test.ts` (4), `__tests__/lib/actions/messages.test.ts` (+1: a failed recount leaves the counter alone).
- Approach taken: `ConversationList` no longer subscribes; `ChatWrapper` owns the only `direct_messages:<user>` channel and passes conversations down (its unused `userId` prop is gone). `ChatPanel` reports the open chat (`onActiveFriendChange`). The wrapper skips the per-conversation unread bump for that friend, because `ChatWindow` marks those messages read, and it zeroes that row when the chat opens. `loadChat` ignores responses for a friend who is no longer selected. Close resets `selectedFriendId` synchronously (the old 300 ms timeout cleared a chat reopened inside the delay). `sendFriendRequest` returns `{ requestId }` (read via `.insert().select("id").single()`), and the button stores it, so Cancel works without a reload. With a rejected row, the action deletes it (`.eq("status","rejected").select("id")`, and a zero-row result is an error) before inserting. Migration 075 extends the DELETE policy so either party may delete a rejected row. `markMessagesAsRead` skips the service-role counter write when the recount errors or returns null.
- Deviations from plan: (1) The live check found the real reason DMs never updated live: realtime-js 2.86.2 built the join payload before its async token lookup finished, so every channel joined with the anon key. RLS then hid every `direct_messages` INSERT. The later `setAuth()` saw no change and never sent the token. The WS frames confirmed it: `phx_join` had no `access_token`, and "Subscribed to PostgreSQL" came back ok with zero events. Fix: the hook `await`s `supabase.realtime.setAuth()` before creating the channel, and cleanup handles a still-pending join. (2) The SQL landed as migration 075 (074 was already applied), so Task 18's migration becomes 076. (3) The recount can still lose a message that arrives between the count and the write; closing that race needs the count done in SQL, which belongs with Task 18's DM triggers.
- Issues encountered: I checked live with two throwaway accounts in two Playwright contexts on `next dev`, then deleted both. Results: send then immediate cancel → row gone, toast "Friend request cancelled". A→B request, B rejects, B sends B→A → new pending row, the rejected row gone. After the hook fix: the join frame carries `access_token`, and B's message moved A's trigger from "3 unread" to "4 unread" without a reload. A's open list showed the new message live and bumped the row's count from 4 to 5. A's open chat window showed B's message live, and going back showed that row with no unread badge. Selector gotcha: `button:has-text("Message")` also matches the sidebar's "Messages"; use `getByRole("button", { name: "Message", exact: true })`. Suite: 776 passed / 1 skipped; tsc and lint clean.

**Status:** [x] COMPLETE

---

## Task 11: Email flows

**Source:** Audit Finding > integrations #6, #7, #8
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `app/api/email/unsubscribe/route.ts`, `app/api/cron/weekly-digest/route.ts`, `lib/email/templates/weekly-digest.ts`, `app/api/webhooks/supabase/route.ts`, `app/(auth)/callback/route.ts`

**Context:** GET on the unsubscribe link unsubscribes immediately, so corporate link scanners unsubscribe people. The digest labels lifetime `reading_stats` totals as "this week". Welcome email: webhook only handles `profiles` INSERT while launch Task 0 says configure `auth.users`; if on profiles, the callback's "<5 min old" branch sends duplicates, and callback sends without `after()`.

**Steps:**
1. [x] GET renders a confirm page with POST form; POST (incl. RFC 8058 one-click) performs update
2. [x] Weekly count from `finished_at >= oneWeekAgo` with `count:"exact"`; relabel lifetime numbers
3. [x] Single welcome sender (webhook), idempotent; align table with launch plan Task 0 wording; update that plan's step text
4. [x] Tests for unsubscribe GET/POST and digest numbers

**Verify:**
- [x] GET unsubscribe URL → page, no DB change; POST → unsubscribed
- [x] Digest template test shows weekly vs lifetime correctly
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `app/api/email/unsubscribe/route.ts`, `app/api/cron/weekly-digest/route.ts`, `lib/email/templates/weekly-digest.ts`, `lib/actions/email.ts`, `app/api/webhooks/supabase/route.ts`, `app/(auth)/callback/route.ts`, `lib/actions/user.ts`, `.claude/plans/launch-2026-09.md` (Task 0 step 5 wording). Tests: `__tests__/app/api/email-unsubscribe.test.ts` (rewritten for GET = confirm, POST = act), `__tests__/app/api/cron-weekly-digest.test.ts` (+1), `__tests__/app/api/webhooks-supabase.test.ts` (userId), new `__tests__/lib/actions/email.test.ts` (1).
- Approach taken: (1) The signed GET now validates the token and answers a confirm page whose form POSTs to the same `?u=&t=` URL. Only POST (the form, or a mail provider's RFC 8058 one-click) writes. A bad token still answers 400 on either method. (2) The digest's `user_books` query takes `{ count: "exact" }`, so one query gives the 5 books to list plus the weekly total. The new `stats.booksThisWeek` drives the subject and the first banner tile. The banner is now "Books This Week / Books All Time / Day Streak", and the text version splits into THIS WEEK and ALL TIME sections. (3) The webhook on `public.profiles` INSERT is now the only welcome sender. Every sign-up path (the trigger, the callback fallback, `ensureUserProfile`) inserts exactly one profile row, so the three direct sends in the callback (new-profile branch and "<5 min old" branch) and in `ensureUserProfile` are gone. `sendWelcomeEmail` takes `userId` and passes Resend `idempotencyKey: welcome/<userId>`, so a retried webhook sends once (Resend keeps keys for 24 h). The launch plan and the Task 0 memory now say `public.profiles`, not `auth.users`.
- Deviations from plan: none. The "send without `after()`" finding went away with the callback sends.
- Issues encountered: I checked live on `next dev` started with a local `EMAIL_TOKEN_SECRET`, using a throwaway account (deleted afterwards). Signed GET → 200 confirm page with the form, and the flag stayed `true`. POST with a tampered token → 400, flag still `true`. RFC 8058 POST (`List-Unsubscribe=One-Click` body) → 200 "You're unsubscribed", flag `false`. After resetting the flag, clicking the button in Playwright → "You're unsubscribed", flag `false`, so CSP does not block the form. There was no local Resend key, so the welcome-email change is covered by unit tests only; the real email is still launch plan Task 6's check. Suite: 778 passed / 1 skipped; tsc and lint clean.

**Status:** [x] COMPLETE

---

## Task 12: Date/timezone bugs

**Source:** Audit Finding > data-layer #4, #9; UI #5, #13, low (toLocaleString hydration); integrations #16
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/challenges/create-challenge-form.tsx`, `components/challenges/challenge-card.tsx`, `lib/queries/challenges.ts`, `lib/actions/challenges.ts`, `lib/queries/stats.ts`, `components/stats/stats-hero.tsx`, `components/stats/stats-highlights.tsx`, `app/api/og/stats/route.tsx`

**Context:** Create form uses `toISOString()` on local midnight → in Poland (UTC+2) a September challenge becomes Aug 31–Sep 29. Queries compare against UTC midnight of `end_date` → last day excluded, challenge marked failed on its last day permanently. Card shows dates a day early west of UTC and mismatches on hydration. Stats month loop overflows on the 29th–31st. `toLocaleString()` without locale mismatches hydration. OG stats card counts all-time under a year title.

**Steps:**
1. [x] Local date formatting helper (`YYYY-MM-DD` from local getters); use in form
2. [x] End-of-day inclusive comparisons in challenge queries; don't persist `failed` until the day after end
3. [x] Card formats DATE strings with `timeZone:"UTC"`
4. [x] `new Date(y, m - i, 1)` in stats
5. [x] `toLocaleString("en-US")` in stats components
6. [x] OG stats: filter by year
7. [x] Tests with `TZ` variations for the helper and challenge status

**Verify:**
- [x] Tests pass (incl. month-end date mock)
- [x] Lint, tsc pass

**Completed Notes:**
- Files modified: new `lib/utils/dates.ts` (`toLocalDateString`, `challengeWindow`), `lib/queries/challenges.ts`, `components/challenges/create-challenge-form.tsx`, `components/challenges/challenge-card.tsx`, `lib/queries/stats.ts`, `components/stats/stats-hero.tsx`, `components/stats/stats-highlights.tsx`, `app/api/og/stats/route.tsx`. Tests: new `__tests__/lib/utils/dates.test.ts` (8, run under Warsaw/LA/Auckland/UTC), new `__tests__/lib/queries/stats.test.ts` (1, fake clock on Mar 31).
- Approach taken: (1) The create form builds `YYYY-MM-DD` from local getters, so a September challenge made in Poland is Sep 1–30, not Aug 31–Sep 29. (2) `challengeWindow()` treats the DATE end as inclusive: it counts `finished_at` in `[start, end + 1 day)` and `daysRemaining` is 1 on the last day. The challenge is only failed once the day AFTER `end` has passed in UTC, so no timezone sees "failed" on its last day. `syncChallengeProgress` persists whatever `getChallenges` computes, so the persisted status follows the same rule. (3) The card formats dates with `timeZone: "UTC"`. (4) The 12-month loop builds `new Date(y, m - i, 1)`; on Mar 31 the old `setMonth` loop gave 7 distinct months out of 12 (the new test fails on the old code). (5) `toLocaleString("en-US")` in stats hero/highlights. (6) The OG stats card filters `finished_at` to the current UTC year, so books, pages and top genres match its "<year> Reading Stats" title.
- Deviations from plan: `lib/actions/challenges.ts` needed no change (its end ≤ start check compares whole dates). The OG average rating stays all-time: reviews carry no finish date, and filtering them by `created_at` would drop older ratings of books read this year.
- Issues encountered: no user timezone is stored, so the counting window uses UTC days. A book finished just after local midnight east of UTC on the 1st counts toward the previous month's window. Fixing that needs a stored profile timezone; not in scope. Suite: 787 passed / 1 skipped; tsc and lint clean.

**Status:** [x] COMPLETE

---

## Task 13: Client state bugs

**Source:** Audit Finding > UI #7-#12, low (Load More, trending back/forward, admin filter, mobile shelf label)
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `components/reviews/review-form.tsx`, `components/reviews/review-card.tsx`, `components/reviews/quick-rating.tsx`, `app/(public)/books/[slug]/page.tsx`, `app/(app)/profile/edit/page.tsx`, `app/(public)/books/(index)/page.tsx`, `components/books/book-browser.tsx`, `components/search/unified-search.tsx`, `components/lists/list-book-manager.tsx`, `components/discover/reader-browser.tsx`, `components/clubs/set-current-book-dialog.tsx`, `components/trending/trending-grid.tsx`, `components/admin/admin-filters.tsx`, `components/shelves/mobile-shelf-drawer.tsx`

**Context:** Review and profile edits use `|| undefined`, so clearing a field shows success but keeps the old value. `hasLiked` is never populated → hearts always empty; clicking unlikes. QuickRating seeds state once → "already reviewed" error after posting via form. BookBrowser has no key → URL changes ignored. Five search boxes have no stale-response guard. Load More increments page before success.

**Steps:**
1. [x] Edit mode passes `""`/`[]`; verify actions map to null
2. [x] Book page passes liked review ids (reuse `getUserLikedReviewIds`)
3. [x] Keys on `QuickRating`, `BookBrowser`, trending controls, admin filter
4. [x] Request-id guard (or AbortController) in the five search components; refs for current filters
5. [x] Load More: increment after success
6. [x] Mobile shelf trigger shows active shelf name

**Verify:**
- [x] Manual (Playwright dev-login): clear bio → cleared; like review, reload → heart filled; post review then click star → updates
- [x] Lint, tsc, tests pass

**Completed Notes:**
- Files modified: `components/reviews/review-form.tsx`, `app/(app)/profile/edit/page.tsx`, `app/(public)/books/[slug]/page.tsx`, `app/(public)/books/(index)/page.tsx`, `app/(public)/trending/page.tsx`, `components/books/book-browser.tsx`, `components/discover/reader-browser.tsx`, `components/search/unified-search.tsx`, `components/lists/list-book-manager.tsx`, `components/clubs/set-current-book-dialog.tsx`, `components/admin/admin-filters.tsx`, `components/shelves/mobile-shelf-drawer.tsx`, `app/(app)/my-shelf/page.tsx`
- Approach taken: The review and profile edit forms send `""` and `[]` instead of `undefined`. The actions already map blanks to null, so no server change was needed. The book page fetches `getUserLikedReviewIds` for the reviews on the page and sets `hasLiked`. `QuickRating`, `BookBrowser` and `TrendingGrid` have keys, so they remount when their seed data changes. `AdminSearchInput` adopts a URL value it didn't push itself (the render-time state pattern, not an effect). The five search components guard with a request id: a stale response can't apply, and a clear invalidates any request in flight. Genre/sort changes cancel a pending debounced search. Load More advances the page only on success. The mobile shelf button gets the active shelf's name from the server, because the drawer loads shelves only when it opens.
- Deviations from plan: none. `TrendingGrid` got a page-level key (period and genre) rather than per-control keys.
- Issues encountered: (1) `/profile/edit` returned 404 when signed in until the dev server restarted with a clean `.next`. Turbopack's route cache was stale; the code was fine. (2) The first QuickRating read came back empty because dev mode takes about 11 s after posting to refresh the page; polling showed the remount to the form's rating. (3) `quick-rating.test.tsx` "posts a rating-only review" failed once in the full suite (788 tests) but passed 3/3 on its own. It is a timing flake under load; the component is unchanged. Verified live with two throwaway accounts (deleted afterwards). Clearing display name, bio and website left all three null in the DB. After liking a review and reloading, the button showed `aria-pressed=true`, a filled heart and "1 like". After posting a 3-star review through the form, QuickRating showed 3; clicking 5 gave "Rated 5 stars" and updated the same row. After a reload it showed 5.

**Status:** [x] COMPLETE

---

## Task 14: Server-action correctness batch

**Source:** Audit Finding > data-layer #5, #11, #13, #14, #15, #16; UI #19; security #6, #7
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `lib/actions/checkins.ts`, `lib/actions/user.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/clubs.ts`, `lib/actions/places.ts`, `lib/actions/account.ts`, `app/(auth)/reset-password/page.tsx`, `app/(auth)/callback/route.ts`

**Context:**
- Check-in badges insert via session client, blocked by RLS since 064 → never awarded at check-in (use `checkAndUnlockBadges` admin path).
- `updateSocialLinks` delete-then-insert without error checks → links lost/duplicated.
- Enrichment overwrites `published_date`/`open_library_cover_id`; genres skip `normalizeGenres` (also admin-books/import).
- Club create rollback delete affects 0 rows → orphan clubs.
- Places: lat/lng of 0 dropped by truthiness; raw input used instead of parsed.
- `rejectPlaceSubmission` ignores RPC `false` → false success + audit row.
- `deleteAccount`/profile edit don't invalidate review cache tags.
- Reset-password accepts any hash `access_token` (session fixation into attacker account) — legacy branch, PKCE flow exists.
- `ADMIN_EMAILS` grant doesn't require `email_confirmed_at`.

**Steps:**
1. [ ] Fix each bullet at its root; one commit-sized change per bullet
2. [ ] Add/extend unit tests where a test file exists for the action

**Verify:**
- [ ] Tests pass; lint, tsc pass
- [ ] Check-in as test user → badge appears immediately

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 15: Queries — pagination, counts, recommendations, export

**Source:** Audit Finding > data-layer #7, #8, #10; integrations #12
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `lib/queries/users.ts`, `lib/queries/books.ts`, `lib/queries/discover.ts`, `lib/queries/lists.ts`, `lib/queries/clubs.ts`, `lib/queries/recommendations.ts`, `app/api/export/route.ts`

**Context:** `.range()` pagination ordered by non-unique columns (imports share one `updated_at`) duplicates/skips rows — add `id` tiebreaker. Reader-card counts fetch all rows for 20 users and hit the 1,000 cap. Recommendations read `user_books.rating` (only Goodreads import writes it) instead of `reviews.rating`. Export: rate-limit slot spent before validation, unpaginated (>1,000 rows truncated), no BOM for Excel.

**Steps:**
1. [ ] `.order("id")` tiebreaker on every `.range()` query
2. [ ] Per-user HEAD counts or GROUP BY RPC for reader cards
3. [ ] Loved books from `reviews.rating >= 4` (union with user_books.rating)
4. [ ] Export: validate first, `fetchAllPages`, prepend BOM to CSV

**Verify:**
- [ ] Tests pass (update query mocks)
- [ ] /my-shelf Load More on an imported shelf shows no duplicates
- [ ] Lint, tsc pass

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 16: Reader map bugs

**Source:** Audit Finding > UI #14-#18, geo low items
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `components/geo/map-detail-panel.tsx`, `components/geo/mark-spot-modal.tsx`, `components/geo/map-page-client.tsx`, `components/geo/reader-map-immersive.tsx`, `components/geo/place-photos-list.tsx`, `components/geo/checkin-form-dialog.tsx`, `components/geo/place-review-form.tsx`, `components/geo/places-near-you.tsx`, `components/geo/place-submission-form.tsx`, `components/settings/location-section.tsx`, `next.config.ts`

**Context:** Unkeyed `PlaceContent` carries enrichment across places; mark-spot modal ignores which button opened it (Recommend saves a 2-hour check-in); presence card uses defaults and in-map marking doesn't update parent; mobile "I'm Here" sends no location; lightbox and check-in dialog are clipped by the panel's transform; Nominatim autofill blocked by CSP `connect-src`; `?place=` links ignored; check-in list and marker don't refresh; privacy-radius failure not rolled back; near-you spinner never stops if prompt ignored.

**Steps:**
1. [ ] Keys / mount-on-open for PlaceContent and MarkSpotModal
2. [ ] Presence state from submitted values; lift in-map marking to parent
3. [ ] Send geohash on mobile I'm Here
4. [ ] Portal overlays (Radix Dialog)
5. [ ] CSP `connect-src` for Nominatim; honour `?place=&lat=&lng=`
6. [ ] onSuccess refreshes; rollback; geolocation timeout

**Verify:**
- [ ] Manual map walkthrough (Playwright): switch places, recommend spot, check in, lightbox full-screen, no CSP errors
- [ ] Lint, tsc, tests pass

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 17: Accessibility + sign-out-by-prefetch

**Source:** Audit Finding > UI #20, #21, low (signout prefetch, star buttons)
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/settings/account-section.tsx`, `components/import/goodreads-import.tsx`, `components/geo/place-photo-upload.tsx`, `app/(app)/admin/import/page.tsx`, `components/clubs/set-current-book-dialog.tsx`, `components/shelves/mobile-shelf-drawer.tsx`, `components/geo/place-review-form.tsx`

**Context:** "Sign out now" is a `<Link>` to the GET `/signout` route handler — prefetch can execute it. File inputs are `display:none` → unreachable by keyboard. Two hand-rolled modals have no dialog role, Escape, or focus trap; drawer close button has no name; star rating buttons unnamed.

**Steps:**
1. [ ] Signout link → `prefetch={false}` (or plain `<a>`); confirm no other `<Link href="/signout">`
2. [ ] `sr-only` inputs + visible button/label focus styles
3. [ ] Convert both modals to Radix `Dialog`
4. [ ] aria-labels on close and star buttons

**Verify:**
- [ ] Keyboard-only: tab to each file picker and open it; Escape closes both modals
- [ ] Lint, tsc, tests pass

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 18: Migration 076 — DM indexes/triggers, place-review freeze, disabled users' feed

**Source:** Audit Finding > schema review C1, C2, C4, C7
**Priority:** 🟢 Low
**Effort:** Medium
**File(s):** `supabase/migrations/076_dm_indexes_and_triggers.sql`

**Context:** The DM conversation query can't use the LEAST/GREATEST expression index; unread queries have no index. Unread counter has no DELETE branch and `read_at` can be reset/pre-set; `created_at` backdatable. `place_reviews` UPDATE can move a review to another place leaving stale averages. Disabled users' activity feed rows stay public (066 hid their reviews/lists) — ❓ confirm intent with user.

**Steps:**
1. [ ] Indexes `(sender_id, receiver_id, created_at desc)`, partial `(receiver_id) where read_at is null`; drop unusable `dm_conversation_idx`
2. [ ] DM freeze trigger on INSERT+UPDATE; unread trigger with DELETE branch and floor; have the read-marking UPDATE decrement the counter in SQL so `markMessagesAsRead` can drop its count-then-write reconcile (it loses a message that arrives in between; see Task 10)
3. [ ] place_reviews freeze `place_id`/`user_id`
4. [ ] Feed policy for disabled users (only if user confirms)
5. [ ] Apply, `npm run types:gen`, re-run 064 §9 REVOKEs on new trigger functions

**Verify:**
- [ ] `EXPLAIN` of the conversation query uses the new index
- [ ] Send/read/delete DM → counter correct
- [ ] Advisors: no new lints
- [ ] Lint, tsc, tests pass

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 19: Final QA

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Medium
**File(s):** -

**Steps:**
1. [ ] `npm run build` (dev server stopped)
2. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`
3. [ ] `npm audit --omit=dev`; Supabase security + performance advisors
4. [ ] Playwright smoke with a throwaway account: signup, add book (search + AI), review, friend request both ways, DM, club join, map place, import small CSV, export, admin add book

**Verify (carried from Task 2):**
- [ ] As a throwaway authenticated user: INSERT friend_request `status='accepted'` → rejected; INSERT club member `role='admin'` on someone else's public club → rejected; normal join as member → OK
- [ ] PATCH `book_clubs.member_count` / `created_by` as club admin → values unchanged

**Verify (carried from Task 3):**
- [ ] On the deployed site, open an OSM bookshop on the map: Google photo renders, no CSP violation, enrich JSON has no `key=`
- [ ] ⚠️ USER ACTION: `GOOGLE_PLACES_API_KEY` rotated in Google Cloud and Vercel after the Task 3 deploy (old key was public)

**Verify (carried from Task 4):**
- [ ] On the deployed site, AI search → add a Google Books result with no page count / a year-only date → book page opens with Google's title, description and cover

**Verify (carried from Task 7):**
- [ ] After launch Task 0 fixes the Sentry DSN / ingest 403: trigger a caught route error (e.g. the cron route with KV or Resend failing) → event appears in Sentry with the `extra` context

**Verify:**
- [ ] Build, lint (0/0), typecheck, tests all pass
- [ ] No high/critical prod advisories; no new DB lints
- [ ] Smoke journey passes with no console errors

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Nonce-based CSP (drop `script-src 'unsafe-inline'`) | No XSS sink found (all JSON-LD via `safeJsonLd`); needs proxy.ts nonce plumbing and testing across every page | Post-launch hardening plan |
| Place photo moderation queue (`is_approved DEFAULT true`) + caption length | Product decision; needs admin UI. Caption length cap could go in Task 16 if trivial | Post-launch |
| Supabase "Secure password change" setting | Dashboard setting, not code; makes `changePassword`'s current-password check meaningful | Add to launch plan Task 0 |
| 52 unused indexes (performance advisor) | Pre-launch traffic is too low for "unused" to mean anything | 30 days after launch |
| Drop `books_nyt_desc_backup_2026_09` | Rollback backup from the catalog plan; user's call | Launch plan Task 5 decisions |
| Auth DB connections absolute → percentage | Only matters when upgrading instance size | When scaling |
| AI SDK v5 → v7 migration | Large, separate plan; no high advisory on the v5 line after patch bumps | Separate plan |
| `@types/node` ^20 while runtime is Node 24 | Cosmetic type drift; no bug found | Next dependency pass |
| `admin_role_changes` FK indexes | Tiny table | Never unless it grows |
| ~50 bare `logger.error(...)` calls (no error object) don't reach Sentry | Task 7 routed only `logError`/`reportError` and the rate limiter; converting every call site is a wide, low-value edit | When Sentry is live and gaps show |
| No fetch timeout in `lib/utils/external-book-search.ts` (Open Library / Google Books helpers) | Task 8 covered the AI-tool and geo fetches only; these run in admin enrichment and add-from-search, where a hang costs a slow request, not a stuck chat | Task 14 or next hardening pass |
| Floating Messages trigger keeps its old unread total after messages are read inside the open panel (it refreshes on the next open) | Behaviour predates Task 10; the fix is a refetch or a decrement when a chat is marked read | Task 13 or post-launch |
| Goodreads title match misses differing series suffixes ("All the Pretty Horses (The Border Trilogy, #1)" vs catalog "… (Border Trilogy)") and titles that start with punctuation ("'Salem's Lot") | Same behaviour as before Task 9; fixing it means stripping series parentheses before comparing, which is a matching-policy change | If users report misses |

---

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Typecheck + tests pass
- [ ] Migrations 074/075/076 applied and types regenerated
- [ ] Places API key rotated (user)
- [ ] Feature works as expected (smoke test)
- [ ] No console errors

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-24 | 0 | ✅ Complete | Audit: 5 reviews + advisors + live DB checks; ~70 findings, criticals verified |
| 2026-09-24 | 1 | ✅ Complete | next/eslint-config-next 16.3.6; map-page-client router.push; not yet committed |
| 2026-09-24 | 2 | ⚠️ Code complete | Migration 074 applied, types regenerated; impersonation checks deferred to Task 19 |
| 2026-09-24 | 3 | ⚠️ Code complete | Server-side photoUri (key via header), full-input cache key, 1h CDN TTL; photo render + key rotation deferred to Task 19 |
| 2026-09-24 | 4 | ⚠️ Code complete | Add-from-search sends only the id, server re-fetches; cover fetch allow-listed per redirect hop; live AI-search add deferred to Task 19 |
| 2026-09-24 | 5 | ✅ Complete | ISBN normalised to 13 in `isbn`; blanks clear on edit; slug kept unless title changes; verified live with a throwaway admin |
| 2026-09-24 | 6 | ✅ Complete | audit 39 → 0 (dev deps included); sharp 0.35.4; ai@5 patches + undici ^6.28.1 override; Sentry config import path |
| 2026-09-24 | 7 | ⚠️ Code complete | logError → Sentry.captureException; `cleanEnv` on secrets/keys/site URL; live Sentry check blocked on DSN/ingest 403 |
| 2026-09-24 | 8 | ✅ Complete | Shared chat body schema (roles, 100-msg cap, last 20 to model, coords); abort forwarded; pins from `.output`; 8s fetch timeouts; AI fallbacks served uncached |
| 2026-09-24 | 9 | ✅ Complete | Whole-file CSV tokenizer + BOM; Unicode normalise, no empty/short containment; title candidates by prefix ilike; shelf check by matched ids; 4 MB action body; live fixture 7/7 correct |
| 2026-09-24 | 10 | ✅ Complete | One DM channel (wrapper); realtime join now carries the user JWT (root cause of no live DMs); request id returned; migration 075 lets either party delete a rejected request; recount error no longer zeroes the badge; verified live with two accounts |
| 2026-09-24 | 11 | ✅ Complete | GET unsubscribe = confirm page, POST acts; digest counts books finished this week (lifetime labelled all time); webhook on profiles is the only welcome sender, Resend idempotency key; verified live with a throwaway account |
| 2026-09-24 | 12 | ✅ Complete | Local-date challenge ranges; inclusive end date, failed only after the following UTC day; UTC card dates; month-loop overflow; en-US number format; OG card counts this year |
| 2026-09-24 | 13 | ✅ Complete | Blanks clear on review/profile edit; liked hearts shown; keys on QuickRating/BookBrowser/TrendingGrid; admin search follows URL; request-id guard in 5 searches; Load More on success; mobile shelf name; verified live with throwaway accounts |
| | | | |
