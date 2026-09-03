# OhMyReads - Phase 2 Hardening & Quality (Sep 2026)

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

## ▶ RESUME HERE (last updated 2026-09-03)

Plan created from `.claude/plans/phase2-audit-findings-2026-09-01.md` (the 7-agent audit run after the Aug 2026 hardening plan). **Tasks 1–4 are COMPLETE** (064 applied live 2026-09-01; Task 2 URL hardening `9dd193b`; Task 3 migration 065 applied live + `590b701`; Task 4 service-role catalog insert `d6c9347`). **Task 5 is COMPLETE** (2026-09-02): all 8 fixes + 33 tests. `vercel env ls` proved **production has NO `KV_REST_API_URL` / `KV_REST_API_TOKEN`** (no Redis at all), so the user chose to **park the fail-closed limiter**: `checkRateLimit()` in production now logs the missing KV once per instance and keeps counting in memory. Re-enabling fail-closed is a **tracked to-do in Out of Scope ("Provision Upstash Redis")** — the user will provision the store later. **Task 6 is COMPLETE** (2026-09-02): every admin write on books / reviews / book_submissions / reports now ends in `.select("id")` and treats zero rows as `Nothing was changed` with no audit row; `admin-enrichment.ts` uses the `requireAdmin()` client; 14 new tests. **Task 7 is COMPLETE** (2026-09-02): migration **066** applied live (disabled_at frozen for non-service roles; reviews/comments/reading_lists SELECT policies hide disabled authors except to the author and admins), `adminDisableUser`/`adminEnableUser` write `disabled_at` via the service-role client and ban/unban the auth user, the (app) layout sends disabled accounts to `/signout?reason=account_disabled`, public profile 404s + discover/search filter, admin UI on the user page and the reports queue; check script `supabase/checks/066_disable_user.check.sql` passes live. **Task 8 is COMPLETE** (2026-09-02): `/login?error=<code>` renders an allow-listed message (`lib/auth/login-errors.ts`, `role="alert"`), admin dashboard lost its two invented trends and the two 404 tool links; 9 tests. **Task 9 is COMPLETE** (2026-09-02): settings → Email card (weekly digest toggle, `updateEmailPreferences`), signed one-click unsubscribe `GET|POST /api/email/unsubscribe?u=&t=` (HMAC via `EMAIL_TOKEN_SECRET` → `CRON_SECRET`), cron adds `List-Unsubscribe` headers + the link and skips disabled accounts; 21 tests. **Note: production has no `CRON_SECRET`/`EMAIL_TOKEN_SECRET`, so the unsubscribe route answers 503 there until one is set (tracked in the Out of Scope env row).** **Task 10 is COMPLETE** (2026-09-02): review cards get a real overflow menu (Copy link + Report → `ReportDialog`), started-reading / check-in cards lose their dead button, all debug logs removed, `currentUserId` threaded from the community page; 7 render tests; live throwaway-route proof that the feed report path writes a `reports` row. **Task 11 is COMPLETE** (2026-09-02): migration **067** applied live (reports keep a NULL reporter, submissions keep a NULL moderator, `sync_reading_stats()` skips departed users — the trigger that silently made every deletion of an account with books or reviews fail), `changePassword` / `deleteAccount` in `lib/actions/account.ts`, Account card in settings, 20 tests, live throwaway-route proof + `067_account_deletion.check.sql` passes; **Task 24 is now migration 068**. **Task 12 is CODE COMPLETE (2026-09-03)**: privacy + terms rewritten from a code inventory (10-row processor table incl. Gemini/OpenAI/Anthropic, Mapbox, ipapi, Nominatim/Overpass, Google Books/Places, Open Library/archive.org; AI-prompt contents; geohash precision; deletion residue; no analytics), terms gained AI / moderation / location / catalog-data clauses; `prose` was a no-op (no typography plugin) so `components/legal/legal-article-class.ts` styles both pages. **Blocked only on the user reading the copy** — not legal advice. **Task 13 is COMPLETE (2026-09-03)**: `useCoverSrc` renders the first cover candidate during SSR and walks the chain on `<img>` error (Open Library URLs now carry `?default=false` so a missing cover is a 404 the optimizer relays); browser makes **0 direct Open Library / Google Books requests** (was 7 + 5 on `/`), book page HTML has 7 cover `<img>` + a preload (was 0); 461 tests / 39 files. **Task 14 is COMPLETE (2026-09-03)**: every server-side caller uses `getUser()` from `lib/supabase/server.ts`, which now memoises per request through a `WeakMap` on the `cookies()` object as well as React `cache` (the latter is a no-op in route handlers and actions); `useSignOut` replaces the deleted `useAuth` in the four layout components. Measured: `/dashboard` 2 → 2 GoTrue calls (Next already deduped the render — the audit's "11 round-trips" was wrong), `/api/messages/conversations` 4 → 2. 463 tests / 40 files. **Task 15 is COMPLETE (2026-09-03)**: 6 MB hero PNG → 166 KB `hero.webp` (served 119 KB → 53 KB at the 1440 px slot), Merriweather 900 dropped, `minimumCacheTTL` 30 days, Sentry Replay lazy-loaded from `browser.sentry-cdn.com` after idle (CSP updated; main Sentry chunk −120 KB raw, 0 `rrweb`), inert `reactComponentAnnotation` removed. Measured on production builds. **Task 16 is COMPLETE (2026-09-03)**: book row, review page and related books cached on the public client under `books`/`reviews` (React `cache` dedupes metadata + page), reviews paginated 10/page via `?page=`, `generateStaticParams` deleted, three tag-invalidation gaps closed (review likes, admin review delete, enrichment). Anonymous book render: 7 Supabase requests → 4 warm (the rest is per-request recommendations). Profile page: React `cache` + parallel viewer lookup only — shelves/stats have no cache tag (Out of Scope row). **Task 17 is COMPLETE (2026-09-03)**: community feed (one FK-joined query), hero counts, curated fallback and the recommender's 200-book pool + vibe map are `unstable_cache` on the public client; the four reader reads of `getPersonalizedRecommendations` and the three of `getHomeReadingActivity` run in parallel; trending insights come from `lib/ai/trending-insights.ts` server-side for signed-in readers through a Suspense boundary (no client fetch, anonymous visitors make 0 `/api/ai` calls). Dev-server medians: anon TTFB 0.68 → 0.46 s with 5 → 0 requests, signed-in 1.45 → 0.95 s with 18 → 13. 476 tests / 43 files. **Next: Task 18.**

**Facts every task must respect:**
- Since Task 5: `isForeignOrigin()` refuses requests with **no** Origin/Referer unless `Sec-Fetch-Site` is `same-origin`/`none` — route tests must send `"sec-fetch-site": "same-origin"` (see the `req()` helper in `__tests__/app/api/route-gates.test.ts`). Shared helpers: `safeCompare` in `lib/utils/secrets.ts` (cron/webhook/seed), `escapeCsv` in `lib/utils/csv-escape.ts`, `ALLOWED_IMAGE_HOSTS` + `isAllowedImageHost()` in `lib/config/image-hosts.ts` (feeds `next.config.ts` remotePatterns and the three OG routes).
- Vercel CLI works without a global install: `npx --yes vercel@latest env ls` (auth already stored under `%APPDATA%\com.vercel.cli`). Production env has exactly: Sentry ×4, `GOOGLE_GENERATIVE_AI_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_SITE_URL`, Supabase ×3. No KV, no Upstash, no `CRON_SECRET`, no `SUPABASE_WEBHOOK_SECRET`, no `RESEND_API_KEY` (so the digest cron and welcome webhook are inert in prod today).
- Migrations **064, 065, 066 and 067 are applied**. Next free migration number is **`068`** (Task 24). Re-run `supabase/checks/066_disable_user.check.sql` after any change to the reviews/comments/reading_lists SELECT policies or `protect_admin_columns()`; check fixtures that set `disabled_at` must carry `request.jwt.claims` = service_role or the trigger reverts them.
- Since 065, `select("*")` on `profiles` fails for anon/authenticated. Public reads use `PROFILE_PUBLIC_COLUMNS` (`lib/queries/columns.ts`); a user's own full row comes from `supabase.rpc("get_my_profile")`; other users' location/presence only via `get_nearby_readers()`. Re-run `supabase/checks/065_profiles_column_privacy.check.sql` after any change to profiles grants or those RPCs. Apply with `npx supabase db query --linked -f <file>` (no Docker; `db diff/dump` do not work). Regenerate types with `npm run types:gen` and commit `types/database.generated.ts`.
- Baseline gates on `a51eab6`: `tsc` clean, lint **0 errors / 25 warnings**, **245 tests / 18 files**, build exit 0. After Task 4: **333 tests / 22 files**. Every task must end at or above this.
- `no-console` is an **error** in `lib/**` and `app/**`; log through `logError` / `logger` from `lib/utils/log.ts`.
- **Never run `npm run build` while `next dev` is up** (poisons `.next`; fix is `rm -rf .next`).
- `requireAdmin()` returns the **session** client. Any admin write needs either a matching `is_admin` RLS policy (Task 1 added them for books/reviews/comments/place_photos/book_submissions) or `createAdminClient()`. Since Task 6, every admin `.update()` / `.delete()` ends in `.select("id")` and treats an empty result as `{ success: false, error: "Nothing was changed" }` (`logger.error`, no audit row) — keep that shape for any new admin mutation.
- Since 064, trigger-owned counters (`profiles.*_count`, `reviews.likes_count`, `reading_lists.likes_count`, `reading_stats.*`) are **silently reverted** when written through the session client (`is_api_role()` = `current_user IN ('anon','authenticated')`). Write them only via `createAdminClient()` or leave them to the triggers. Re-run `supabase/checks/064_phase2_security.check.sql` after any RLS/trigger change.
- Since Task 14: server code reads the user through `getUser()` from `lib/supabase/server.ts` only (memoised per request in Server Components, route handlers and actions; `proxy.ts` and `"use client"` files keep their own clients). Never call `supabase.auth.getUser()` on a session client in `lib/**` or `app/**` server code; Task 22's `requireUser` should wrap `getUser()`. Sign-out in client chrome is `useSignOut()` (`hooks/use-sign-out.ts`); `useAuth` no longer exists.
- Since Task 16: `/books/[slug]` reads `getBookBySlug` / `getBookReviews(bookId, page)` / `getRelatedBooks` from `unstable_cache` on the **public** client (tags `books` / `reviews`, 1 h). Any writer of `books` or `reviews` rows must `invalidateTags` accordingly (review create/update/delete/like, admin delete, enrichment, catalog inserts all do). `getBookReviews` returns `{ reviews, total }` in pages of `REVIEWS_PAGE_SIZE` (10). A missing book answers 200 + not-found UI (soft 404, pre-existing — Task 19).
- Since Task 17: homepage public reads (`getCommunityFeed`, `getHomeCounts`, `getCuratedBooks` fallback, `getCandidatePool`) are `unstable_cache` on the public client under `books` / `reviews`; `getCachedTrendingInsights` lives in `lib/ai/trending-insights.ts` (server-only) and `TrendingNowList` takes an `insights` prop — the `/api/ai/trending-insights` route has no caller left (Task 22).
- Cache tags: import `CACHE_TAGS` / `BOOK_CATALOG_TAGS` from `lib/cache/tags.ts`; Server Actions invalidate with `invalidateTags()` (wraps `updateTag`); route handlers use `revalidateTag(tag, "max")`.
- Ratings: `average_rating` / `ratings_count` = Open Library; `local_average_rating` / `local_ratings_count` = this site. Never let one write the other.
- Zod 4.1.13: `z.string().url()` accepts `javascript:`; `z.string().uuid()` accepts the nil UUID.
- Chrome MCP works but its tab is signed out and Claude may not type passwords. Logged-in checks need the user to sign in inside the MCP tab, or the throwaway-public-route trick (`app/<name>/page.tsx`, delete afterwards).
- No AI provider key and no Sentry DSN in `.env.local`.

---

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Migration 064: RPC guards, RLS freezes, admin policies, constraints, indexes | 🔴 Critical | High | [x] COMPLETE | `supabase/migrations/064_phase2_security.sql`, `supabase/checks/064_phase2_security.check.sql`, `types/database.generated.ts`, `lib/actions/messages.ts`, `lib/queries/badges.ts`, `lib/actions/books.ts`, `components/dashboard/dashboard-stats.tsx` |
| 2 | Reject `javascript:` / `data:` URLs in profile, social, cover fields | 🔴 Critical | Low | [x] COMPLETE | `lib/validation/shared.ts` (new), `lib/validation/{profile,admin,book-action,book-submission,place}.ts`, `lib/utils/sanitize.ts`, `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/admin/users/[id]/page.tsx`, `app/(app)/admin/moderation/places/page.tsx`, `components/social/social-links-display.tsx`, `components/admin/submission-moderation-actions.tsx`, `components/geo/{map-context-panel,map-detail-panel}.tsx`, `__tests__/lib/validation/profile.test.ts` (new), `__tests__/lib/utils/sanitize.test.ts` |
| 3 | Stop world-readable location / presence / admin columns on `profiles` | 🔴 Critical | Medium | [x] COMPLETE | `supabase/migrations/065_profiles_column_privacy.sql`, `supabase/checks/065_profiles_column_privacy.check.sql`, `types/database.generated.ts`, `lib/queries/{columns,users,geo}.ts`, `lib/actions/{user,location}.ts`, `app/(app)/{layout,dashboard/page,profile/page,profile/edit/page}.tsx`, `app/(public)/{layout,page,community/map/page}.tsx`, `app/api/geo/readers/{route,debug/route}.ts`, `__tests__/lib/queries/geo.test.ts`, `__tests__/app/api/geo-readers.test.ts` |
| 4 | Let non-admin users add catalog books (service-role insert path) | 🔴 Critical | Medium | [x] COMPLETE | `lib/actions/books.ts`, `__tests__/lib/actions/books.test.ts` |
| 5 | Small security fixes: KV fail-closed, OG SSRF allow-list, CSRF Sec-Fetch-Site, cron compare, comment parent, CSV formulas, geohash, browse page coerce | 🟠 High | Medium | [x] COMPLETE | `lib/utils/rate-limit.ts`, `lib/config/image-hosts.ts` (new), `next.config.ts`, `app/api/og/{book,review,stats}/route.tsx`, `lib/utils/csrf.ts`, `lib/utils/secrets.ts` (new), `app/api/{cron/weekly-digest,webhooks/supabase,seed}/route.ts`, `lib/actions/comments.ts`, `lib/utils/csv-escape.ts` (new), `app/api/export/route.ts`, `lib/actions/location.ts`, `app/api/discover/browse/route.ts`, 7 new + 4 updated test files |
| 6 | Make admin book/review/comment/submission actions actually work and fail loudly | 🟠 High | Low | [x] COMPLETE | `lib/actions/admin-books.ts`, `lib/actions/admin-reviews.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/book-submissions.ts`, `lib/actions/reports.ts`, `__tests__/lib/actions/{admin-books,admin-reviews,book-submissions}.test.ts` (new), `__tests__/lib/actions/reports.test.ts` |
| 7 | Real "disable user": column, enforcement, admin UI | 🟠 High | Medium | [x] COMPLETE | `lib/actions/admin-users.ts`, `proxy.ts`, `app/(app)/layout.tsx`, `app/(app)/admin/users/[id]/page.tsx`, RLS in `064` |
| 8 | Login error banner + admin dashboard fabricated trends and dead links | 🟡 Medium | Low | [x] COMPLETE | `app/(auth)/login/page.tsx`, `app/(app)/admin/page.tsx` |
| 9 | Email preferences: digest opt-out in settings + unsubscribe link | 🟠 High | Medium | [x] COMPLETE | `app/(app)/settings/page.tsx`, `components/settings/*`, `lib/actions/privacy.ts` or `user.ts`, `app/api/cron/weekly-digest/route.ts`, `lib/email/templates/*` |
| 10 | Activity card "More options" menu: wire Report/Share, strip debug logs | 🟢 Low | Low | [x] COMPLETE | `components/community/activity-card.tsx`, `components/community/community-feed-tabs.tsx`, `app/(public)/community/page.tsx`, `__tests__/components/community/activity-card.test.tsx` |
| 11 | Account deletion + password change in settings | 🔴 Critical | High | [x] COMPLETE | `supabase/migrations/067_account_deletion.sql`, `supabase/checks/067_account_deletion.check.sql`, `types/database.generated.ts`, `lib/validation/user.ts`, `lib/actions/account.ts`, `lib/utils/audit-log.ts`, `components/settings/account-section.tsx`, `app/(app)/settings/page.tsx`, `__tests__/lib/actions/account.test.ts` |
| 12 | Privacy policy + terms match actual data practices | 🟠 High | Low | [x] CODE COMPLETE - Verification blocked | `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`, `components/legal/legal-article-class.ts` (new) |
| 13 | Server-rendered book covers (LCP + crawlers) | 🟠 High | Medium | [x] COMPLETE | `hooks/use-cover-src.ts` (new), `components/books/cover-image.tsx`, `components/books/book-card.tsx`, `lib/utils/covers.ts`, `__tests__/lib/utils/covers.test.ts` (new), `__tests__/components/books/cover-image.test.tsx` (new) |
| 14 | Memoised auth everywhere + `useSignOut` | 🟡 Medium | Medium | [x] COMPLETE | `lib/supabase/server.ts`, 59 server files (`lib/actions/*`, `lib/queries/{clubs,friends,lists,messages}.ts`, `app/(public)/**`, `app/api/**`, `components/dashboard/*`, `components/layout/{footer,navbar}.tsx`), `hooks/use-sign-out.ts` (new), `hooks/use-auth.ts` (deleted), `components/layout/{app-top-bar,sidebar,navbar-user-menu,navbar-mobile-menu}.tsx`, `__tests__/lib/supabase/server.test.ts` (new), 9 test mocks |
| 15 | Asset hygiene: hero image, font weight, image TTL, Sentry Replay lazy, component annotation | 🟡 Medium | Low | [x] COMPLETE | `public/images/hero.webp` (new, replaces the 6 MB PNG), `components/home/home-hero.tsx`, `app/layout.tsx`, `next.config.ts`, `sentry.client.config.ts` |
| 16 | Book page + profile page: dedupe queries, parallelise, cache public reads, paginate reviews | 🟡 Medium | Medium | [x] COMPLETE | `app/(public)/books/[slug]/page.tsx`, `app/(public)/users/[username]/page.tsx`, `lib/queries/books.ts`, `lib/queries/users.ts`, `lib/actions/{reviews,admin-reviews,admin-enrichment}.ts`, `__tests__/lib/queries/books.test.ts` (new), `__tests__/lib/actions/admin-reviews.test.ts` |
| 17 | Homepage: cache anon reads, parallelise signed-in path, gate trending-insights fetch | 🟡 Medium | Medium | [x] COMPLETE | `app/(public)/page.tsx`, `lib/queries/home.ts`, `lib/queries/recommendations.ts`, `lib/ai/trending-insights.ts` (new), `app/api/ai/trending-insights/route.ts`, `components/home/{home-feed,trending-now-list}.tsx`, `__tests__/lib/queries/{home,recommendations}.test.ts` (new) |
| 18 | my-shelf counts via `head:true`, paginate grid, scope the service worker | 🟡 Medium | Medium | [ ] PENDING | `app/(app)/my-shelf/page.tsx`, `lib/queries/users.ts`, `public/sw.js`, `components/pwa/service-worker-registration.tsx` |
| 19 | SEO: canonicals, sitemap/robots, noindex hidden profiles, titles, OG rating source, logo | 🟡 Medium | Medium | [ ] PENDING | `app/(public)/{books,authors,lists,clubs}/[slug]/page.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/(public)/users/[username]/page.tsx`, `app/api/og/book/route.tsx`, `app/(public)/page.tsx`, `app/(public)/{trending,recommendations,about,discover}/page.tsx` |
| 20 | Accessibility + UX: contrast, dialog focus, skip link, reduced motion, ARIA, touch menus, chat button, rating label | 🟡 Medium | High | [ ] PENDING | `components/books/{book-card,shelf-book-card}.tsx`, `components/ui/{rating-display,input}.tsx`, `components/search/{global-search-modal,unified-search}.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/messages/chat-trigger.tsx`, `app/globals.css`, `app/layout.tsx`, `app/(auth)/{login,signup}/page.tsx` |
| 21 | Tests: eight untested modules + cache-invalidation assertions + fix weak tests | 🟠 High | High | [ ] PENDING | `__tests__/lib/actions/{books,shelves,messages,user,location,import}.test.ts`, `__tests__/app/api/{export,webhook,cron}.test.ts`, `__tests__/lib/utils/csv-parser.test.ts`, `__tests__/lib/actions/{reviews,comments}.test.ts` |
| 22 | `requireUser` helper, one `ActionResult` type, reads out of `"use server"`, dead code, `noUnusedLocals` | 🟡 Medium | High | [ ] PENDING | `lib/auth/require-user.ts` (new), `types/app.ts`, `lib/actions/*.ts`, `lib/queries/*.ts`, 6 dead components, `tsconfig.json` |
| 23 | Repo hygiene: README, CLAUDE.md commands, scripts archive, lint scoping, index keys, duplicate hook | 🟢 Low | Low | [ ] PENDING | `README.md`, `CLAUDE.md`, `scripts/`, `package.json`, `eslint.config.mjs`, `hooks/use-realtime-messages.ts`, 5 index-key components |
| 24 | Migration 068: RLS initplan rewrite, merge permissive policies, drop redundant indexes/table, search_path on 4 functions | 🟡 Medium | Medium | [ ] PENDING | `supabase/migrations/067_rls_performance.sql` |
| 25 | Final QA incl. signed-in admin + user smoke test | - | Medium | [ ] PENDING | - |

**Progress: 11/25 complete**

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

The Aug 2026 hardening plan closed 32 findings but tested admin paths only through their refusal branches. A follow-up audit (security, database, performance, UX, SEO, product, code quality) found that admin edits and deletes silently no-op because `books`, `reviews`, `comments` and `book_submissions` have no admin RLS policies; that normal users cannot add uncatalogued books at all; that three moderation RPCs are callable by anyone with the anon key; that a friend-request receiver can forge a friendship and DM anyone; that `javascript:` URLs render as live links; that precise reader locations are readable through the REST API; and that the app promises account deletion and a digest opt-out it does not provide. This plan fixes those in priority order (one migration first, then app-side security, then the broken-in-production defects, then the two legal items), then takes the performance, SEO, accessibility, test-coverage and code-quality findings, and ends with the signed-in smoke test the previous plan never got to run. Expected outcome: no known exploitable path, every admin control working and verified as an admin, the legal pages true, and measurable LCP and auth-latency wins on the homepage and book page.

---

## Task 1: Migration 064 — RPC guards, RLS freezes, admin policies, constraints, indexes

**Source:** Audit Findings > S1, S2, S5, S6, S7, B1, B2, D1, D2, D3, D4, D5, D6 (`phase2-audit-findings-2026-09-01.md`)  
**Priority:** 🔴 Critical  
**Effort:** High  
**File(s):** `supabase/migrations/064_phase2_security.sql`, `types/database.generated.ts`

**Context:** Verified live on 2026-09-01 via `pg_policies` and the Supabase security advisor. `approve_book_submission` (019:79), `approve_place_submission` and `reject_place_submission` (007:166, 224) are SECURITY DEFINER with no admin check and EXECUTE granted to `anon`; a user can publish their own submission. `friend_requests` UPDATE `WITH CHECK` (029:35-38) pins only `status`, so a receiver can rewrite `sender_id` and satisfy `are_friends()`, the sole gate on `direct_messages` INSERT. `books` has no UPDATE/DELETE policy at all; `reviews`/`comments`/`place_photos` have owner-only DELETE; `book_submissions` has no admin SELECT/UPDATE and its owner UPDATE pins `status = 'pending'` in WITH CHECK, so nothing can ever become `approved`. Owner-writable counters: `profiles` UPDATE has no WITH CHECK (followers/following/friends/unread counts), `reviews.likes_count`, `reading_lists.likes_count`, `reading_stats` (INSERT/UPDATE/DELETE), `user_badges` self-grant with free-text `badge_id`. `direct_messages` UPDATE lets the recipient rewrite `content`/`sender_id`. `handle_new_user` (044:14-17) copies signup metadata unchecked and there is no CHECK on `profiles.username`. Friendship uniqueness is directional (022:15). `update_place_photos_count` (012:69) is not SECURITY DEFINER so `photos_count` never increments. `user_checkin_stats` has no reconcile path. `on_review_created` (005:46) ignores `is_public_activity`. `book_club_reads.club_id/book_id` nullable and the member-count decrement lacks `GREATEST(0, …)`. Nine FKs lack indexes and the book review list has no `(book_id, created_at DESC)` / `(book_id, likes_count DESC)` index. Task 7 also needs `profiles.disabled_at` — add it here so there is one migration.

**Steps:**
1. [x] Write `064_phase2_security.sql` with these sections, each idempotent (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `IF NOT EXISTS`):
   - **RPC guards:** re-create `approve_book_submission`, `approve_place_submission`, `reject_place_submission` with `SET search_path = public` and an in-body guard: `IF COALESCE(auth.jwt()->>'role','') <> 'service_role' AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN RAISE EXCEPTION 'Admin privileges required' USING ERRCODE='42501'`. For `approve_book_submission` also refuse `p_moderator_id <> auth.uid()` when `auth.uid()` is not null. `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role`.
   - **Revoke direct execution** (from `PUBLIC, anon, authenticated`) on every trigger function and on `cleanup_expired_presence`, `are_friends`, `get_user_shelf_count`, `recalculate_book_rating`. Use a catalog-driven `DO` block like migration 054: every function in `public` whose return type is `trigger`, plus the named list. Keep `are_friends` callable from RLS by granting to `authenticated` only if the policy evaluation fails without it — test in step 5.
   - **friend_requests:** replace "Receivers can respond to friend requests" with `WITH CHECK (auth.uid() = receiver_id AND status IN ('accepted','rejected'))`; add BEFORE UPDATE trigger `freeze_friend_request_parties()` that sets `NEW.sender_id := OLD.sender_id; NEW.receiver_id := OLD.receiver_id` unless service_role. Add `CREATE UNIQUE INDEX friend_requests_pair_uniq ON friend_requests (LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id))` — first `SELECT` for existing duplicate pairs and resolve them (keep the earliest accepted row) inside the migration.
   - **direct_messages:** add `WITH CHECK (auth.uid() = receiver_id)` to "Users can mark messages read"; BEFORE UPDATE trigger freezing `content`, `sender_id`, `receiver_id`, `created_at` unless service_role.
   - **Counter freeze triggers:** `profiles` (`followers_count`, `following_count`, `friends_count`, `unread_messages_count`), `reviews.likes_count`, `reading_lists.likes_count`, `reading_stats` trigger-owned columns — BEFORE UPDATE, revert to OLD unless `auth.jwt()->>'role' = 'service_role'`. **Check `lib/actions/messages.ts:148` first:** it writes `unread_messages_count` through the user client; either exclude that column or move that write to `createAdminClient()` in the same task. Drop "Users can delete their own stats" on `reading_stats`. Drop "Users can receive badges" INSERT on `user_badges` (badges are awarded by `lib/queries/badges.ts` — confirm which client it uses; if session client, switch it to service role in this task).
   - **Admin policies:** `books` UPDATE + DELETE for admins; `reviews`, `comments`, `place_photos` DELETE for admins; `book_submissions` SELECT + UPDATE for admins (mirror 007:129/144). Use `(SELECT auth.uid())` and the `EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_admin)` form from 062.
   - **profiles:** `ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$') NOT VALID` then `VALIDATE` after checking live rows (query first; if any existing username violates it, lowercase/strip in the migration and record which ones in Completed Notes). Length caps on `display_name` (≤ 80) and `avatar_url`/`website` (≤ 2048). Normalise username in `handle_new_user` (lowercase, strip non `[a-z0-9_]`, fall back to `user_<8 hex>`). Add `disabled_at TIMESTAMPTZ NULL` (Task 7).
   - **Integrity:** `ALTER FUNCTION update_place_photos_count() SECURITY DEFINER SET search_path = public`; add `user_checkin_stats` block to `reconcile_counters()`; add the `is_public_activity` check to `on_review_created`; `book_club_reads.club_id/book_id SET NOT NULL` (after checking for nulls); `GREATEST(0, …)` in `update_club_member_count`.
   - **Indexes:** `reviews (book_id, created_at DESC)`, `reviews (book_id, likes_count DESC)`, and the nine unindexed FKs: `reports(resolved_by)`, `profiles(admin_granted_by)`, `book_submissions(book_id)`, `book_submissions(moderated_by)`, `place_checkins(book_id)`, `places(submitted_by)`, `place_submissions(moderator_id)`, `reading_list_books(book_id)`, `book_club_reads(book_id)`.
2. [x] Dry-run the whole file inside `BEGIN; … ROLLBACK;` with `npx supabase db query --linked` and fix any error.
3. [x] Apply for real. Run `npm run types:gen`; diff — only `disabled_at` and any new function signatures should change.
4. [x] Add tests in `__tests__/` for the friend-request forge (RLS matrix via the existing SQL-matrix pattern from task 31 of the previous plan, or a documented manual SQL check in Completed Notes) — at minimum record the `SET LOCAL ROLE authenticated` checks you ran.
5. [x] Re-run the Supabase security advisor (`get_advisors` type `security`) and confirm `anon_security_definer_function_executable` no longer lists the three approve/reject RPCs or any trigger function.

**Verify:**
- [x] In a rolled-back transaction as `authenticated` with a non-admin JWT: `SELECT approve_book_submission(<id>, <uid>)` raises 42501; UPDATE on `friend_requests` changing `sender_id` leaves `sender_id` unchanged; UPDATE `profiles SET followers_count = 999` leaves it unchanged; UPDATE `reviews SET likes_count = 999` unchanged. (checks C4, C6, C7, C8)
- [x] As an admin JWT: `UPDATE books SET title = title WHERE id = <any>` returns 1 row; `DELETE FROM reviews WHERE id = <test row>` returns 1 row; `SELECT count(*) FROM book_submissions WHERE status='pending'` equals the unfiltered count. (checks C19, C20, C21)
- [x] Security advisor: 0 anon-callable SECURITY DEFINER functions except those deliberately public (`get_top_reviewers`, `get_reader_taste_batch`, admin analytics for authenticated). — Satisfied for everything this task named (the three moderation RPCs, every trigger function, `are_friends`, `cleanup_expired_presence`, `get_user_shelf_count`, `recalculate_book_rating` are gone from the advisor). Pre-existing anon-callable SECURITY DEFINER functions outside this task's list remain and are recorded under Issues for Task 24.
- [x] `npm run typecheck`, `npm run test:run`, `npm run lint` at baseline or better. (tsc clean; 245 tests / 18 files; lint 0 errors / 25 warnings)

**Completed Notes:**
- Files modified: `supabase/migrations/064_phase2_security.sql` (new, 9 sections), `supabase/checks/064_phase2_security.check.sql` (new, reusable 28-check role matrix that always rolls back), `types/database.generated.ts` (only `book_club_reads.club_id/book_id` NOT NULL, `profiles.disabled_at`, `is_api_role`), `lib/actions/messages.ts` (`markMessagesAsRead` writes `unread_messages_count` via `createAdminClient()`), `lib/queries/badges.ts` (`checkAndUnlockBadges` upserts via `createAdminClient()`), `lib/actions/books.ts` (removed `updateReadingStats`), `components/dashboard/dashboard-stats.tsx` (init creates the `reading_stats` row only), `__tests__/lib/actions/reviews.test.ts` (dropped the stale `updateReadingStats` mock).
- Approach taken: Live inventory first (`pg_policies`, `pg_proc` grants/owners, `pg_trigger`, `pg_indexes`, offending rows). Migration is idempotent throughout. Dry run = `BEGIN;` + migration + check script in one `db query` call; the check script raises at the end so the transaction always rolls back and the report travels in the exception message (the CLI only returns the last statement's result). Applied live 2026-09-01, then re-ran the check script against the applied schema: `ALL CHECKS PASSED: C1-C3 anon; C4-C17 user A; C18 user B; C19-C23 admin; C26 handle_new_user; C24-C28 schema`. The check script simulates PostgREST with `set_config('request.jwt.claims', …)` + `SET LOCAL ROLE`, picks fixtures dynamically (an admin, non-admin A, A's non-admin friend B, unrelated non-admin C) and covers: anon cannot call the RPCs / `are_friends` / `cleanup_expired_presence` / a trigger function; non-admin cannot approve, cannot rewrite `sender_id` while accepting (and `friends_count` still increments through the trigger), cannot forge `followers_count`, `likes_count`, `books_read`, cannot self-grant a badge, delete stats, see foreign submissions, update books or delete foreign reviews, cannot set a bad username; liking still bumps `likes_count`; DM to a friend still inserts; recipient can mark read but not rewrite content (and `unread_messages_count` still decrements); admin can update books, delete reviews, see all pending, approve only as self, reject via plain update; `reconcile_counters()` reports `user_checkin_stats`; every username matches the format; `handle_new_user` turned `"Dry-Run Üser!"` into `dryrunser` (via a rolled-back `auth.users` insert); 12 indexes, `disabled_at`, NOT NULLs and the photos trigger's SECURITY DEFINER are present.
- Deviations from plan: (1) **Freeze predicate is `current_user IN ('anon','authenticated')` (`public.is_api_role()`), not `auth.jwt()->>'role' = 'service_role'`** — every counter is maintained by SECURITY DEFINER triggers/RPCs that run inside the user's request, where the JWT role is still `authenticated`; the plan's rule would have reverted every legitimate trigger update (proved by C6c/C9/C18b). The freeze trigger functions are SECURITY INVOKER on purpose. (2) Freezes also run BEFORE INSERT (counters forced to 0) so a first-time self-insert cannot seed forged values. (3) `display_name` cap is 100, not 80, to match `updateProfileSchema`. (4) `profiles` UPDATE policy also gained `WITH CHECK (auth.uid() = id)`. (5) The username CHECK was added directly (5 rows) rather than NOT VALID + VALIDATE. (6) Tests are the SQL check script, not vitest — vitest has no DB credentials and mocking RLS proves nothing. (7) `updateReadingStats` (session-client recompute called from the dashboard) was removed rather than left as a silent no-op; the 057 sync triggers own those columns. (8) `direct_messages` "Users can mark messages read" already had the WITH CHECK live; it was re-created with `(SELECT auth.uid())` anyway. (9) `are_friends` keeps EXECUTE for `authenticated` (the DM INSERT policy evaluates it as the caller — C10 fails without it); only PUBLIC/anon revoked.
- Issues encountered: Live username `fabfashion-bianca` (profile `5ea44a01-72a1-43b5-86f5-238b65160a55`) was normalised to `fabfashionbianca` — that user's profile URL changed. 0 duplicate friend-request pairs, 0 null `book_club_reads`, 0 over-long display names/URLs. `supabase_migrations.schema_migrations` still only records up to 048 (unchanged practice since 049). **Residual for Task 24 (not in this task's list):** the advisor still reports anon-callable SECURITY DEFINER `add_club_creator_as_admin` (self-checked), `increment_review_likes` / `decrement_review_likes` (recompute-only since 054), `generate_club_slug`, `get_club_visibility` / `is_club_admin` / `is_club_member` (used by RLS for anonymous club reads, so revoking anon needs a policy rewrite), `reconcile_book_local_ratings`; and `reviews` / `reading_lists` UPDATE policies have no WITH CHECK, so an owner could reassign `user_id` — add `WITH CHECK (auth.uid() = user_id)` in 065. Also for a later pass: `lib/actions/messages.ts` and `lib/queries/badges.ts` now import `createAdminClient`, so `SUPABASE_SERVICE_ROLE_KEY` must exist wherever they run (it already does for the callback route).

**Status:** [x] COMPLETE

---

## Task 2: Reject `javascript:` / `data:` URLs in profile, social, cover fields

**Source:** Audit Findings > S3  
**Priority:** 🔴 Critical  
**Effort:** Low  
**File(s):** `lib/validation/profile.ts`, every other `lib/validation/*.ts` schema with a `.url()` field, `app/(public)/users/[username]/page.tsx`, `components/social/social-links-display.tsx`, `app/(app)/admin/users/[id]/page.tsx`

**Context:** Verified with zod 4.1.13: `z.string().url()` accepts `javascript:alert(1)`, `data:text/html,…` and `vbscript:`. `website` and social `url` are rendered as raw `href` on the public profile (line 205), the social links component (line 69) and the admin user page (line 96). CSP `script-src` includes `'unsafe-inline'`, so the payload runs on the app origin for any visitor who clicks, including an admin reviewing a reported user.

**Steps:**
1. [x] Add `httpUrl = z.string().url().regex(/^https?:\/\//i, "Only http(s) URLs are allowed").max(2048)` to `lib/validation/shared.ts` (or the existing shared module — grep for one).
2. [x] Replace `.url()` on `website`, `avatarUrl`, social `url`, and any `coverUrl`/`imageUrl`/`website` in `lib/validation/{place,book-submission,list,club,*}.ts` (grep `\.url\(` across `lib/validation`).
3. [x] Add `safeHref(url: string | null): string | undefined` in `lib/utils/sanitize.ts` returning the URL only when it parses with protocol `http:`/`https:`; use it at the three render sites and any other `href={…user value…}` (grep `href={profile.` / `href={link.` / `href={place.`).
4. [x] Tests: `__tests__/lib/utils/sanitize.test.ts` — `javascript:`, `data:`, `vbscript:`, ` javascript:` (leading space), `HTTPS://x` all handled; `__tests__/lib/validation/profile.test.ts` (new) — schema rejects the same set.
5. [x] Live data: `SELECT id, website FROM profiles WHERE website !~* '^https?://' AND website <> ''` plus the same on `social_links.url`; null out offenders in a small SQL run and record the count.

**Verify:**
- [x] New tests pass; suite ≥ 245.
- [x] `grep -rn "href={" app components | grep -v "href={\`\|href=\"/"` shows no raw user URL without `safeHref`.
- [x] Typecheck + lint clean.

**Completed Notes:**
- Files modified: `lib/validation/shared.ts` (new — `httpUrl(message)` factory: `.url()` + `^https?://` regex + max 2048); `lib/validation/profile.ts` (website, avatarUrl, social `url`), `lib/validation/admin.ts` (`bookUrlSchema`), `lib/validation/book-action.ts` (import `coverUrl`), `lib/validation/book-submission.ts` (`coverUrl`), `lib/validation/place.ts` (`website` — was a bare 500-char string with **no** URL check at all); `lib/utils/sanitize.ts` (`safeHref()`); render sites: `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/admin/users/[id]/page.tsx`, `app/(app)/admin/moderation/places/page.tsx`, `components/social/social-links-display.tsx` (skips a link entirely when unsafe), `components/admin/submission-moderation-actions.tsx` (cover "open" link), `components/geo/map-context-panel.tsx` + `components/geo/map-detail-panel.tsx` (`place.website` / OSM `enrichment.website`); tests: `__tests__/lib/validation/profile.test.ts` (new, 56 cases across profile/social/place/book-submission schemas + `httpUrl`), `__tests__/lib/utils/sanitize.test.ts` (+24 `safeHref` cases).
- Approach taken: two layers — schema rejects on the way in (`httpUrl`), `safeHref()` at render drops anything whose `new URL()` protocol is not `http:`/`https:` (so leading whitespace, `JAVASCRIPT:`, `data:`, `vbscript:`, `blob:`, scheme-less `example.com` and `//host` all vanish instead of rendering). `safeHref` returns the original string unchanged when safe, so existing display code (e.g. the host-only label in `map-detail-panel`) keeps working.
- Deviations from plan: (1) `httpUrl` is a factory, not a constant, so every schema keeps its existing user-facing message ("Invalid cover URL", "Invalid website URL"). (2) Scope grew from the plan's three render sites to eight — the admin place-moderation page, the submission cover link and both geo panels also rendered user/OSM URLs as raw `href`. (3) `place.ts#website` gained real URL validation (it previously accepted any string), so a place submitted as `example.com` without a scheme is now rejected with "Invalid website URL" instead of being stored as a broken relative link. (4) `components/geo/event-card.tsx#event.url` was left alone: `book_events` has no app write path (seeded by SQL only), so it is not user-controlled. (5) `.max()` is 2048 everywhere (plan) — the two cover schemas previously allowed 2000; no live row exceeds either.
- Issues encountered: live-data scan (step 5) across `profiles.website`, `profiles.avatar_url`, `social_links.url`, `place_submissions.website`, `places.website`, `book_submissions.cover_url`, `books.cover_url` found **0** rows failing `^https?://` — no SQL write was needed. The plan's `href={` grep now shows only `admin/page.tsx:251` (a ternary between two internal routes) and `event-card.tsx` (see deviation 4). Gates: tsc clean, lint 0 errors / 25 warnings, **312 tests / 19 files** (from 245 / 18). Not committed (Task 1 work is also still uncommitted).

**Status:** [x] COMPLETE

---

## Task 3: Stop world-readable location / presence / admin columns on `profiles`

**Source:** Audit Findings > S4  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** `supabase/migrations/064_phase2_security.sql` (append a section, or `064b_profiles_columns.sql` if 064 is already applied), `lib/queries/geo.ts`, `app/api/geo/readers/route.ts`, `lib/queries/users.ts`, `lib/queries/profiles*.ts`, any `select("*")` on `profiles`

**Context:** `profiles` SELECT policy is `USING (true)` (001:27) and no later migration narrowed it. With the public anon key: `GET /rest/v1/profiles?select=username,location_geohash,location_label,location_updated_at&location_enabled=eq.true` returns every user who ever enabled location at geohash precision up to 8 (≈19×38 m), expired presence included, `discovery_visible=false` included. `is_admin=eq.true` enumerates admins. The "active presence only, truncated" rules live only in JS (`lib/queries/geo.ts:100-113`, `app/api/geo/readers/route.ts:187`). Migration 056 protected `user_books`/`reading_stats` but not this table.

**Steps:**
1. [x] Inventory: grep every `from("profiles")` select and list which of `location_geohash`, `location_label`, `location_updated_at`, `presence_type`, `presence_note`, `presence_expires_at`, `unread_messages_count`, `email_*`, `is_admin` each reads, and with which client.
2. [x] Migration: `REVOKE SELECT (location_geohash, location_label, location_updated_at, presence_note, presence_expires_at, unread_messages_count, email_digest_enabled, email_digest_frequency, email_notifications_enabled) ON profiles FROM anon, authenticated;` Keep `is_admin` readable only if the UI needs it for other users (it does not — `getIsAdmin` reads the caller's own row; use an RPC `is_current_user_admin()` or the JWT claim instead). Owner reads of their own row go through a SECURITY DEFINER `get_my_profile()` RPC or `createAdminClient()` on the server.
3. [x] Create `get_nearby_readers(p_geohash_prefix text, p_limit int)` SECURITY DEFINER `SET search_path = public` that applies the presence-expiry rule, `discovery_visible`, `location_enabled`, and truncates the returned geohash to the coarse precision the map uses; `REVOKE FROM anon` unless the public map needs it (check `app/(public)/community/map`).
4. [x] Rewrite `lib/queries/geo.ts` and `app/api/geo/readers/route.ts` to call the RPC; remove the JS-side filtering that is now enforced in SQL.
5. [x] Fix every select from step 1 that read a revoked column with the session/anon client (settings page reads the owner's own presence — route it through the owner RPC or the server admin client after `getUser()`).
6. [x] Regenerate types; add tests for the RPC visibility matrix (SQL, documented) and a route test that `/api/geo/readers` no longer returns precision > the coarse level.

**Verify:**
- [x] `curl "$SUPABASE_URL/rest/v1/profiles?select=location_geohash" -H "apikey: $ANON"` returns a 401/42501 permission error. — Verified live 2026-09-02 after the grants were re-applied: `GET /rest/v1/profiles?select=location_geohash` → HTTP 401 `42501 permission denied for table profiles`; `select=id,username` → 200; `rpc/get_my_profile` as anon → 42501; `rpc/get_nearby_readers` as anon → 200.
- [x] Settings page still shows the owner's own location/presence; community map still renders readers; admin users page still shows `is_admin`. — Owner reads proven by the SQL matrix (A2/A3: `get_my_profile()` returns the caller's geohash and a fresh presence edit) and the `getUserLocation` unit test; the map page, `/api/geo/readers`, home and a public profile return 200 as anon on a dev server against production; `is_admin` remains a granted column (C1). The signed-in browser walk-through itself is still blocked (MCP tab signed out) and is carried by Task 25's smoke test.
- [x] Typecheck, lint, tests, build at baseline. — tsc clean, lint 0 errors / 25 warnings, **325 tests / 21 files**. Build not run (dev server was up; no config or route-shape change).

**Completed Notes:**
- Files modified: `supabase/migrations/065_profiles_column_privacy.sql` (new), `supabase/checks/065_profiles_column_privacy.check.sql` (new, 19 checks: anon C1–C8, owner A1–A6, other-user B1, schema S1–S3), `types/database.generated.ts`, `lib/queries/columns.ts` (`PROFILE_PUBLIC_COLUMNS`), `lib/queries/users.ts`, `lib/queries/geo.ts`, `lib/actions/user.ts`, `lib/actions/location.ts`, `app/(app)/layout.tsx`, `app/(public)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/profile/edit/page.tsx`, `app/(public)/page.tsx`, `app/(public)/community/map/page.tsx`, `app/api/geo/readers/route.ts` (comment only), `app/api/geo/readers/debug/route.ts`, `__tests__/lib/queries/geo.test.ts` (new), `__tests__/app/api/geo-readers.test.ts` (new).
- Approach taken: column privileges rather than a view — `REVOKE SELECT ON profiles FROM anon, authenticated` then `GRANT SELECT (15 public columns)`. `select("*")` on profiles now errors for those roles, so the 11 star-selects were rewritten: public reads (`getProfileByUsername/ById`) use `PROFILE_PUBLIC_COLUMNS`; the 8 owner reads (layouts, dashboard, profile pages, `ensureUserProfile`, `getCurrentUserProfile`) call `rpc("get_my_profile")` (SECURITY DEFINER, `SETOF profiles`, anon revoked). `get_nearby_readers(p_prefixes text[], p_limit)` enforces location_enabled + `presence_type IN (temporary, recommended)` + `presence_expires_at > now()` + `discovery_visible` + `disabled_at IS NULL` in SQL, validates every prefix against `^[0-9b-hjkmnp-z]{2,8}$` (no LIKE wildcards) and caps the limit at 100; `getNearbyReaders` passes `getNeighbors()` output straight in and no longer filters in JS. Applied live with a staged rollout: migration applied → types regenerated → grants **temporarily restored** so the deployed app kept working while gates ran → grants re-applied and both check scripts re-run immediately before push.
- Deviations from plan: (1) `is_admin` stays readable: 20 RLS policies inline `profiles.is_admin` (several evaluated for anon SELECTs on user_books / reading_stats / reviews), so revoking it would have made those queries fail for everyone; the review card also shows it as a public badge. Enumeration of admins remains possible — folded into Task 24's policy rewrite (`is_admin()` helper). (2) `get_nearby_readers` takes `text[]` prefixes instead of a single prefix so the tested neighbour math stays in `lib/utils/geohash.ts`; anon keeps EXECUTE because the map is public — that is the point of moving the rules into SQL. (3) No extra geohash truncation: a check-in stores the geohash at the precision the user chose (or the place's), the pin needs it, and the route already searches at 4 chars; the RPC caps at 8. (4) Also revoked beyond the plan's list: `location_enabled`, `location_precision`, `presence_type`, `last_digest_sent_at`, `admin_granted_at/by`. (5) `getUserLocation(userId)` keeps its signature but now reads through `get_my_profile()` and returns null unless `userId` is the caller. (6) Migration number is **065**, so Task 24 becomes **066**.
- Issues encountered: the check script needed four fixtures but production has only three non-admin profiles, so fixture D (the disabled one) is any remaining profile. `getNeighbors()` returns a 5×5 block (25 cells), not 9 — the test now asserts against its output. `.env.local` stores a literal `\r\n` inside the quoted values (the app's `.trim()` absorbs it after dotenv expansion), which broke the first curl attempts. Before the grants, anon could read a live 7-character geohash from production in one request — the audit finding was real. The 064 check script read `unread_messages_count` directly as user B (C18b) and started failing with 42501 after the grants; it now reads it via `get_my_profile()` and all 28 checks pass again.

**Status:** [x] COMPLETE

---

## Task 4: Let non-admin users add catalog books

**Source:** Audit Findings > B3  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** `lib/actions/books.ts` (`importAndAddToShelf`, `insertBookWithUniqueSlug`), `lib/actions/import.ts`, `lib/supabase/admin.ts`

**Context:** Live policy on `books` is INSERT for admins only (019:28). `importAndAddToShelf` (books.ts:419-471, called from `components/ai/ai-book-search.tsx:372`) and the Goodreads import (import.ts:199, 319) insert into `books` with the session client, so any reader who is not an admin gets "Error inserting book" when the title is not already catalogued. The owner tests as admin and never saw it. Decide: (a) insert through `createAdminClient()` after Zod validation and after `getUser()` succeeds, stamping `created_by = user.id` and null ratings, or (b) an RLS policy `authenticated may INSERT with created_by = auth.uid() AND average_rating IS NULL AND ratings_count = 0 AND local_* = 0`. Prefer (a): it keeps the catalog write behind server validation and does not widen RLS.

**Steps:**
1. [x] In `insertBookWithUniqueSlug`, accept the client as a parameter as today, but have both callers pass `createAdminClient()` only for the `books` insert; every other query in those actions stays on the session client.
2. [x] Ensure the inserted row sets `created_by: user.id`, `average_rating: null`, `ratings_count: 0`, `local_average_rating: null`, `local_ratings_count: 0`, `cover_source` where known.
3. [x] Keep rate limits: `importAndAddToShelf` and `importFromGoodreads` already call `checkRateLimit` — confirm and tighten (10 catalog inserts / hour / user for AI import).
4. [x] Tests (`__tests__/lib/actions/books.test.ts`, new — also Task 21's T1): non-admin path calls the admin client for the insert, refuses unauthenticated, retries slug on 23505 up to 10 times.
5. [x] Throwaway-route or signed-in check: add a book that is not in the catalog as a non-admin user (create one with `supabase.auth.admin.createUser` in a script if needed) and confirm it lands on the shelf.

**Verify:**
- [x] A non-admin user can import an uncatalogued book via AI search and via Goodreads CSV. — AI path verified live (see notes). Goodreads CSV never creates catalog rows (it only matches existing ISBNs/titles and reports the rest as "not found"), so there is nothing to verify there; the audit's claim that `import.ts` inserts into `books` was wrong.
- [x] `books` INSERT policy unchanged (still admin-only for direct REST writes). — The live check's direct session-client insert as the non-admin returned `42501: new row violates row-level security policy for table "books"`.
- [x] Tests + gates at baseline. — tsc clean, lint 0 errors / 25 warnings, **333 tests / 22 files**.

**Completed Notes:**
- Files modified: `lib/actions/books.ts` (`importAndAddToShelf`, `insertBookWithUniqueSlug` signature + `BookInsertData`), `__tests__/lib/actions/books.test.ts` (new, 8 tests).
- Approach taken: option (a). The catalog insert inside `importAndAddToShelf` now passes `createAdminClient()` to `insertBookWithUniqueSlug` — after `getUser()`, the existing 20/min shelf limit, a new `catalog-insert:<user>` limit of 10/hour, and the Zod parse. The duplicate lookups (ISBN / Google / Open Library) and the `user_books` upsert stay on the session client. The helper's parameter is typed `SupabaseClient<Database>` so both clients fit. New rows carry `average_rating: null, ratings_count: 0, local_average_rating: null, local_ratings_count: 0`. Live proof via a throwaway dev-only route (`app/task4-check/route.ts`, deleted): it created a temporary user with `auth.admin.createUser`, signed it in server-side with `signInWithPassword`, confirmed `is_admin=false`, showed the direct insert refused with 42501, then called the action — which created `books/task4-check-book-8a6b8a` (ratings null/0/null/0) and the `want_to_read` shelf row, verified by SQL. All three rows and the auth user were then deleted by SQL (0 left).
- Deviations from plan: (1) `books` has no `created_by` column, so it is not stamped (adding one is a schema change; nothing reads it). (2) `cover_source` is not set — `ExternalBookData` carries no source; the existing cover pipeline infers it. (3) `import.ts` untouched: the Goodreads import does not insert into `books` (line 199 is a SELECT, 319 inserts `user_books`), so only the AI-search path needed the change. (4) `insertBookWithUniqueSlug` is not exported; the retry behaviour is covered through the action.
- Issues encountered: calling the Server Action from a Route Handler throws at `invalidateTags()` (`updateTag` is Server-Action-only), which happens *after* the insert and shelf upsert — so the harness reported "unexpected error" while the rows had been created, and its own cleanup skipped them; cleaned up by SQL. `auth.admin.deleteUser` also failed ("Database error deleting user") until the profile row was deleted first. The earlier dev server (Task 3) survived `TaskStop` and held port 3000 with a deleted `.next`; killed by PID.

**Status:** [x] COMPLETE

---

## Task 5: Small security fixes bundle

**Source:** Audit Findings > S8, S9, S10  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `lib/utils/rate-limit.ts`, `app/api/og/review/route.tsx`, `app/api/og/stats/route.tsx`, `lib/utils/csrf.ts`, `app/api/cron/weekly-digest/route.ts`, `lib/actions/comments.ts`, `app/api/export/route.ts`, `lib/actions/location.ts`, `app/api/discover/browse/route.ts`

**Context:** Eight independent low-to-medium findings, each a few lines: (1) rate limiter uses the in-memory map in production when `KV_REST_API_URL/TOKEN` are unset — fail-closed at line 181 only covers KV *errors*; (2) OG routes fetch `avatar_url`/`cover_url` server-side inside `ImageResponse` (SSRF to internal addresses); (3) `isForeignOrigin` (csrf.ts:379) allows requests with neither Origin nor Referer, so cross-site `<img src=/api/geo/…>` farms the paid geo proxies on victims' budgets; (4) cron secret compared with `!==` (line 30) while webhook/seed use `timingSafeEqual`; (5) comment reply parent not checked against `review_id` (comments.ts:559-573); (6) `escapeCsv` (export/route.ts:305-312) does not neutralise leading `= + - @ \t`; (7) `placeGeohash` written with only a max-12 check (location.ts:366, validation/location.ts:666); (8) `discover/browse` returns 500 on NaN/negative `page` (route.ts:536).

**Steps:**
1. [x] rate-limit: if `isProduction && !kvConfigured` → `logger.error` once and return `{ allowed: false }` (fail closed); add test. — **Parked** (user decision 2026-09-02, see Out of Scope "Provision Upstash Redis"): `warnedMissingKv` logs once per instance but production keeps counting in memory, because prod has no KV store and fail-closed would 429 everything. The fail-closed test is kept as `it.skip` in `rate-limit-kv.test.ts` next to the passing "counts in memory in production and reports the missing KV once" case.
2. [x] OG routes: `isAllowedImageHost(url)` against the `remotePatterns` hosts in `next.config.ts` (export the list from one module); render a placeholder when not allowed. Test both. — `lib/config/image-hosts.ts` exports `ALLOWED_IMAGE_HOSTS` (now the *source* of `remotePatterns`) and a type-predicate `isAllowedImageHost()`; applied to book, review and stats routes; 8 unit tests + 4 route tests that walk the `ImageResponse` tree for `<img src>`.
3. [x] csrf: when both headers are absent, allow only if `Sec-Fetch-Site` is `same-origin` or `none`; otherwise reject. Test the three cases. — 3 cases (same-origin/none allowed; cross-site/same-site refused; no metadata at all refused).
4. [x] cron: reuse the existing `safeCompare` helper (move it to `lib/utils/secrets.ts` if it lives in the webhook file). — moved; webhook + seed now import it too; `secrets.test.ts` (3) + `cron-weekly-digest.test.ts` (3: 503 unconfigured, 401 wrong/missing, 200 + constant-time compare on match).
5. [x] comments: add `.eq("review_id", data.reviewId)` to the parent lookup; test. — 2 tests appended to `comments.test.ts`.
6. [x] export: prefix cells starting with `= + - @ \t \r` with `'`; test with a title `=HYPERLINK(...)`. — `escapeCsv` moved to `lib/utils/csv-escape.ts` (route files cannot export helpers); 5 tests incl. the HYPERLINK title.
7. [x] location: validate with `isValidGeohash` as `updateLocationFromGeohash:123` does. — in `setPresence`, after Zod; new `location.test.ts` (4).
8. [x] browse: `z.coerce.number().int().min(1).max(500)` on `page`/`limit`; test NaN → 400. — `pagingSchema` (page ≤ 500, limit ≤ 50, defaults 1/20; absent params map to `undefined` so defaults apply); `discover-browse.test.ts` (6).
9. [x] Ask the user to confirm `KV_REST_API_URL` / `KV_REST_API_TOKEN` exist in the Vercel project (Vercel CLI is not installed; `vercel env ls` after `npm i -g vercel`, or the dashboard). Record the answer. — Checked directly with `npx --yes vercel@latest env ls` (stored CLI auth works): **NOT present, in any environment.** Full production list recorded in RESUME HERE. `.env.local` has no KV vars either (only `.env.example`).

**Verify:**
- [x] Each of the 8 items has a passing test or a documented manual check. — 33 new/updated tests across 7 new + 4 updated files, all passing.
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, **371 tests / 29 files**. `npm run build` not run (dev server on :3000, pid 26044); instead `next.config.ts` was loaded through Next's own config loader (`next/dist/server/config`) and printed the 5 remotePatterns from the shared module.
- [x] KV presence in Vercel confirmed (or the task is marked CODE COMPLETE - Verification blocked for that item only). — **KV is absent** (re-checked 2026-09-02 with `npx --yes vercel@latest env ls production`). User decided to park it: fail-closed removed, once-only error log kept, to-do recorded in Out of Scope. Gates re-run after the change: see Completed Notes.

**Completed Notes:**
- Files modified: `lib/utils/rate-limit.ts`, `lib/config/image-hosts.ts` (new), `next.config.ts`, `app/api/og/{book,review,stats}/route.tsx`, `lib/utils/csrf.ts`, `lib/utils/secrets.ts` (new), `app/api/cron/weekly-digest/route.ts`, `app/api/webhooks/supabase/route.ts`, `app/api/seed/route.ts`, `lib/actions/comments.ts`, `lib/utils/csv-escape.ts` (new), `app/api/export/route.ts`, `lib/actions/location.ts`, `app/api/discover/browse/route.ts`. Tests new: `__tests__/lib/config/image-hosts.test.ts`, `__tests__/lib/utils/{secrets,csv-escape}.test.ts`, `__tests__/lib/actions/location.test.ts`, `__tests__/app/api/{og-image-hosts,discover-browse,cron-weekly-digest}.test.ts`; updated: `__tests__/lib/utils/{csrf,rate-limit-kv}.test.ts`, `__tests__/lib/actions/comments.test.ts`, `__tests__/app/api/route-gates.test.ts` (its `req()` helper now sends `sec-fetch-site: same-origin` by default).
- Approach taken: each fix is a few lines at the site the audit named; shared code went into three tiny modules so both the app and the tests import one definition. The image allow-list is wildcard-matched by hostname label (no regex), https-only, and is a TS type predicate so `<img src>` keeps its `string` type. Live pre-check: every `cover_url`/`avatar_url` row in production is on `books.google.com`, `covers.openlibrary.org` or `lh3.googleusercontent.com`, all inside the list, so no existing share card loses its image.
- Deviations from plan: (1) the OG book route was gated too — it renders `cover_url` exactly like the other two and the plan's file list simply omitted it. (2) `limit` caps at 50 (the pre-existing cap), not 500; only `page` goes to 500. (3) Header-less requests with *no* `Sec-Fetch-Site` at all are refused (plan wording "otherwise reject"); curl/server-to-server callers of the geo/AI proxies are therefore blocked, which is the intent — nothing server-side in this repo calls those routes. (4) Step 9 was executed rather than delegated: the stored Vercel CLI auth made `npx vercel env ls` work. (5) **Item 1 parked** (user decision 2026-09-02): production has no Redis store, so the fail-closed branch was removed from `checkRateLimit()`; it now logs `logger.error` once per instance and falls back to the in-memory map, exactly as before Task 5 but no longer silent. The fail-closed test is preserved as `it.skip`. Re-enabling = restore `return { allowed: false, remaining: 0, resetIn: 60000 }` inside the `isProduction && !isKVConfigured` branch and un-skip the test — see Out of Scope "Provision Upstash Redis". Gates after the change: tsc clean, lint 0 errors / 25 warnings, 371 passed + 1 skipped tests / 29 files.
- Issues encountered: the Bash tool strips one level of backslashes inside heredocs, which corrupted a regex in `image-hosts.ts` (`\\` → `\`); rewritten as label comparison, no backslashes needed. `lib/utils/csrf.ts` and `rate-limit.ts` are CRLF files, so `perl -0pi` multi-line patterns did not match and the Edit tool was used. The first `npx supabase db query` for the host scan hung past 90 s; the Supabase MCP `execute_sql` answered instantly.

**Status:** [x] COMPLETE (item 1 fail-closed parked → Out of Scope "Provision Upstash Redis")

---

## Task 6: Make admin book/review/comment/submission actions actually work and fail loudly

**Source:** Audit Findings > B1, B2  
**Priority:** 🟠 High  
**Effort:** Low  
**File(s):** `lib/actions/admin-books.ts`, `lib/actions/admin-reviews.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/book-submissions.ts`

**Context:** Task 1 adds the missing admin policies, so these actions will start working. But `adminDeleteBook` (admin-books.ts:315) and `adminDeleteReview` (admin-reviews.ts:236) currently treat `error: null` with zero affected rows as success and write an audit row claiming the deletion — that must never be possible again. `moderateSubmission` should stop inserting into `books` by hand if it duplicates `approve_book_submission` logic — pick one path (the RPC, now guarded) and delete the other.

**Steps:**
1. [x] Every admin `.delete()` / `.update()` on `books`, `reviews`, `comments`, `book_submissions`, `place_photos`: add `.select("id")` and treat `data.length === 0` as `{ success: false, error: "Nothing was changed" }` with `logError`; write the audit row only after a non-empty result. — Done for `adminUpdateBook`, `adminDeleteBook`, `adminDeleteReview`, `moderateSubmission` (reject), `enrichSingleBookCore`, and `closeReport` in `reports.ts` (same class, not in the file list). There are **no** admin actions on `comments` or `place_photos` in `lib/actions` — only the 064 RLS policies exist for them — so nothing to change there. Logged via `logger.error(message, context)` rather than `logError` (passing `null` as the error printed `errorMessage: "null"`).
2. [x] `book-submissions.ts`: `getPendingSubmissions` / `getAllSubmissions` — confirm they now return other users' rows for an admin; `moderateSubmission` → call `approve_book_submission` RPC (guarded in Task 1) or keep the manual insert but through the same helper; remove the duplicate. — Live: `064_phase2_security.check.sql` C21 (admin sees every pending submission; fixtures are submitted by non-admin B) re-run 2026-09-02 → ALL CHECKS PASSED. `moderateSubmission` already approves **only** through the RPC — there is no manual `books` insert to remove (the audit's B2 wording was stale); a test now pins that the RPC is the sole path with `p_moderator_id = caller`.
3. [x] `admin-enrichment.ts:122` uses `createClient()` after `requireAdmin()` — switch to the client `requireAdmin()` returns. — All three call sites; `enrichSingleBookCore(supabase, book)` now takes the client as a parameter; `createClient` import removed.
4. [x] Tests: `__tests__/lib/actions/admin-books.test.ts` and `admin-reviews.test.ts` — zero-row delete returns failure and does **not** call `createAuditLog`. — 5 + 3 tests; plus `book-submissions.test.ts` (6: reject zero-row, reject ok, already-moderated, approve via RPC, RPC refusal, non-admin) and 1 new case in `reports.test.ts` (zero-row close).
5. [x] Signed-in admin check (Chrome MCP tab signed in by the user, or defer to Task 25): edit a book title, delete a test review, approve a test submission; each visibly changes. — **Deferred to Task 25 step 4** as the plan allows (Chrome MCP tab is signed out). The DB side of each is proven live by the 064 check: C19/C20 admin books UPDATE + reviews DELETE touch exactly 1 row, C22 approval via RPC works, C23 reject UPDATE touches 1 row.

**Verify:**
- [x] Tests pass; no admin action can report success on 0 rows. — Every admin `.update()`/`.delete()` in `lib/actions` (`grep -nE "\.(delete|update)\("` over `admin-*.ts`, `book-submissions.ts`, `reports.ts`) now ends in `.select("id")` + length check, except `adminToggleAdmin` (service-role write on `profiles`, pre-read guards it; Task 7 rewrites that file).
- [x] Admin submissions queue lists pending rows from other users. — 064 check C21 passed live 2026-09-02.
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, 386 passed + 1 skipped / 32 files.

**Completed Notes:**
- Files modified: `lib/actions/admin-books.ts`, `lib/actions/admin-reviews.ts`, `lib/actions/admin-enrichment.ts`, `lib/actions/book-submissions.ts`, `lib/actions/reports.ts`; tests new `__tests__/lib/actions/admin-books.test.ts`, `admin-reviews.test.ts`, `book-submissions.test.ts`; updated `__tests__/lib/actions/reports.test.ts` (update chain now ends in `.select("id")`).
- Approach taken: one pattern everywhere — `const { data: rows, error } = await ...update()/delete().eq(...).select("id")`; throw/return on `error`, then `if (!rows || rows.length === 0) { logger.error("<action> changed no rows", { id }); return { success: false, error: "Nothing was changed" } }` **before** `createAuditLog`. `adminUpdateBook` moved from `.select().single()` (which threw PGRST116 on zero rows, so it already failed, but with a generic message) to `.select()` + `updated[0]`. Enrichment sets `fieldsUpdated = []` and `error = "Nothing was changed"` so the batch counts it as failed rather than updated.
- Deviations from plan: (1) `reports.ts` `closeReport` added — same silent-no-op class, and the race it guards against (`status = 'open'`) is exactly the zero-row case. (2) `comments` / `place_photos` have no admin server actions, so step 1 has nothing to touch for them. (3) `moderateSubmission` had no duplicate manual insert; nothing removed. (4) Step 5 browser check deferred to Task 25 per the plan's own wording. (5) `book-submissions.ts` returns `{ error }` (no `success` key) — kept that file's shape rather than the `{ success: false, error }` wording.
- Issues encountered: the Bash tool could not parse a large multi-line Python heredoc (quote error), so the edit script was written to the scratchpad and run from a file. Passing `null` as the error to `logError` printed `errorMessage: "null"`; switched those six calls to `logger.error(message, context)`.

**Status:** [x] COMPLETE

---

## Task 7: Real "disable user"

**Source:** Audit Findings > B4  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `lib/actions/admin-users.ts`, `proxy.ts`, `app/(app)/layout.tsx`, `app/(app)/admin/users/[id]/page.tsx`, `components/admin/*` (per-row island), `supabase/migrations/064_*` (column added in Task 1)

**Context:** `adminDisableUser` (admin-users.ts:346-349) only writes an audit row; there is no column, no gate, and no UI caller. The reports queue from the previous plan therefore has no enforcement action. Task 1 adds `profiles.disabled_at`.

**Steps:**
1. [x] `adminDisableUser` / `adminEnableUser`: write `disabled_at` via `createAdminClient()` (like `adminToggleAdmin`), keep the self/admin guards, audit as today. Also call `supabase.auth.admin.updateUserById(id, { ban_duration: "876000h" })` on disable and `ban_duration: "none"` on enable so Supabase Auth refuses new sessions. — Done, with `.select("id")` row-count checks (Task 6 convention), an "already disabled / not disabled" guard, and `banApplied` / `banLifted` in the audit metadata. A failed ban after the column write returns `success: false` with an explicit "enable and disable again to retry" message rather than claiming a lock-out. Needed migration **066** to freeze `disabled_at` in `protect_admin_columns()`: `has_column_privilege('authenticated','profiles','disabled_at','UPDATE')` was true, so a disabled account with a live session could have cleared it through PostgREST.
2. [x] Enforcement: `app/(app)/layout.tsx` — after profile load, if `disabled_at` is set, sign out and redirect to `/login?error=account_disabled`; `proxy.ts` cannot read the column cheaply, so rely on the layout plus the auth ban. — The layout redirects to a new route handler `app/(auth)/signout/route.ts` (`GET /signout?reason=account_disabled`) which calls `auth.signOut()` and lands on `/login?error=account_disabled`: a Server Component cannot clear cookies, and redirecting straight to `/login` while still signed in would bounce back to `/dashboard` via `proxy.ts`. The check sits *outside* the layout's try/catch because `redirect()` throws and that catch would otherwise turn it into `layout_error`. The login page does not render `?error=` yet — that is Task 8.
3. [x] Content: add `AND disabled_at IS NULL` to the public SELECT policies on `reviews`, `comments`, `reading_lists` (join to profiles) **or** filter in the public queries — choose RLS if the initplan cost is acceptable (measure with `EXPLAIN`), otherwise queries. Hide disabled users from discover, search and public profile (`notFound()`). — **RLS** (migration 066): ~25 review query sites vs three policies. Policy shape: `user_id = (SELECT auth.uid()) OR NOT EXISTS (disabled author) OR EXISTS (caller is admin)`, so the author keeps their own rows and moderation still sees everything. `EXPLAIN ANALYZE` as anon on the 20-newest-reviews query: the planner turns the NOT EXISTS into one **hashed SubPlan** over `profiles WHERE disabled_at IS NOT NULL` (not a per-row lookup) and the admin check into an InitPlan that is never executed for anon; execution 0.29 ms. `getProfileByUsername` adds `.is("disabled_at", null)` → page `notFound()`; the four discover/search profile queries in `lib/queries/discover.ts` add the same filter.
4. [x] UI: Disable/Enable button with reason dialog on `admin/users/[id]`, and a "Disable author" action in the reports queue row (`app/(app)/admin/reports/*`). — New island `components/admin/user-disable-toggle.tsx` (AlertDialog + reason Textarea; hidden for admin targets) on the user detail page plus a "Disabled <date>" badge; "Disabled" badge on the users list; reports page now selects `user_id` per target, reads the authors in one `profiles` query (comments has **no FK to profiles**, so it cannot be embedded) and `ReportRowActions` gets `author` + `reasonLabel` → "Disable @user" button (note or "Reported: <reason>" becomes the audit reason) or "already disabled" text. Fixed on the way: `adminGetUser` still did `select("*")` on profiles, which the 065 column grants refuse for the authenticated role, so the admin user detail page had been 404ing since Task 3; it now reads `PROFILE_PUBLIC_COLUMNS`.
5. [x] Tests: action tests for both paths (admin client called, audit row), layout redirect test if the pattern exists in `__tests__`. — 9 cases appended to `admin-users.test.ts` (service-role write, ban duration, session client untouched, audit metadata, self/admin/already-disabled refusals, zero-row failure without ban or audit, honest ban failure, enable path). No layout test pattern exists in `__tests__` (only `app/api` and `proxy.test.ts`), so none added; the DB side is covered by the 066 check script (D1–D9).

**Verify:**
- [x] Disabling a test user: they are redirected on next navigation, cannot log in again, their reviews vanish from the book page, their profile 404s. — Database side proven live by `066_disable_user.check.sql` (ALL CHECKS PASSED 2026-09-02): D1 anon cannot see the disabled author's review/comment/list, D2 others' rows untouched, D3 profile row still readable for joins, D4 author sees own rows, D5 author cannot clear `disabled_at`, D6 another user cannot see them, D7 admin sees all, D8 admin session cannot write `disabled_at`, D9 service role can. Redirect + "cannot log in" + 404 are code paths (layout → `/signout`, `ban_duration`, `getProfileByUsername` filter) whose **browser walkthrough is deferred to Task 25 step 4** with the rest of the signed-in admin journey (Chrome MCP tab is signed out).
- [x] Enabling restores all of the above. — `adminEnableUser` clears the column and sets `ban_duration: "none"`; the policies key off the column, so nothing else is needed (unit-tested; browser check deferred as above).
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, 395 passed + 1 skipped / 32 files.

**Completed Notes:**
- Files modified: `supabase/migrations/066_disable_user.sql` (new, applied live), `supabase/checks/066_disable_user.check.sql` (new), `lib/actions/admin-users.ts`, `app/(app)/layout.tsx`, `app/(auth)/signout/route.ts` (new), `lib/queries/users.ts`, `lib/queries/discover.ts`, `components/admin/user-disable-toggle.tsx` (new), `components/admin/report-row-actions.tsx`, `app/(app)/admin/users/[id]/page.tsx`, `app/(app)/admin/users/page.tsx`, `app/(app)/admin/reports/page.tsx`, `__tests__/lib/actions/admin-users.test.ts`. No types regen: 066 changes policies and a trigger only.
- Approach taken: one source of truth (`profiles.disabled_at`, service-role-only writes) enforced in three layers — Supabase Auth ban (new sessions), the (app) layout (live sessions), RLS (content) — plus query filters where a *profile* rather than content must disappear (public page, discover, search).
- Deviations from plan: (1) migration 066 added (the plan expected 064's column to suffice); Task 24 is now **067**. (2) Redirect goes through `/signout` rather than straight to `/login` (cookie + proxy loop, see step 2). (3) `adminGetUser` `select("*")` fix — a Task 3 leftover found because this task touches that page. (4) `getProfileById` and the follows/suggestions lists are unchanged: the plan names profile, discover and search only. (5) `GET /signout` is reachable by any link (nuisance-level: it only signs the visitor out); accepted because the layout redirect must be a GET.
- Issues encountered: the check-script fixture disabled A as `postgres`, and the trigger under test reverted it (no JWT → treated as non-service role) → D1 failed on the first dry run; fixed by setting `request.jwt.claims` to service_role in the fixture. `comments` has no FK to `profiles`, so the reports page fetches authors separately.

**Status:** [x] COMPLETE

---

## Task 8: Login error banner + admin dashboard fabricated trends and dead links

**Source:** Audit Findings > B5, B6  
**Priority:** 🟡 Medium  
**Effort:** Low  
**File(s):** `app/(auth)/login/page.tsx`, `app/(app)/admin/page.tsx`

**Context:** `app/(app)/layout.tsx` redirects to `/login?error=auth_error|profile_creation_failed|layout_error` (lines 27, 56, 79) and Task 7 adds `account_disabled`, but the login page reads only `redirect` (line 73) — users see "Welcome back" after being thrown out. The admin dashboard passes hard-coded `trend={{ value: 12 }}` and `{{ value: 8 }}` (lines 272, 283) next to real counts, and links to `/admin/email` and `/admin/settings` (445-446), which do not exist.

**Steps:**
1. [x] Login: map `error` → user-facing copy (`auth_error` "Your session expired, please sign in again"; `profile_creation_failed` "We could not finish setting up your profile…"; `layout_error` "Something went wrong loading your account"; `account_disabled` "This account has been disabled. Contact support@…"); render in the existing banner with `role="alert"`; validate against an allow-list so arbitrary text cannot be injected. — `lib/auth/login-errors.ts` (`LOGIN_ERROR_MESSAGES` + `loginErrorMessage()`, `Object.hasOwn` so `constructor`/`__proto__` miss too); a fifth code `auth_failed` added because `app/(auth)/callback/route.ts:238` already sends it. The page seeds its existing `error` state from the param (lazy `useState`), so a submit clears it as before; the banner div got `role="alert"`. Kept out of the page file because Next forbids extra exports from a page.
2. [x] Admin dashboard: remove the two `trend` props (or compute from `admin_growth_daily` if that RPC already returns enough — check `lib/queries/admin-analytics.ts` first; only wire real numbers). — Removed. `admin-analytics.ts` has month-over-month for users only (`adminGetOverviewStats`, 11 count queries, used by `/admin/analytics`), nothing weekly for reviews; wiring it would add those queries to the dashboard for one number, and the analytics page already shows it. `StatCard` keeps its optional `trend` prop for that page.
3. [x] Remove the two dead tool-grid entries. — `/admin/email` and `/admin/settings` removed; the remaining eight hrefs all have a directory under `app/(app)/admin/`. The `Settings` icon import stays: the header "Settings" button links to the real `/settings`.
4. [x] Test: login page renders the banner for each allowed code and nothing for an unknown one. — `__tests__/app/login-page.test.tsx` (9): the map for every code + null for empty/script/prototype keys; render (happy-dom + testing-library, `next/navigation` and the browser Supabase client mocked) shows the alert for each of the 5 codes, nothing for `<script>` (and no `<script>` in the DOM), nothing without a code.

**Verify:**
- [x] `/login?error=auth_error` shows the banner; `/login?error=<script>` shows nothing. — Render test covers both (`getByRole("alert")` / `queryByRole("alert") === null`).
- [x] Admin dashboard shows no invented percentages and no 404 links. — `grep trend= app/(app)/admin/page.tsx` → none; every tool href maps to an existing `app/(app)/admin/*` directory.
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, 404 passed + 1 skipped / 33 files.

**Completed Notes:**
- Files modified: `lib/auth/login-errors.ts` (new), `app/(auth)/login/page.tsx`, `app/(app)/admin/page.tsx`, `__tests__/app/login-page.test.tsx` (new).
- Approach taken: allow-list lookup module + one-line seed of the page's existing error state; dashboard edits are deletions only.
- Deviations from plan: `auth_failed` added to the list (already emitted by the OAuth callback); trends removed rather than computed (see step 2).
- Issues encountered: none. The first component render test in the repo — `happy-dom` + `@testing-library/react` were already installed; no jest-dom matchers, so assertions use `textContent`.

**Status:** [x] COMPLETE

---

## Task 9: Email preferences — digest opt-out + unsubscribe link

**Source:** Audit Findings > B7  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `app/(app)/settings/page.tsx`, `components/settings/email-section.tsx` (new), `lib/actions/privacy.ts` (or `user.ts`), `lib/validation/*.ts`, `app/api/cron/weekly-digest/route.ts`, `lib/email/templates/*digest*`, `app/api/email/unsubscribe/route.ts` (new)

**Context:** `profiles.email_digest_enabled` defaults true (017), the cron emails everyone with it set (cron route:48-51), the features page advertises the digest, and no component reads or writes `email_digest_*` or `email_notifications_enabled`. Sending marketing-style email with no opt-out is a compliance problem and the most likely source of spam complaints.

**Steps:**
1. [x] Settings: "Email" card with toggles for weekly digest and (if kept) notifications; server action validates and updates the caller's own row (session client — after Task 3, these columns are revoked from `authenticated` SELECT, so read them via the owner RPC / admin client and write via a SECURITY DEFINER `set_email_preferences()` or the admin client after `getUser()`). — `components/settings/email-section.tsx` + `getEmailPreferences()` / `updateEmailPreferences()` in `lib/actions/privacy.ts` (`emailPreferencesSchema` in `lib/validation/privacy.ts`). Read: `rpc("get_my_profile")`. Write: **session client** — 065 revoked SELECT only, UPDATE on the email columns still flows through the owner policy, so no new RPC and no admin client; `.select("id")` + zero-row check as in Task 6. **Digest toggle only**: nothing in the codebase sends notification email (`email_notifications_enabled` has no reader), so a second switch would control nothing.
2. [x] Unsubscribe: signed token (HMAC of user id with `CRON_SECRET` or a new `EMAIL_TOKEN_SECRET`) in a `List-Unsubscribe` header and a footer link → `GET /api/email/unsubscribe?u=<id>&t=<sig>` sets `email_digest_enabled = false` via admin client, timing-safe compare, no auth required, rate-limited. — `lib/email/unsubscribe-token.ts` (HMAC-SHA256 of `unsubscribe:digest:<id>`, base64url; `EMAIL_TOKEN_SECRET` → `CRON_SECRET` fallback; verify via `safeCompare`). `app/api/email/unsubscribe/route.ts`: GET **and POST** (RFC 8058 one-click), 10/min per IP, zod on `u` (uuid) / `t` (base64url ≤128), 503 without a secret, 400 on bad signature or zero rows, service-role update, small HTML confirmation page (`noindex`, `no-store`) with a link to settings. `.env.example` documents `EMAIL_TOKEN_SECRET`.
3. [x] Cron: add the header + link to each send; skip users with `disabled_at` (Task 7). — `.is("disabled_at", null)` on the recipient query; per user `buildUnsubscribeUrl()` → `WeeklyDigestProps.unsubscribeUrl` (template footer HTML + text; the old `/settings?unsubscribe=digest` link, which nothing handled, is gone) and Resend `headers: { "List-Unsubscribe": "<url>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }`. 503 if no signing secret (cannot happen in practice: `CRON_SECRET` is checked first).
4. [x] Tests: unsubscribe route (bad sig → 400, good sig → row updated), settings action. — `__tests__/app/api/email-unsubscribe.test.ts` (9: GET ok, POST ok, CRON_SECRET fallback, wrong key, other user's token, malformed params, zero rows, no secret 503, 429), `__tests__/lib/actions/privacy.test.ts` (7), and 2 send-path cases appended to `cron-weekly-digest.test.ts` (Proxy query builder; asserts `.is("disabled_at", null)`, the exact signed URL in headers/html/text, and `EMAIL_TOKEN_SECRET` precedence).

**Verify:**
- [x] Toggle off in settings → cron query excludes the user (SQL check). — Live, rolled back 2026-09-02: with the cron's exact predicate a digest-enabled user matched 1 row; after `email_digest_enabled = false` → 0; after re-enabling + `disabled_at = now()` → 0 (5 recipients in total today).
- [x] Unsubscribe link works without login. — Route has no session dependency (no `getUser`, service-role write) and the 9 route tests run it that way. **Not exercised over HTTP**: `.env.local` and production both lack `CRON_SECRET` / `EMAIL_TOKEN_SECRET`, so the route answers 503 in both until a secret exists (same env to-do as the digest itself; added to the Out of Scope env row).
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, 422 passed + 1 skipped / 35 files.

**Completed Notes:**
- Files modified: `lib/email/unsubscribe-token.ts` (new), `app/api/email/unsubscribe/route.ts` (new), `components/settings/email-section.tsx` (new), `lib/actions/privacy.ts`, `lib/validation/privacy.ts`, `app/(app)/settings/page.tsx`, `app/api/cron/weekly-digest/route.ts`, `lib/email/templates/weekly-digest.ts`, `.env.example`; tests `__tests__/app/api/email-unsubscribe.test.ts` (new), `__tests__/lib/actions/privacy.test.ts` (new), `__tests__/app/api/cron-weekly-digest.test.ts`.
- Approach taken: one signed link, produced by the cron and consumed by an unauthenticated route, plus the same flag exposed as a settings toggle. No migration: the column, its index (017) and the owner UPDATE path already existed.
- Deviations from plan: (1) notifications toggle omitted (no sender exists). (2) Write via the session client rather than a SECURITY DEFINER RPC or the admin client — the plan's premise that the columns were unwritable was wrong; only SELECT was revoked. (3) POST handler added for RFC 8058 one-click (Gmail/Yahoo require it for bulk senders). (4) The template's legacy `/settings?unsubscribe=digest` link was replaced rather than kept alongside.
- Issues encountered: the cron send test's stand-in query builder first answered `[]` for every table, which made the `.single()` challenge lookup look like a row with no name and crash `escapeHtml`; it now answers `null` like PostgREST does for a missing single row.

**Status:** [x] COMPLETE

---

## Task 10: Activity card "More options" menu

**Source:** Audit Findings > B8  
**Priority:** 🟢 Low  
**Effort:** Low  
**File(s):** `components/community/activity-card.tsx`, `components/reports/report-dialog.tsx` (reuse)

**Context:** Three "More options" buttons (lines 88, 177, 345) render with no `onClick`; debug `console.log` at 255, 266, 282, 301. The feed is the main place readers meet strangers' content and it has no report path.

**Steps:**
1. [x] Replace the three inert buttons with the existing dropdown pattern used on review cards: "Report" (opens `ReportDialog` with the right `targetType`/`targetId`), "Copy link", and "Hide" only if a hide mechanism exists (otherwise omit). — Review card: Radix `DropdownMenu` (same classes as `review-card.tsx`) with **Copy link** (always) and **Report** (signed in, not the author, review id present) → controlled `ReportDialog targetType="review"`. No hide mechanism exists → omitted.
2. [x] Delete the four `console.log` calls. — All eight `console.log` lines in the file removed (the plan counted four sites; there were eight statements).
3. [x] Confirm every activity type maps to a reportable target; for types that do not (e.g. "started reading"), render no menu rather than a dead one. — `REPORT_TARGET_TYPES` is `review | comment | place_photo`; `started_reading` and `checkin` have no target, so their buttons were removed outright.

**Verify:**
- [x] Each activity card either has a working menu or none. — 7 render tests in `__tests__/components/community/activity-card.test.tsx`: no button on started-reading / check-in; Copy link + Report for a signed-in reader on someone else's review; Copy link writes `<origin>/books/<slug>#reviews`; Report hidden when signed out and on the reader's own review; Report opens the "Report this review" alert dialog.
- [x] Reporting from the feed creates a `reports` row (throwaway-route or signed-in check). — Throwaway dev-only `app/task10-check/route.ts` (deleted): created a temp auth user, signed it in server-side, called `submitReport({ targetType: "review", targetId, reason: "spam", details })` — exactly what the dialog sends — and read back one `reports` row `{target_type: "review", status: "open", reporter_id: <temp>}` for a real review by another user. Row, temp user and profile then deleted (SQL re-check: 0 / 0 / 0 left).
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, **429 passed + 1 skipped / 36 files** (from 422 + 1 / 35).

**Completed Notes:**
- Files modified: `components/community/activity-card.tsx`, `components/community/community-feed-tabs.tsx`, `app/(public)/community/page.tsx`, `__tests__/components/community/activity-card.test.tsx` (new).
- Approach taken: only the review card keeps an overflow button, now a real Radix dropdown mirroring `review-card.tsx`. `ActivityCard` gained an optional `currentUserId` prop, threaded from the community page through `CommunityFeedTabs`, so a reader never sees "Report" on their own review (the server refuses self-reports anyway; this just avoids a pointless dialog). Copy link reuses the card's existing `copyToClipboard` helper. The dialog is rendered outside the menu (controlled), as the review card does, because a dialog inside a Radix menu item unmounts with the menu.
- Deviations from plan: none of substance. "Hide" omitted (no mechanism). `global-activity-feed.tsx` (unused component, no importers) left untouched. Eight `console.log` statements removed rather than four.
- Issues encountered: happy-dom fires Radix's pointerdown toggle unreliably, so the test opens the menu with the Enter key; `navigator.clipboard` is getter-only in happy-dom and is stubbed with `Object.defineProperty`. `npm run build` not run (no change to config/routes; typecheck + lint + tests cover the change).

**Status:** [x] COMPLETE

---

## Task 11: Account deletion + password change

**Source:** Audit Findings > G1 (user decision 2026-09-01: include legal items in this plan)
**Priority:** 🔴 Critical
**Effort:** High
**File(s):** `app/(app)/settings/page.tsx`, `components/settings/account-section.tsx` (new), `lib/actions/account.ts` (new), `lib/validation/user.ts` (new), `lib/utils/audit-log.ts`, `supabase/migrations/067_account_deletion.sql` (new), `supabase/checks/067_account_deletion.check.sql` (new), `types/database.generated.ts`, `__tests__/lib/actions/account.test.ts` (new)

**Context:** Settings says "Account settings coming soon" (page.tsx:150-157); the privacy page §5 promises "Delete your account and data"; the audit enum `user.delete_account` exists unused. No `auth.admin.deleteUser` or `updateUser({password})` anywhere. Deletion must also honour the reports/audit trail: keep `audit_logs` and `reports` rows (anonymised), cascade the rest.

**Steps:**
1. [x] Inventory every FK to `profiles(id)` and its `ON DELETE` behaviour (SQL on `pg_constraint`); list which tables cascade, which set null, which would block. Decide per table: cascade user content (`user_books`, `reviews`, `comments`, `review_likes`, `follows`, `friend_requests`, `direct_messages`, `shelves`, `lists`, `challenges`, `goals`, `checkins`, `badges`, `social_links`, `taste`), set-null on `reports.reporter_id`/`resolved_by`, `book_submissions.moderated_by`, `places.submitted_by`, `books.created_by`, keep `audit_logs`. Add the missing `ON DELETE` clauses in a migration section if any would block. — 44 FKs to `profiles` / `auth.users` inventoried: all cascade or set NULL except **`book_submissions.moderated_by` (NO ACTION → would block)** and **`reports.reporter_id` (CASCADE → would erase moderation history)**. `books.created_by` has no FK. Migration **067** fixes both (reporter_id made nullable + SET NULL; moderated_by SET NULL). A third blocker surfaced only in the live run: the `user_books`/`reviews` delete triggers call `sync_reading_stats()`, whose upsert into `reading_stats` violated the FK to the already-deleted `auth.users` row (23503) and rolled the whole deletion back. 067 also adds a departed-user guard to that function.
2. [x] `deleteAccount(confirmation: string)` server action: `getUser()`, require the typed username to match, re-authenticate is not available server-side so require a fresh session (< 10 min `auth_time` from the JWT) or an emailed confirmation link — pick the JWT check; write `user.delete_account` audit row **before** deletion with the admin client; delete storage objects the user owns (avatar bucket if any); `supabase.auth.admin.deleteUser(user.id)` (profiles cascade from `auth.users`); sign out; redirect to `/` with a flash. — Supabase tokens carry no `auth_time`; `amr[].timestamp` (the sign-in event, unchanged by refreshes) is used via `supabase.auth.getClaims()`, limit `SESSION_FRESHNESS_SECONDS = 600`. Username match is case-insensitive after trim. Audit row (metadata: username + providers) → place-photo storage objects removed (the only bucket users own; avatars are external URLs) → `admin.auth.admin.deleteUser` → `signOut({ scope: "local" })` clears cookies; the client also signs out locally, toasts and pushes `/`.
3. [x] `changePassword(current, next)`: verify `current` with `signInWithPassword` on a throwaway client, then `supabase.auth.updateUser({ password })`; enforce the same policy as signup; only shown when the user has an `email` identity (Google-only users get "manage in Google"). — Probe session revoked with `signOut({ scope: "local" })` so the reader's own browser session is untouched; 8–72 chars; new must differ from current; `auth.password_change` audit row (new `AuditAction`).
4. [x] UI: Account card with "Change password" form and a destructive "Delete account" dialog (type username to confirm); toasts; `role="alert"` errors. — `AccountSection` replaces the "coming soon" card; a stale-session error carries a "Sign out now" link to `/signout`.
5. [x] Tests: deleteAccount refuses mismatched confirmation and stale session, calls `auth.admin.deleteUser` on success; changePassword refuses wrong current password. — 20 tests: audit → delete → sign-out ordering, case/whitespace-insensitive match, stale/missing `amr`, newest of several `amr` entries, storage removal before deletion and non-fatal storage failure, failed deletion keeps the session, rate limits; password: probe + revoke + update, wrong current, short/reused password, Google-only refusal.
6. [x] Live check with a throwaway account created via `auth.admin.createUser`: delete it end-to-end and confirm no orphan rows remain (`SELECT count(*)` across the cascading tables by the old id). — Throwaway dev route (deleted) seeded user_books, a review, follows both ways, a DM, a report filed by the user, a report against the user's review and a submission moderated by the user; signed in server-side; `changePassword` wrong → refused, right → old password fails / new works; `deleteAccount` mismatch → refused, match → success; afterwards auth user / profile / user_books / reviews / follows / DMs = 0, the filed report kept with `reporter_id NULL`, the submission kept with `moderated_by NULL`, both audit rows kept with `user_id NULL` and the id in `target_id`. All fixtures removed. The first run failed on the `reading_stats` FK (see step 1) — that is how the trigger guard was found.

**Verify:**
- [x] Deleting a test account removes `auth.users`, `profiles` and all owned content; `audit_logs` row remains; no FK error. — Live route above + `supabase/checks/067_account_deletion.check.sql` (C1–C4, rolled back) passes live.
- [x] Password change works for an email user; hidden for Google-only. — Live route (email user) + unit test for the Google-only branch (`identities` without `email` → `no_password`; the form shows the "manage in Google" copy).
- [x] Gates at baseline. — tsc clean, lint 0 errors / 25 warnings, **449 passed + 1 skipped / 37 files** (from 429 + 1 / 36). Types regenerated (`reports.reporter_id` now `string | null`; the generator also reformatted two generic helper types).

**Completed Notes:**
- Files modified: `supabase/migrations/067_account_deletion.sql` (new, applied live 2026-09-02), `supabase/checks/067_account_deletion.check.sql` (new), `types/database.generated.ts`, `lib/validation/user.ts` (new), `lib/actions/account.ts` (new), `lib/utils/audit-log.ts` (+`auth.password_change`), `components/settings/account-section.tsx` (new), `app/(app)/settings/page.tsx`, `__tests__/lib/actions/account.test.ts` (new).
- Approach taken: everything the database can do it does (cascade / SET NULL / trigger guard); the action only adds what the FK graph cannot reach (storage objects) and the guards (fresh `amr`, username match, rate limit, audit first). The settings page derives `hasPassword` from `user.identities` and reads the username with the session client; `AccountSection` is a client island like the other settings cards.
- Deviations from plan: (1) actions live in a new `lib/actions/account.ts` instead of the already-large `lib/actions/user.ts` (nothing there is reused). (2) A migration was needed after all (the plan said "possibly"); it is **067**, so **Task 24 is now 068**. (3) The JWT freshness signal is `amr[].timestamp`, not `auth_time` (Supabase does not issue one). (4) Migration 067 also patches `sync_reading_stats()` — not in the plan, found by the live check.
- Issues encountered: `auth.admin.deleteUser` returned an opaque `unexpected_failure` 500; the real error (`reading_stats_user_id_fkey` 23503) was only visible in the Supabase auth logs. Two stranded fixture users from that failed run were removed by SQL. `node --env-file` cannot read this `.env.local` (the Vercel CLI wrote a literal `\r\n` inside the quotes) — use a route on the dev server for scripts. Browser walkthrough of the new card deferred to Task 25.

**Status:** [x] COMPLETE

---

## Task 12: Privacy policy + terms match actual data practices

**Source:** Audit Findings > G2 (user decision 2026-09-01)  
**Priority:** 🟠 High  
**Effort:** Low  
**File(s):** `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`

**Context:** The privacy page lists only account/content/communications and "hosting providers". Not disclosed: location geohash + presence note, Mapbox and ipapi lookups, AI providers (Google/OpenAI/Anthropic via `lib/ai`), Sentry error reporting (incl. session replay at 1%), Resend email, Vercel KV. Terms have no AI-generated-content or location clause. This is copy, not legal advice — write it factually from the code and flag for the user's own legal review.

**Steps:**
1. [x] From `lib/ai`, `lib/services`, `sentry.*.config.ts`, `lib/email`, the geo routes and the settings toggles, list every third party, what is sent, and whether it is optional (location, AI features) or inherent (hosting, error reporting).
2. [x] Rewrite §1 (data collected: add location at chosen precision, presence note, reading activity, AI prompts built from shelves/reviews), §3 (sub-processors table: Supabase, Vercel, Sentry, Resend, Mapbox, ipapi, the AI providers), §5 (rights: point at the new deletion flow from Task 11 and the digest opt-out from Task 9), retention, and a "location and presence" section describing the truncation from Task 3.
3. [x] Terms: add AI-generated content (recommendations/blurbs may be wrong, not endorsements), user-generated content and moderation (reports, disable), location features opt-in.
4. [x] Update `lastUpdated` dates; keep heading hierarchy (one h1).

**Verify:**
- [x] Every third party in `package.json` deps that receives user data appears on the privacy page. (Supabase, Vercel incl. `@vercel/kv`/`@vercel/og`, Sentry, Resend, Mapbox, `@ai-sdk/google|openai|anthropic` — all named; plus the non-dependency hosts called by URL: ipapi.co, Nominatim/Overpass, Google Books/Places, Open Library, archive.org.)
- [x] Links to settings/deletion resolve. (Temporary `next dev -p 3011`: `/privacy` 200, `/terms` 200, one `<h1>` each, 11 table rows; `/settings` and `/profile/edit` answer 307 → `/login?redirect=…`, i.e. the routes exist and are auth-gated.)
- [x] Lint/typecheck clean.
- [ ] User has read the copy — **blocked: needs the user.** Not legal advice; flagged for their own review.

**Completed Notes:**
- Files modified: `app/(public)/privacy/page.tsx` (rewritten, 13 sections + a `PROCESSORS` table constant), `app/(public)/terms/page.tsx` (rewritten, 15 sections), `components/legal/legal-article-class.ts` (new).
- Approach taken: inventory first, copy second. Every claim was traced to code: AI routes fall through Gemini → OpenAI → Anthropic by env key (`app/api/ai/*`); curated picks send taste profile + recent titles/ratings (no name), trending insights send 140-char review excerpts with no reviewer, place search sends messages + supplied coordinates; `ipapi.co` is only hit from the reader map when no shared location exists; Mapbox tiles load in the browser (`NEXT_PUBLIC_MAPBOX_*`), so Mapbox sees the client IP; covers are probed by the browser straight from Open Library / Google Books / archive.org (`findFirstValidCoverUrl`, CSP img-src), so those hosts see the client IP too — this stays true until Task 13; Sentry replay is 1% of sessions + 100% on error with `maskAllText` / `blockAllMedia`; `audit_log` has `ip_address`/`user_agent` columns but no caller ever sets them, so the copy says IPs are not logged there; location is stored as a geohash at precision 4/5/6 (~20 km / 2.4 km / 1.2 km, the only three the UI offers; the action clamps 4–8 and check-ins keep the place's precision); reports can target only `review | comment | place_photo`; books imported from external catalogs land immediately (Task 4) while manual book/place submissions are moderated; deletion residue is exactly what 067 leaves (reports with `reporter_id` NULL, submissions with `moderated_by` NULL, audit rows). Cookies: only the Supabase session (no CSRF cookie — `lib/utils/csrf.ts` uses `Sec-Fetch-Site`/Origin), theme in `localStorage`, no analytics of any kind. Rights section links `/settings` (export, digest toggle, deletion) and `/profile/edit`. Terms gained: 13+ age line, moderation/reports/disable, AI content disclaimer, location opt-in and anti-stalking clause, third-party catalog/place data (local vs external ratings per 063), scrape/rate-limit ban, deletion permanence.
- Deviations from plan: (1) The project has **no `@tailwindcss/typography`**, so the `prose` classes both pages relied on were a no-op and headings/lists/tables rendered as plain text; added `LEGAL_ARTICLE_CLASS` (arbitrary-variant utilities) and applied it to both articles instead of adding a plugin. (2) Also disclosed hosts the plan did not list (Google Books/Places, Nominatim/Overpass, Open Library, archive.org) because the inventory found them.
- Issues encountered: the Bash heredoc write failed on the shell's quoting, so the pages were written with the Write tool. `/settings` could not be rendered signed-in (no session on the temp server); the 307 to `/login` proves the route exists, and the signed-in walkthrough belongs to Task 25 as before.

**Status:** [x] CODE COMPLETE - Verification blocked (user has not yet read the copy)

---

## Task 13: Server-rendered book covers

**Source:** Audit Findings > P1, E2 (SEO A2)  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/books/cover-image.tsx`, `components/books/book-card.tsx`, `lib/utils/covers.ts`, `app/(public)/books/[slug]/page.tsx`, `components/books/shelf-book-card.tsx`

**Context:** `CoverImage` resolves the URL in `useEffect` (cover-image.tsx:93-113), probes candidates sequentially with `new Image()` straight from Open Library (bypassing the optimizer), then mounts `<Image>` which downloads the cover again via `/_next/image`. Server HTML contains only a pulsing div, so the book page `priority` is inert, crawlers see no `<img>`, and the homepage does ~19 double downloads per visit. `resolveCoverUrl` already exists (covers.ts:88).

**Steps:**
1. [x] Compute the first candidate URL on the server — done inside the component instead of at every call site (see Deviations): `useCoverSrc(book)` picks `getCoverUrlsWithFallbacks(book)[index]` during render, so the SSR pass of the client component already emits the `<img>`.
2. [x] `CoverImage` / `CoverImageMini` / `BookCard` (three render blocks): render `<Image src={src} onError={next} onLoad={reject 1×1}>` immediately; no skeleton; placeholder only when the chain is exhausted; `priority` / `sizes` kept; `key={src}` so `next/image` resets per candidate.
3. [x] Measured on the dev server with Playwright (`performance.getEntriesByType("resource")`, `startsWith` on the host so `/_next/image?url=…openlibrary…` is not miscounted):
   - `/` — direct browser requests to `covers.openlibrary.org` / `books.google.com`: **7 + 5 before → 0 + 0 after**; `/_next/image` requests: 12 before → 12 after (the same covers, no longer downloaded twice); cover `<img>` in the **server HTML: 4 → 21**.
   - `/books/atomic-habits` — direct Open Library requests: **≥ 7 before → 0 after**; cover `<img>` in server HTML: **0 → 7**, with a `<link rel="preload" as="image" imageSrcSet=…openlibrary…>` for the `priority` cover (0 → 1). LCP element is now the cover `<img>` itself in both runs (before: the hero image on `/`; the cover on the book page only after the client probe). Dev-server LCP times (7.7 s / 10.3 s after vs 16 s / 22 s before) are compile-dominated and not comparable — recorded as element identity only.
4. [x] `remotePatterns` come from `lib/config/image-hosts.ts` (Open Library `/b/**`, Google Books, `archive.org/download/**`, `*.us.archive.org`) and CSP `img-src` lists the same hosts; the `?default=false` query is allowed (no `search` constraint). Verified the redirect chain live: `covers.openlibrary.org` → `archive.org/download/...` → `ia8028xx.us.archive.org`, 200 image/jpeg, and the optimizer returns 200 image/jpeg for it.

**Verify:**
- [x] `curl /books/atomic-habits` HTML contains 7 `<img alt="Cover of …">` (was 0) plus the preload for the hero cover.
- [x] Browser network: 0 direct Open Library / Google Books requests on `/` and on the book page after a full scroll (18 `/_next/image`, all 200, no console errors). Fallback: a broken Open Library id (`/b/id/999999999-L.jpg?default=false`) is a 404 direct and a **404 from `/_next/image`** (`"url" parameter is valid but upstream response is invalid`), so the `<img>` fires `error` and `useCoverSrc` advances — the chain itself is covered by the 7 component tests (id → isbn → Google → placeholder, 1×1 rejection, reset on book change). Without the flag the same id is a 200 with a 43-byte blank, which is why the flag is needed.
- [x] Gates: lint 0 errors (25 pre-existing warnings), `tsc` clean, **461 passed + 1 skipped / 39 files** (from 449 / 37).

**Completed Notes:**
- Files modified: `hooks/use-cover-src.ts` (new), `lib/utils/covers.ts` (`?default=false` on both Open Library templates; `validateCoverUrl` / `findFirstValidCoverUrl` removed — no remaining callers), `components/books/cover-image.tsx` (both components on the hook, skeleton gone), `components/books/book-card.tsx` (own probe replaced by the hook in all three variants), `__tests__/lib/utils/covers.test.ts` (new, 5), `__tests__/components/books/cover-image.test.tsx` (new, 7; mocks `next/image` as a bare `<img>` because the default loader rejects unconfigured hosts outside a Next runtime).
- Approach taken: the only reason the cover was client-resolved was the probe; without the probe a client component's SSR pass can pick `urls[0]` itself, so no `initialUrl` prop and no changes at the ~25 call sites. Failure detection moved from a second, un-optimised download to the events of the one `<img>` that is rendered anyway: `onError` (optimizer relays an upstream 404 as a 404) and `onLoad` for a decoded 1×1. Open Library had to be asked to 404 (`?default=false`) — by default it serves a 200 blank for a missing cover, which no error handler can see.
- Deviations from plan: (1) no `initialUrl` prop / per-call-site server computation (see above). (2) `BookCard` had its own copy of the probe and is included. (3) The `naturalWidth < 50` "tiny image" heuristic from the old probe was **wrong once images go through the optimizer** — the first live run sent every `xs`/`sm` cover (served at 48–72 px) to its Google fallback; the check is now `<= 1` px only, with a test pinning the 48 px case. (4) Books in the home community feed / activity panel carry only a Google `cover_url` (no isbn / OL id), so they render from Google Books as their first candidate — that is data, not a fallback, confirmed by reading the `book` prop off the React fiber in the page.
- Issues encountered: the dev server from Task 12 was still listening on 3011 (`taskkill` on the npx PID had left the node child alive) — reused, then killed by port. `performance` resource entries do not carry a status for failed `<img>` loads, so the fallback path was proven with curl against the optimizer instead. Server HTML line counts use `grep -o '<img'` on the streamed RSC payload, which is why the numbers are "cover `<img>` with alt", not total imgs.

**Status:** [x] COMPLETE

---

## Task 14: Memoised auth everywhere + `useSignOut`

**Source:** Audit Findings > P2, P10, Q9  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** every file calling `supabase.auth.getUser()` (62 at audit time: `proxy.ts:73`, `lib/queries/messages.ts:19,119`, `lib/queries/friends.ts:111`, `lib/actions/*`, `components/dashboard/*`), `hooks/use-auth.ts`, `components/layout/{app-top-bar,sidebar,navbar-user-menu,navbar-mobile-menu}.tsx`

**Context:** Only `getUser()` in `lib/supabase/server.ts:38` is memoised per request; 11 network round-trips to GoTrue per dashboard request, ~4 of them serial on the critical path. Browser-side, `useAuth` calls `getUser()` on mount in the top bar and sidebar just to expose `signOut`.

**Steps:**
1. [x] Replace `const { data: { user } } = await supabase.auth.getUser()` with the memoised `getUser()` import in every server-side file (actions, queries, server components, route handlers). Keep the client-side ones.
2. [x] `proxy.ts`: try `supabase.auth.getClaims()`; if the project uses symmetric JWT secrets it will still hit the network — verify with one timed request and keep whichever is faster. Record.
3. [x] `hooks/use-sign-out.ts` (new) with no effect; switch the four layout components; keep `useAuth` only where `user` is read.
4. [x] Measure: count GoTrue calls on one `/dashboard` request (log in `getUser` under `DEBUG_LOGS`) before and after. Target ≤ 2 (proxy + one memoised).

**Verify:**
- [x] `grep -rn "supabase.auth.getUser()" lib app | wc -l` ≤ 3 (server.ts, proxy, callback). → **2**: `lib/supabase/server.ts` (the memo itself) and `app/(app)/profile/edit/page.tsx` (a `"use client"` page on the browser client). `proxy.ts` is outside `lib`/`app`; the callback route never called it.
- [x] Dashboard auth call count recorded before/after: `/dashboard` **2 → 2**, `/api/messages/conversations` **4 → 2** (see notes).
- [x] Gates at baseline: tsc clean, lint 0 errors / 25 warnings, **463 passed + 1 skipped / 40 files** (was 461 / 39).

**Completed Notes:**
- Files modified: `lib/supabase/server.ts` (`getUser` gains a `WeakMap` keyed on the `cookies()` object under React `cache`); 59 server-side files switched from `supabase.auth.getUser()` to `getUser()` — every `lib/actions/*` file, `lib/queries/{clubs,friends,lists,messages}.ts`, 13 `app/(public)` pages + layout, 14 `app/api` route handlers, 5 `components/dashboard/*`, `components/layout/{footer,navbar}.tsx` — with the now-unused `const supabase = await createClient()` (25 of them) and `createClient` imports (21 files) pruned; `hooks/use-sign-out.ts` new; `hooks/use-auth.ts` deleted (its only four consumers read nothing but `signOut`); the four layout components; `__tests__/lib/supabase/server.test.ts` new (2); 9 existing test files export `getUser` from their `@/lib/supabase/server` mock.
- Approach taken: codemod (`await (supabase|authClient).auth.getUser()` → `await getUser()` + import), then ESLint's `no-unused-vars` output drove the pruning, so nothing was removed by guesswork. Measured with a temporary `globalThis.fetch` wrapper in `instrumentation.ts` that appended every `/auth/v1/*` URL to a file, a throwaway `app/zz-probe-login` route that minted a session for a throwaway user (`auth.admin.createUser` → `generateLink(magiclink)` → `verifyOtp`) into a curl cookie jar, and one warm request per page on a freshly started dev server (a hot reload silently drops the wrapper out of the fetch chain, so every number below is from a clean start). Probe user, route and wrapper all removed; `auth.users` / `profiles` residue check = 0 rows.
- Deviations from plan: (a) **The audit's premise was wrong.** Before this task `/dashboard` already made only **2** GoTrue calls (proxy + one render), not 11: Next.js request memoisation dedupes identical GET `fetch` calls inside a Server Component render, and every `supabase.auth.getUser()` in the tree sends the same request. The React-`cache` memo alone changed nothing measurable, and it does not apply at all in route handlers: `/api/messages/conversations` (handler + `getConversations()` + `getUnreadCount()`) made **4** calls before and still 4 with `cache()` only. Hence the extra `WeakMap` keyed on the per-request `cookies()` object in `getUser()`, which brings the route to **2** (proxy + one) and gives Server Actions the same guarantee; the new unit test pins one call per cookie store and none shared across stores. (b) `proxy.ts` keeps `getUser()`: `/auth/v1/.well-known/jwks.json` returns `{"keys":[]}`, i.e. the project signs with a symmetric HS256 secret, and `@supabase/auth-js` 2.86 `getClaims()` falls back to `getUser()` for any `HS*` token (GoTrueClient.js ~L2743), so it would be the same round-trip plus a JWT decode. No timed request needed. (c) `useAuth` was deleted rather than kept: no component read `user` from it. (d) The `DEBUG_LOGS` counter was not added to `getUser` — it would have missed the direct calls that were the point of the before-measurement; the fetch wrapper counted the real requests instead.
- Issues encountered: the first `vi.mock` edits used property shorthand (`getUser,`) which evaluates before the hoisted `vi.fn()` exists — every such export is now a lazy `getUser: () => getUser()`. The dev server started under the Bash tool leaves an orphaned `node` on :3000 after `TaskStop`; it has to be stopped by PID.

**Status:** [x] COMPLETE

---

## Task 15: Asset hygiene

**Source:** Audit Findings > P3, P7, P10  
**Priority:** 🟡 Medium  
**Effort:** Low  
**File(s):** `public/images/Gemini_Generated_Image_sdr5ejsdr5ejsdr5.png` → `public/images/hero.webp`, `components/home/home-hero.tsx`, `app/layout.tsx`, `next.config.ts`, `sentry.client.config.ts`

**Context:** Hero source is 6,377,135 bytes served at quality 90 with `sizes="100vw"`. Merriweather 900 is loaded but `font-black` is unused. `images.minimumCacheTTL` is the 4-hour default for immutable covers. Sentry Replay (~50-70 KB gz) is bundled eagerly at 1% sampling, and `reactComponentAnnotation` sits under the `webpack` key (may be inert under Turbopack, but if active it inflates every payload).

**Steps:**
1. [x] Re-export the hero at ≤ 2000 px wide as WebP (~200 KB) with `sharp` via a one-off script in the scratchpad; replace the PNG; `quality={75}`, `sizes="(max-width:1024px) 100vw, 70vw"`; delete the old file.
2. [x] Drop weight 900 from the Merriweather `next/font` config after `grep -rn "font-black"` confirms zero uses.
3. [x] `images.minimumCacheTTL: 2592000`.
4. [x] `Sentry.lazyLoadIntegration("replayIntegration")` after idle, or drop Replay; remove `reactComponentAnnotation` (confirm no `data-sentry-*` attributes in rendered HTML afterwards).
5. [x] Measure homepage transfer size before/after (Chrome MCP network) and record.

**Verify:**
- [x] Hero request < 300 KB at 1440 px; no 6 MB asset in `public/`. → at the 1440 px slot (`sizes` → 70vw ≈ 1008 px → optimizer `w=1080`): **118,802 → 53,164 bytes**; at `w=1920`: **295,798 → 107,920 bytes**. `public/images/` now holds only `hero.webp` (165,718 bytes, 2000×1091).
- [x] `npm run build` clean; no Sentry warnings. → exit 0 both builds; the only warning is the pre-existing Next "inferred workspace root" lockfile notice.
- [x] Gates at baseline: tsc clean, lint 0 errors / 25 warnings, 463 passed + 1 skipped / 40 files.

**Completed Notes:**
- Files modified: `public/images/Gemini_Generated_Image_sdr5ejsdr5ejsdr5.png` deleted → `public/images/hero.webp` (sharp 0.34.5, resize width 2000, WebP q80 as the *source*; the optimizer re-encodes at the delivery `quality={75}`); `components/home/home-hero.tsx` (src, quality 75, `sizes="(max-width: 1024px) 100vw, 70vw"`); `app/layout.tsx` (Merriweather weights `["400", "700"]`); `next.config.ts` (`images.minimumCacheTTL: 2592000`, `reactComponentAnnotation` block removed, `https://browser.sentry-cdn.com` added to CSP `script-src`); `sentry.client.config.ts` (eager `replayIntegration` removed; `loadReplayWhenIdle()` calls `Sentry.lazyLoadIntegration("replayIntegration")` inside `requestIdleCallback` (5 s timeout, `setTimeout` 2 s fallback) and `Sentry.addIntegration(...)` with the same mask/block options; skipped entirely when `NEXT_PUBLIC_SENTRY_DSN` is unset).
- Approach taken: built the untouched tree first (`rm -rf .next && npm run build`, `next start -p 3001`) and measured with curl + a small Node script, then applied the edits, rebuilt and measured again — so every pair below is production output, not dev. Homepage (`/`, anonymous): HTML 232,367 → 231,804 bytes; 25 script tags both times, **JS 1,885,604 → 1,765,238 bytes raw**; CSS 146,272 → 144,805. The Sentry chunk went 532,660 → 412,296 bytes raw (128,195 gz) and contains **0** `rrweb` references after (was the Replay recorder); the only `replayIntegration` string left is the lazy-load name table. `/_next/image` for the hero now answers `Cache-Control: public, max-age=2592000, must-revalidate`. Response CSP `script-src` includes `https://browser.sentry-cdn.com`. No `data-sentry-*` attribute in the HTML before or after.
- Deviations from plan: (a) Measured with curl against `next start` instead of the Chrome MCP network panel — a production build is what the number is about, and curl gives exact byte counts; the Chrome tab would also have needed a sign-in it does not have. (b) `reactComponentAnnotation` was already inert: it sat under the `webpack` key and both builds are Turbopack, and neither the dev HTML from Task 14 nor either production HTML carried a `data-sentry-*` attribute; the only `data-sentry-component` string in any chunk was the Replay recorder *reading* the attribute. Removing it is housekeeping, not a payload change. (c) Replay is lazy-loaded from Sentry's CDN (the SDK's `lazyLoadIntegration` only supports that source), hence the CSP entry; the privacy page copy (1 % sampled, masked, on error) stays true. Errors thrown before the idle callback fires are reported without a replay.
- Issues encountered: `"requestIdleCallback" in window` narrows `window` to `never` in the else branch under the DOM lib, so the guard is `typeof window.requestIdleCallback === "function"`. `next start` and `next dev` launched from the Bash tool outlive `TaskStop`; stop them by PID on the port.

**Status:** [x] COMPLETE

---

## Task 16: Book page + profile page query hygiene and caching

**Source:** Audit Findings > P4  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** `app/(public)/books/[slug]/page.tsx`, `app/(public)/users/[username]/page.tsx`, `lib/queries/books.ts`, `lib/queries/reviews.ts`, `lib/queries/users.ts`, `lib/cache/tags.ts`

**Context:** `getBookBySlug` runs twice per view (metadata + page, lines 39 and 103) and is not wrapped in React `cache()`; same for `getProfileByUsername`. The page awaits book → auth → `Promise.all` serially. `getBookReviews` fetches 50 reviews with a profile join into the RSC payload. Public reads use the cookie client so nothing is cached, though `reviews`/`books` tags are already invalidated by the review actions. `generateStaticParams` runs a DB query at build but the page calls `cookies()`, so nothing is prerendered.

**Steps:**
1. [x] Wrap `getBookBySlug`, `getProfileByUsername` in `cache()`.
2. [x] `Promise.all([getBookBySlug, getUser()])` then the dependent reads.
3. [x] Move `getBookBySlug`, `getBookReviews` (first page), `getRelatedBooks`, and the public parts of the profile page to `createPublicClient()` + `unstable_cache` tagged with `CACHE_TAGS.books` / `.reviews` (revalidate 3600); keep `getUserBookStatus`, `hasUserReviewedBook`, similar-recs per request.
4. [x] Paginate reviews: 10 per page with a `count: "exact", head: true` total and a "Load more" island or `?page=` param (canonical stays on page 1 — coordinate with Task 19).
5. [x] Delete the inert `generateStaticParams` or make the page static-with-islands — measure which is cheaper; record the decision.
6. [x] Verify invalidation: post a review on a test book → book page shows the new local rating without waiting 3600 s (the action's `invalidateTags` covers it).

**Verify:**
- [x] One `books` query per book-page render (log under `DEBUG_LOGS`). → Counted real PostgREST requests with a temporary `fetch` wrapper instead (see notes). Anonymous `/books/atomic-habits`: **before 7 requests every render (4 `books` + 3 `reviews`); after 7 cold, then 4 warm (2 `books` + 2 `reviews`)**. The three cached reads (book row, review page, related books) are gone on warm renders; the remaining 2 + 2 are `getSimilarBookRecommendations`, which the plan keeps per request.
- [x] Review pagination works; new review appears immediately. → `?page=2` renders (200, one extra `reviews` range query, no nav because no catalogue book has more than 2 local reviews yet — the range→page mapping is unit-tested). Freshness proven on a throwaway book: DB update with no invalidation → page still served the cached copy with 0 queries; `revalidateTag("books"|"reviews", "max")` → next-but-one request showed the new text (Next 16 serves the stale entry once while it refreshes); the review actions use `updateTag`, which expires immediately.
- [x] Gates at baseline: tsc clean, lint 0 errors / 25 warnings, **469 passed + 1 skipped / 41 files** (was 463 / 40).

**Completed Notes:**
- Files modified: `lib/queries/books.ts` — `getBookBySlug` = React `cache` over `unstable_cache(["book-by-slug"], tags books, 3600)` on `createPublicClient()` with `maybeSingle()`; `getBookReviews(bookId, page)` replaces the 50-row list with `REVIEWS_PAGE_SIZE = 10` pages (`range` + `count: "exact"` on the same request, tag `reviews`), returning `{ reviews, total }`; `getRelatedBooks(genres, id, limit)` cached under `books`. `lib/queries/users.ts` — `getProfileByUsername` under React `cache` (per-request only), `getUserReviews` under `unstable_cache(["user-reviews"], tags reviews + books)`. `app/(public)/books/[slug]/page.tsx` — `searchParams.page`, `Promise.all([getBookBySlug, getUser()])`, `Reviews ({total})`, newer/older link nav with `aria-label="Review pages"`, `generateStaticParams` deleted (with the `createAdminClient` + `logError` imports). `app/(public)/users/[username]/page.tsx` — `Promise.all([getUser(), getProfileByUsername()])`. Actions: `likeReview`/`unlikeReview` now `invalidateTags(reviews)` (the old comment said no cache entry showed `likes_count`; the review pages now do), `adminDeleteReview` → `invalidateTags(books, reviews)`, `enrichSingleBook` → `invalidateTags(...BOOK_CATALOG_TAGS)` — three writers that would otherwise have left the new cache stale for an hour. Tests: `__tests__/lib/queries/books.test.ts` (6: tags + revalidate per entry, public client only, slug→`maybeSingle`, page→range and exact count, page 0 / fractional → page 1, error → empty page, related-books query shape); `admin-reviews.test.ts` mock gains `updateTag`.
- Approach taken: measured with the Task 14 recipe — temporary `globalThis.fetch` wrapper in `instrumentation.ts` logging every `/rest/v1/*` and `/auth/v1/*` URL, `git stash` for the before run, fresh `next dev` per phase (a hot reload drops the wrapper). Invalidation was proven with a throwaway `app/zz-probe-cache` route that inserted a `books` row through the service role, updated its description, called `revalidateTag`, and deleted it; the row, the route and the wrapper are all removed (`git checkout instrumentation.ts`).
- Deviations from plan: (a) **Profile page reads are not cross-request cached.** Only `getUserReviews` (tag `reviews`) moved; `getProfileByUsername` is React-`cache` only. Stats, shelves and social links depend on `user_books` / `profiles` / `social_links`, which have no cache tag and are written from ~16 mutation sites (shelves ×8, books ×3, import, user, privacy, badges) — a tag-less `unstable_cache` would show a reader's own edits up to an hour late, and adding per-user tags to every writer is its own task. Recorded in Out of Scope with the design. (b) `generateStaticParams` deleted rather than static-with-islands: the page needs `cookies()` for the shelf button, review form and the viewer's own review, so a static shell would need three client islands and an API route each — a rewrite, not a Medium task; the build-time query for 100 slugs bought nothing because the route bails to dynamic. (c) `?page=` links instead of a Load-more island: crawlable, cacheable, no API route; canonical for page > 1 is left to Task 19 (rule: canonical points at the param-free URL). (d) `count: "exact"` on the page query instead of a separate `head: true` call — one request, same number. (e) No `DEBUG_LOGS` counter in the query; the fetch wrapper counts actual requests, which is what the Verify item is about.
- Issues encountered: `/books/<missing-slug>` answers **200** with the not-found UI both on the dev server and in production — pre-existing (`app/(public)/books/[slug]/loading.tsx` makes the segment stream, so the status is committed before `notFound()` throws). Noted for Task 19 (soft 404). A cached `null` for a slug is also cached for the hour; real book creation invalidates `books`, so only the probe route, which bypassed the actions, saw it. `vi.mock("next/cache")` factories that omit `updateTag` make `invalidateTags` throw inside the action's `try`, which surfaced as `success: false` in `admin-reviews.test.ts`.

**Status:** [x] COMPLETE

---

## Task 17: Homepage caching + trending-insights gate

**Source:** Audit Findings > P5, P8, Q8  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** `app/(public)/page.tsx`, `lib/queries/home.ts`, `lib/queries/recommendations.ts`, `components/home/trending-now-list.tsx`, `components/home/curated-mini-grid.tsx`

**Context:** Anonymous homepage runs the curated anon branch, `getCommunityFeed` (two sequential queries) and two `count: "exact"` scans on every hit, uncached. Signed-in: `hasEnoughSignals` → `getPersonalizedRecommendations` (4 sequential user queries, a 200-book pool, then every vibe-tag review for those 200) per view. `TrendingNowList` fetches `/api/ai/trending-insights` on mount for everyone; the route requires auth, so anonymous visitors pay a function invocation for a guaranteed 401 (same bug fixed for curated-picks in the previous plan).

**Steps:**
1. [x] `unstable_cache` + `createPublicClient()` for the anon curated list, the community feed and the two hero counts (tags `books`/`reviews`/`activity`, revalidate 600). Consider `count: "estimated"` for the hero numbers.
2. [x] Cache the user-independent 200-book candidate pool + vibe map (same mechanism, 1800 s); `Promise.all` the four user queries; `Promise.all` inside `getHomeReadingActivity`.
3. [x] Trending insights: fetch server-side in `page.tsx` via `getCachedTrendingInsights()` for signed-in users and pass as a prop; remove the client fetch. Same treatment for `curated-mini-grid.tsx:43` if it still fetches client-side.
4. [x] Measure anon and signed-in homepage TTFB before/after (5 samples each, dev server is fine for relative numbers); record.

**Verify:**
- [x] Anonymous homepage makes zero calls to `/api/ai/*`. → Chrome MCP network log for an anonymous load of `/`: 57 requests, none under `/api/`; the served HTML has no `/api/ai/` string; the dev-server log shows 0 `/api/ai` hits across every anonymous sample.
- [x] Signed-in homepage query count reduced (log under `DEBUG_LOGS`); numbers in notes. → counted with the fetch wrapper: **18 → 13** (reader with taste signals), **14 → 10** (reader without), anonymous **5 → 0** on warm renders.
- [x] Gates at baseline: tsc clean, lint 0 errors / 25 warnings, **476 passed + 1 skipped / 43 files** (was 469 / 41).

**Completed Notes:**
- Files modified: `lib/queries/home.ts` — `getCommunityFeed` is `unstable_cache(["home-community-feed"], tags reviews + books, 600)` on the public client and one query (the `profiles!reviews_user_profile_fkey` join replaces the second `profiles … in()` round-trip); new `getHomeCounts()` (`["home-counts"]`, tag `reviews`, 600) runs the two HEAD counts in parallel; `getHomeReadingActivity` issues goal / finished-count / current-shelf together (`maybeSingle`, no try/catch). `lib/queries/recommendations.ts` — `getCandidatePool()` (`["recommendation-candidate-pool"]`, tags books + reviews, 1800, public client) holds the 200-book pool and a `Record<bookId, vibeTags[]>` (a plain object so the cache can serialise it); `getPersonalizedRecommendations` starts its four reader reads and the pool in one `Promise.all`; `getCuratedFallback` (`["curated-fallback"]`, tag `books`, 600) is the anon / no-signal branch. `lib/ai/trending-insights.ts` (new, `server-only`) owns `generateTrendingInsights` + `getCachedTrendingInsights` + the `TrendingInsight` type; the route imports them. `app/(public)/page.tsx` — no more cookie client; `getHomeCounts()`; `trendingInsights` promise (signed-in only, `.catch(() => [])`) passed down un-awaited. `components/home/home-feed.tsx` — panel 3 is `<Suspense fallback={<TrendingNowList …/>}><TrendingNowWithInsights …/></Suspense>`. `components/home/trending-now-list.tsx` — plain server component with an `insights` prop; `"use client"`, `useState`, `useEffect` and the fetch are gone. Tests: `home.test.ts` (4: tags/revalidate, single-query feed with both joins + dropped rows, HEAD counts on the public client, goal/no-goal on the session client) and `recommendations.test.ts` (3: pool + fallback tags, all five reads *started* before any resolves, scoring from the cached vibe map; anon curated list only touches the public client).
- Approach taken: Task 14/16 recipe — `git stash`, fetch wrapper in `instrumentation.ts` (REST + auth + Gemini), throwaway `app/zz-probe-login` route (magic-link session; extra `signals` / `nosignals` ops upsert / delete a `user_taste_profiles` row so both signed-in branches are measured), fresh `next dev` per phase, `measure-home.sh` = 1 warm-up + 5 samples with `%{time_starttransfer}`. Probe user, route and wrapper removed; residue query = 0 rows in `auth.users`, `profiles`, `user_taste_profiles`.
- Measured (dev server, warm, median of 5): anonymous TTFB **0.68 s → 0.46 s**, requests **5 → 0** (books, 2× profiles, 2× reviews all served from cache); signed-in without signals **1.07 s → 0.91 s**, **14 → 10**; signed-in with signals **1.45 s → 0.95 s**, **18 → 13** (the pool's `books` + `reviews` reads and the feed / counts are cached, the four reader reads run together). What remains signed-in is per-reader by design: 2 auth (proxy + render), `get_my_profile` + unread-DM count from the layout, `hasEnoughSignals`, the four recommender reads, goal + finished + shelf.
- Deviations from plan: (a) `count: "estimated"` not used — it reads `pg_class.reltuples`, which for tables this size can be 0 or stale for hours; the exact HEAD counts cost nothing once cached for 10 minutes. (b) Hero counts are tagged `reviews` only (not `activity`): nothing in the feed or counts derives from `activity_feed`, and the `profiles` count has no tag at all — a new signup shows up within 10 minutes. (c) Insights stream through `Suspense` rather than being awaited in `page.tsx`: on the daily cache miss the seven Gemini calls would otherwise sit in the signed-in TTFB; with the boundary the list renders immediately and the blurbs replace it when they arrive. (d) `curated-mini-grid.tsx` keeps its client fetch: it was already gated on `isLoggedIn` (no anonymous 401 since the previous plan), and its entry is **per reader** — awaiting it server-side would put a personal LLM generation into every reader's first TTFB of the day, which the progressive fetch avoids. (e) `/api/ai/trending-insights` is kept: nothing calls it now, but it shares the cache entry so it costs nothing; it is listed for Task 22's dead-code pass.
- Issues encountered: none in code; measurement only — editing the probe route mid-run hot-reloads the server and blinds the counter, so the signed-in-with-signals baseline was taken twice (the first run's TTFB samples are valid, its counts were 0).

**Status:** [x] COMPLETE

---

## Task 18: my-shelf counts, pagination, service-worker scope

**Source:** Audit Findings > P6, P9  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** `app/(app)/my-shelf/page.tsx`, `lib/queries/users.ts` (`getUserStats`), `public/sw.js`, `components/pwa/service-worker-registration.tsx`

**Context:** `my-shelf` fetches every `user_books` row with a book join to count in JS; PostgREST caps at 1000 rows, so counts and the grid silently truncate for Goodreads importers; the custom-shelf branch is a 4-query waterfall. `getUserStats` does an unbounded `select("status")`. The service worker `cache.put`s every same-origin 200 including personalised HTML and `?_rsc=` payloads, precaches `/discover`, and never evicts; the offline fallback can serve a previous user's dashboard on a shared device. `console.log` at registration runs in production.

**Steps:**
1. [ ] Counts: three `head: true` count queries (or one `group by status` RPC) in `Promise.all`; grid paginated at 48 with a "Load more" island; custom shelf via one `user_books` select with `shelf_books!inner(shelf_id)`.
2. [ ] `getUserStats`: same count approach.
3. [ ] `sw.js`: cache only `/_next/static/**`, fonts, icons and a static `/offline` page; skip requests with `_rsc` or `Accept: text/x-component`, skip responses with `Cache-Control: private` or `no-store`; bump `CACHE_NAME`; delete old caches on activate.
4. [ ] Remove the production `console.log` (components are lint-exempt but it is still noise).
5. [ ] Create a test user with > 1000 `user_books` rows via SQL (rolled back after) or trust the count queries — document which.

**Verify:**
- [ ] Shelf counts match `SELECT status, count(*) … GROUP BY status` for a test user.
- [ ] After a deploy, DevTools > Application > Cache Storage contains no HTML/RSC entries.
- [ ] Gates at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 19: SEO fixes

**Source:** Audit Findings > E1–E6  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** `app/(public)/books/[slug]/page.tsx`, `app/(public)/authors/[slug]/page.tsx`, `app/(public)/lists/[slug]/page.tsx`, `app/(public)/clubs/[slug]/page.tsx`, `app/(public)/users/[username]/page.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/(public)/page.tsx`, `app/(public)/{trending,recommendations,about,discover}/page.tsx`, `app/api/og/book/route.tsx`, `lib/queries/authors.ts`, `app/(public)/books/page.tsx`, `components/books/book-browser.tsx`

**Context:** No `alternates.canonical` except on user profiles. Sitemap lists every profile regardless of `discovery_visible` and the profile page emits Person JSON-LD with no `noindex` for opted-out readers. `/books` ignores query params so genre links and the sitelinks-searchbox target render identical HTML. Four pages duplicate the brand in the title template. Robots disallows `/login`/`/signup` but the sitemap submits them; sitemap omits `/trending`, `/discover`, `/clubs`, `/community`, `/recommendations`, club pages and public lists; `lastModified` is `created_at` or `new Date()`. Organization `logo` points at a non-existent `/logo.png`. OG book card and author page show the Open Library rating unlabeled. `/discover` and `/recommendations` (personalised) are indexable.

**Steps:**
1. [ ] `alternates: { canonical: "/books/" + slug }` etc. on the four dynamic templates (`metadataBase` already set).
2. [ ] Sitemap: `.eq("discovery_visible", true)` on profiles; drop `/login`,`/signup`; add the missing static routes, clubs and public lists; `updated_at` for books, newest-book date for authors/lists.
3. [ ] Profile page: `robots: { index: false, follow: false }` and no Person JSON-LD when `discovery_visible === false`.
4. [ ] `/books`: read `searchParams` (`q`, `genre`, `sort`) server-side and seed `BookBrowser`; `generateMetadata` reflecting the genre; canonical to the param-free URL unless a genre is set.
5. [ ] Titles: strip the brand from page-level titles; home uses `title: { absolute: … }`.
6. [ ] Organization `logo` → an existing icon route; `og:type: "book"`; word-boundary truncation of descriptions with the text fallback for `og:description`.
7. [ ] OG book card + author page: use `local_average_rating`/`local_ratings_count` or label "on Open Library".
8. [ ] `robots: { index: false, follow: true }` on `/discover` and `/recommendations`.

**Verify:**
- [ ] `curl -s /books/<slug> | grep canonical` present on all four templates.
- [ ] Sitemap XML excludes an opted-out test profile and includes `/trending`.
- [ ] No page title contains "OhMyReads" twice.
- [ ] Gates at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 20: Accessibility + UX fixes

**Source:** Audit Findings > U1–U8  
**Priority:** 🟡 Medium  
**Effort:** High  
**File(s):** `components/books/book-card.tsx`, `components/books/shelf-book-card.tsx`, `components/ui/rating-display.tsx`, `components/ui/input.tsx`, `components/reviews/review-card.tsx`, `components/community/activity-card.tsx`, `components/search/global-search-modal.tsx`, `components/search/unified-search.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/layout/app-shell.tsx`, `components/messages/chat-trigger.tsx`, `app/globals.css`, `app/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(public)/books/[slug]/page.tsx`, `tailwind.config.ts`

**Context:** Gold rating text on cream ≈ 2.0:1 (4.5:1 required); `text-amber-600` ≈ 3.0:1. Cards show the Open Library rating with a bare star while the detail page labels both sources. Search palette is a plain div with no dialog role, focus trap or restore. Shelf card menu is `opacity-0 group-hover:opacity-100` (invisible on touch and keyboard). Chat button (`bottom-6 z-30`) sits under the mobile nav (`bottom-0 h-16 z-50`). Rating requires scrolling to the full review form. Thumbs-up "Helpful" vs heart "Like" for the same action. `RatingDisplay` stars have no text alternative; no skip link; unconditional `scroll-behavior: smooth`; search results lack combobox/listbox roles and a live region; mobile More sheet has no Escape/focus handling; auth error banners lack `role=alert`; `Input` never sets `aria-invalid`.

**Steps:**
1. [ ] Contrast: numeric rating labels → `text-foreground`/`text-muted-foreground`; darken the gold token so the star glyph ≥ 3:1; replace `text-amber-600` warnings with a passing token. Verify with a contrast calculator (record ratios).
2. [ ] Cards: show `local_average_rating` when present, otherwise the external one with a small "OL" label consistent with the detail page.
3. [ ] Search palette → Radix Dialog (already a dependency via alert-dialog? check; else add `@radix-ui/react-dialog`); `role="combobox"`/`listbox`, `aria-activedescendant`, polite live region for result count.
4. [ ] Shelf card menu: `group-focus-within:opacity-100 focus-visible:opacity-100`, always visible below `lg`, target ≥ 40 px.
5. [ ] Chat trigger: `bottom-20` below `md`, or move into the More sheet.
6. [ ] Inline five-star control next to Add to Shelf on the book page posting a rating-only review through `createReview` (already supports null text); toast + optimistic star.
7. [ ] One icon/verb for review likes across review-card and activity-card.
8. [ ] `RatingDisplay`: `role="img" aria-label="4.5 out of 5"`; skip link in `app/layout.tsx` targeting `main` (`app-shell` must render `<main id="main">`); `@media (prefers-reduced-motion: reduce)` block neutralising `scroll-behavior`, transitions, `animate-pulse`.
9. [ ] Mobile More sheet: Escape closes, focus moves in and restores, background `inert`.
10. [ ] Auth forms: `role="alert"` on banners, `aria-invalid` + `aria-describedby` from `Input`'s `error` prop.
11. [ ] Run `vercel:react-best-practices` reviewer on the touched TSX and fix what it flags.

**Verify:**
- [ ] Keyboard-only: open search, Tab stays inside, Escape closes and focus returns; shelf menu reachable; skip link works.
- [ ] Contrast ratios recorded ≥ 4.5:1 text / 3:1 graphics.
- [ ] Rating from the book page without opening the review form creates a review row.
- [ ] Gates at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 21: Test coverage for the eight highest-risk modules + cache assertions

**Source:** Audit Findings > T1–T8, weak tests  
**Priority:** 🟠 High  
**Effort:** High  
**File(s):** `__tests__/helpers/mock-supabase.ts` (new, shared), `__tests__/lib/actions/{books,shelves,messages,user,location,import}.test.ts`, `__tests__/lib/utils/csv-parser.test.ts`, `__tests__/app/api/{export,webhooks-supabase,cron-weekly-digest}.test.ts`, `__tests__/lib/actions/{reviews,comments}.test.ts`

**Context:** 23 of 27 action files, all 22 query files and 27 of 30 routes have no tests. `reviews.test.ts:126` and `comments.test.ts:85` assert only inside `if (result.error)`. Cache invalidation is mocked in every file and asserted zero times, so the bug class fixed in `a51eab6` is invisible. Each test file hand-rolls its own Supabase mock chain.

**Steps:**
1. [ ] Extract the `createMockSupabase()` builder used in the existing action tests into `__tests__/helpers/mock-supabase.ts`; migrate the four existing action tests to it (behaviour unchanged).
2. [ ] Write the eight test files per the findings document's "what to assert" column (books, shelves, export route, webhook route, cron route, messages, csv-parser + import, user/location). Node environment for routes (`// @vitest-environment node`).
3. [ ] Add `expect(invalidateTags).toHaveBeenCalledWith(...)` / `revalidatePath` assertions to every existing action success-path test.
4. [ ] Fix the two `if (result.error)` tests to assert the success path explicitly; replace `geohash.test.ts:100`'s `not.toThrow` with a value assertion.
5. [ ] Cheap pure-function tests: `jsonld.ts`, `opening-hours.ts` `isOpenNow` (cross-midnight), `discover.ts` `computeCompatibilityScore` (extract if needed), `covers.ts` builders.

**Verify:**
- [ ] `npm run test:run` ≥ 245 + new tests, all green; `npm run test:coverage` shows `lib/actions` ≥ 50 % statements (record the number).
- [ ] No test asserts nothing on its success path (grep for `if (result.error)` in `__tests__`).
- [ ] Gates at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 22: `requireUser`, one `ActionResult`, reads out of `"use server"`, dead code, `noUnusedLocals`

**Source:** Audit Findings > Q1–Q5, Q7, Q11  
**Priority:** 🟡 Medium  
**Effort:** High  
**File(s):** `lib/auth/require-user.ts` (new), `types/app.ts`, `lib/actions/*.ts` (21 files), `lib/queries/*.ts`, `components/community/global-activity-feed.tsx`, `components/home/mood-matcher.tsx`, `components/reviews/comment-section.tsx`, `components/reviews/review-list.tsx`, `components/books/book-recommendation-row.tsx`, `components/geo/event-card.tsx`, `lib/utils/covers.ts`, `lib/utils/external-book-search.ts`, `tsconfig.json`

**Context:** The `getUser()` + "Not authenticated" preamble appears 84× across 21 action files (65 literal + 9 wording variants) and the post-auth profile fetch 11×; there is no `requireUser`. Actions return five different result shapes; only `reports.ts:27` declares a type. 29 of 121 `"use server"` exports are reads (`get*`/`can*`/`check*`), each a public POST endpoint. Six components are never imported and ~30 exported functions are dead (do **not** delete `adminDisableUser`/`adminEnableUser` — Task 7 wires them). 17 `as unknown as` casts coerce Supabase joins.

**Steps:**
1. [ ] `lib/auth/require-user.ts`: `requireUser(opts?: { withProfile?: boolean })` returning `{ ok: true, supabase, user, profile? } | { ok: false, error }` mirroring `require-admin.ts`; uses the memoised `getUser()` (Task 14).
2. [ ] `types/app.ts`: `export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }`; migrate action files one at a time, updating their callers in `components/` (grep each action name); keep `{ success, error }` only where a component contract makes migration risky and note it.
3. [ ] Move the 29 read-only exports from `lib/actions` to `lib/queries` (same names), update imports.
4. [ ] Delete the 6 dead components and the dead exports listed in the findings file after re-verifying each with `grep -rn "<name>" app components lib hooks scripts __tests__` (zero hits outside its own file).
5. [ ] `tsconfig.json`: add `"noUnusedLocals": true, "noUnusedParameters": true, "noImplicitReturns": true, "noFallthroughCasesInSwitch": true`; fix what surfaces (prefix intentionally-unused params with `_`).
6. [ ] Replace the `as unknown as` casts with `.returns<T>()` where the select shape is fixed; leave and comment the two that are not Supabase joins.

**Verify:**
- [ ] `grep -rn '"Not authenticated"' lib/actions | wc -l` = 0 (all via helper).
- [ ] `grep -rn "as unknown as" lib app | wc -l` ≤ 2.
- [ ] Typecheck clean under the new flags; tests + lint + build at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 23: Repo hygiene

**Source:** Audit Findings > Q9, Q10, Q12, Q13, Q14; uncommitted `CLAUDE.md` diff  
**Priority:** 🟢 Low  
**Effort:** Low  
**File(s):** `README.md`, `CLAUDE.md`, `scripts/archive/` (new), `package.json`, `eslint.config.mjs`, `hooks/use-realtime-messages.ts`, `components/social/social-links-editor.tsx`, `components/geo/reader-map-immersive.tsx`, `components/settings/location-section.tsx`, `components/import/goodreads-import.tsx`, `components/geo/ai-place-search.tsx`

**Context:** README is create-next-app boilerplate. `CLAUDE.md` has an uncommitted edit that removed its `## Commands` block. Four one-off scripts already applied sit beside two live tools, none in `package.json`. 18 `no-img-element` warnings, 8 of them in OG routes where `<img>` is required. `use-realtime-messages.ts` has two near-identical subscribe blocks. Five real index-key bugs on mutable lists.

**Steps:**
1. [ ] README: setup (`.env.example`, Supabase link, `types:gen`), commands (`dev`, `build`, `lint`, `typecheck`, `test`, `test:run`, `test:coverage`, `types:gen`), migrations (`npx supabase db query --linked`), `proxy.ts` note, scripts table.
2. [ ] `CLAUDE.md`: restore the `## Commands` block with the full script list and commit it (confirm with the user that the removal was not intentional — it was done outside a Claude session).
3. [ ] Move `seed-books.ts`, `reseed-curated.ts`, `fix-duplicate-books.ts`, `import-award-winners.ts` to `scripts/archive/` with a README line each; add `npm run enrich-books` / `npm run import-ratings`.
4. [ ] ESLint: disable `@next/next/no-img-element` for `app/api/og/**`; fix the remaining real warnings and the 4 `alt-text` ones; target 0 warnings.
5. [ ] Collapse the duplicate realtime hook; stable keys on the five components.
6. [ ] Delete `.claude/settings.local.json.bak-doctor` if the user confirms.

**Verify:**
- [ ] `npm run lint` → 0 errors / 0 warnings (or record the residual with reasons).
- [ ] README commands all run.
- [ ] Gates at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 24: Migration 068 — RLS performance and catalog cleanup

**Source:** Audit Findings > D7, D8 (live Supabase performance advisor 2026-09-01)  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** `supabase/migrations/068_rls_performance.sql`

**Context:** Performance advisor: 91 `auth_rls_initplan` warnings (policies call `auth.uid()` without `(select …)`, re-evaluated per row — 9 on `profiles`, 6 each on `book_club_members` and `reading_challenges`, 5 each on `activity_feed`, `place_checkins`, `place_photos`, `place_reviews`), 72 `multiple_permissive_policies` (12 on `book_club_members`, 6 each on `book_submissions`, `place_photos`, `place_submissions`, `places`, 4 on `reading_stats`). Four SECURITY INVOKER functions still have a mutable `search_path` (`get_distinct_genres`, `update_club_timestamp`, `update_list_timestamp`, `generate_list_slug`). `pg_trgm` is in `public`. `books_external_id_dedupe_backup` has RLS with no policies (leftover). Five redundant indexes (006's partial uniques on `isbn`/`google_books_id`/`open_library_id` superseded by 059, `user_books_user_book_idx`, `idx_activity_feed_user_id`). 60 `unused_index` entries — most are the new 061 indexes; do not drop those yet.

**Steps:**
1. [ ] Generate the policy rewrites from the catalog: `SELECT … FROM pg_policies WHERE qual ~ 'auth\.uid\(\)' AND qual !~ 'select auth\.uid'` → emit `DROP POLICY` + `CREATE POLICY` with `(select auth.uid())` for each, preserving names, roles, `USING`/`WITH CHECK` verbatim. Review the generated SQL by eye before applying.
2. [ ] Merge permissive policies per table/command into one `OR`-ed policy where the semantics are identical; keep separate ones where an admin bypass is clearer as its own policy but combine the user-facing ones.
3. [ ] `ALTER FUNCTION … SET search_path = public` on the four; `ALTER EXTENSION pg_trgm SET SCHEMA extensions` (check `lib/queries` for any `public.similarity(` qualified call first — unqualified calls need `extensions` on the role search_path, which Supabase sets by default).
4. [ ] `DROP TABLE books_external_id_dedupe_backup` after confirming its row count matches nothing still needed (it was a task-32 safety copy); drop the five redundant indexes.
5. [ ] Apply in a rolled-back dry run, then for real; re-run both advisors; regenerate types (no change expected).

**Verify:**
- [ ] Performance advisor: 0 `auth_rls_initplan`, `multiple_permissive_policies` ≤ 10 with reasons recorded; security advisor: 0 `function_search_path_mutable`.
- [ ] The RLS visibility matrix from tasks 12/31 of the previous plan still passes (opted-out shelves hidden; admin sees all).
- [ ] Gates at baseline.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 25: Final QA incl. signed-in smoke test

**Source:** Plan > Final verification; carried over from `hi-claude-review-the-tidy-dewdrop.md` task 31 step 4  
**Priority:** -  
**Effort:** Medium  
**File(s):** -

**Steps:**
1. [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build` all green on the committed tree (stop `next dev` first).
2. [ ] Re-run both Supabase advisors; paste the counts.
3. [ ] SQL matrix in `BEGIN … ROLLBACK`: non-admin cannot call the approve RPCs, cannot forge `sender_id`, cannot write counters, cannot read `location_geohash`; admin can update/delete books and reviews; opted-out shelves still hidden.
4. [ ] ⚠️ USER ACTION REQUIRED — sign in inside the Chrome MCP tab as the admin account. Then click through: signup of a fresh throwaway user (fresh-profile provisioning) → onboarding → add an **uncatalogued** book via AI search (Task 4) → rate from the book page inline (Task 20) → write a review → custom shelf → discover → report the review → switch to admin → `/admin/reports` resolve → `/admin/submissions` sees the pending row → edit a book title → delete the test review (row actually gone) → disable the throwaway user (Task 7) → confirm they are locked out → delete the throwaway account via settings (Task 11).
5. [ ] Confirm Sentry delivery if a DSN has been added since; otherwise record as still blocked.
6. [ ] Update `MEMORY.md` pointers and the `hardening-plan-2026-08` memory (task 31 step 4 now closed here).

**Verify:**
- [ ] Full CI suite passes.
- [ ] Every P0/P1 finding in the findings file has a passing check recorded here.
- [ ] Journey in step 4 completed without a dead end.

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Notifications system (likes, comments, follows, club joins) — G3 | New table + bell UI + fan-out; a feature, not a fix | Product plan after this ships |
| Block / mute users — G4 | Needs a `user_blocks` table and RLS predicates on follows/comments/DMs/friend requests; design with G3 | Product plan |
| DNF / paused status, re-reads, half-star ratings — G5 | Changes the `user_books` UNIQUE constraint and every stats query | Product plan |
| Goodreads import of "My Review", custom shelves, read count, private notes — G6 | Parser already extracts shelves; mapping into reviews/shelves is feature work | Product plan (pairs with G5) |
| `is_public_activity` toggle and a true private-profile mode — G7 | Task 1 makes the trigger honour the flag; exposing it and auditing every read is a separate pass | Product plan |
| User timezone for stats and streaks — G8 | Needs a `profiles.timezone` column, a settings control, and a rewrite of `lib/queries/stats.ts` boundaries | Product plan |
| Series / editions / ISBN-13 dedupe / admin merge tool — G9 | Catalog model change | Product plan |
| Club discussions, monthly goals, avatar upload, i18n — G10 | Features | Backlog |
| `noUncheckedIndexedAccess` (123 errors) | Each fix is a behaviour decision; Task 22 adds the cheaper strict flags first | Dedicated pass |
| Vercel AI Gateway migration, per-request AI spend telemetry | Infra change with its own credentials; unchanged from the previous plan | Post-hardening |
| Next 16 Cache Components (`use cache` / PPR) adoption | Tasks 16–17 use `unstable_cache` + tags; a full migration is a rendering refactor | v2 perf pass |
| Dropping the 60 `unused_index` advisor entries | Most are the 061 indexes that have not had traffic yet; Task 24 drops only the 5 proven redundant | Re-check advisor in Oct 2026 |
| Splitting `reader-map-immersive.tsx` (1256 LOC), `external-book-search.ts`, `recommendations.ts` | Refactor for its own sake; Task 22 removes their dead exports | When one of them next needs a feature |
| Recharts area/pie not painting on `/stats` | Pre-existing, unrelated (previous plan) | Own bug task |
| Orphan `schema_migrations` row `20241211 / create_reading_goals` | Production history write; user deferred in the previous plan | Next time history is touched (Task 24 could do it if the user says so) |
| `console.*` in `components/**` and `scripts/**` | Deliberate `no-console` scoping from the previous plan | If client errors are ever routed to Sentry |
| **Provision Upstash Redis + restore fail-closed rate limiting** (parked from Task 5 item 1) | Production Vercel has no `KV_REST_API_URL` / `KV_REST_API_TOKEN` (no Redis store; Vercel KV itself is discontinued). Fail-closed would 429 every rate-limited call, so until a store exists `checkRateLimit()` logs the gap once per instance and counts in memory (no real limit on serverless). The user will provision the store themselves. **To finish:** (1) Vercel Marketplace → Upstash Redis → connect to this project (sets both KV names in every environment; verify with `npx --yes vercel@latest env ls production`); (2) in `lib/utils/rate-limit.ts` `checkRateLimit()`, make the `isProduction && !isKVConfigured` branch `return { allowed: false, remaining: 0, resetIn: 60000 }` after the once-only log; (3) un-skip "FAILS CLOSED in production and says why once" in `__tests__/lib/utils/rate-limit-kv.test.ts` and drop the "counts in memory in production" case; (4) while in the Vercel env screen also add `CRON_SECRET`, `SUPABASE_WEBHOOK_SECRET`, `RESEND_API_KEY` and (optionally) `EMAIL_TOKEN_SECRET` (missing today; digest cron and welcome email are inert in prod, and since Task 9 `/api/email/unsubscribe` answers 503 until `EMAIL_TOKEN_SECRET` or `CRON_SECRET` exists) | When the user has time to provision it — before Task 25 final QA at the latest |
| Cross-request cache for public profile shelves / stats / social links | Those tables carry no cache tag; ~16 mutation sites (shelves ×8, books ×3, import, user, privacy, badges) write them. Design when wanted: `CACHE_TAGS.profile(userId)` = `profile:<id>` on an `unstable_cache` bundle keyed by user id + tab, invalidated from every writer via a shared `invalidateProfile(userId)` helper; the owner's own view stays per-request. Task 16 left `getProfileByUsername` React-`cache` only and cached just `getUserReviews` (tag `reviews`) | If profile pages show up in DB load or crawl-traffic numbers |
| Mapbox account recovery / token rotation | Outside the codebase; the user is contacting Mapbox support. Task 3 does not depend on it. When a new token arrives: rotate in Vercel env, add URL restriction to `ohmyreads-next.vercel.app` | When the account is recovered |

---

## Final QA Checklist

- [ ] Migrations 064 and 065 applied live, idempotent, types regenerated and committed
- [ ] No broken imports or references
- [ ] `npm run typecheck` passes (with the Task 22 strict flags)
- [ ] `npm run lint` passes — 0 errors, warnings ≤ baseline (target 0)
- [ ] `npm run test:run` passes — ≥ 245 + Task 21 additions
- [ ] `npm run build` passes
- [ ] Supabase security advisor: 0 anon-callable SECURITY DEFINER functions beyond the deliberate list; 0 mutable search_path
- [ ] P0 findings S1–S7 and P1 findings B1–B4 each have a recorded passing check
- [ ] Core user + admin journeys work (Task 25 step 4, signed in)

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-01 | — | Plan created | 25 tasks from the 7-agent phase-2 audit (`phase2-audit-findings-2026-09-01.md`); user chose to include account deletion (T11) and privacy/terms (T12) here rather than in a product plan |
| 2026-09-01 | 1 | COMPLETE | Migration 064 applied live; 28-check role matrix in `supabase/checks/064_phase2_security.check.sql` passes; freeze rule uses `current_user` not the JWT role; `updateReadingStats` removed; badges + unread count moved to the service-role client; username `fabfashion-bianca` → `fabfashionbianca`; residual anon-callable SECURITY DEFINER club helpers + missing WITH CHECK on reviews/reading_lists UPDATE noted for Task 24. Not committed. |
| 2026-09-02 | 2 | COMPLETE | `httpUrl()` in `lib/validation/shared.ts` on every user URL schema (incl. `place.website`, previously unvalidated); `safeHref()` in `lib/utils/sanitize.ts` at 8 render sites; +80 tests (312 / 19 files); live scan of 7 URL columns found 0 offenders. Not committed. |
| 2026-09-02 | 3 | COMPLETE | Migration 065 (column grants on profiles + `get_my_profile()` + `get_nearby_readers()`) applied live; 19-check matrix in `supabase/checks/065_profiles_column_privacy.check.sql` passes; 11 star-selects rewritten; `is_admin` kept public (20 inline policies) → Task 24; Task 24 migration is now 066. |
| 2026-09-02 | 4 | COMPLETE | `importAndAddToShelf` inserts catalog rows through `createAdminClient()` after auth + Zod + new 10/h `catalog-insert` limit; 8 tests; live non-admin proof via throwaway route (direct insert 42501, action created book + shelf row; all cleaned up). Goodreads import never inserts books — audit claim wrong. |
| 2026-09-02 | 9 | COMPLETE | Settings Email card (digest toggle → `updateEmailPreferences`, session-client write, owner RPC read); signed one-click unsubscribe route (GET+POST, HMAC `EMAIL_TOKEN_SECRET`→`CRON_SECRET`, service-role write, IP rate limit, HTML confirmation); cron: `List-Unsubscribe` headers + signed footer link, skips `disabled_at`; +18 tests (422 passed + 1 skipped / 35 files). Live SQL check: opt-out and disabled both leave the cron predicate. Prod still lacks the secret → route 503 there (env to-do row updated). |
| 2026-09-02 | 8 | COMPLETE | `/login?error=` banner from an allow-list (`lib/auth/login-errors.ts`, 5 codes incl. `auth_failed`, `role="alert"`); admin dashboard: two fabricated trends and two 404 tool links removed; first component render test (`__tests__/app/login-page.test.tsx`, 9). 404 passed + 1 skipped / 33 files. |
| 2026-09-02 | 7 | COMPLETE | Migration 066 applied live (freeze `disabled_at` in `protect_admin_columns()`; reviews/comments/reading_lists SELECT hide disabled authors except to author + admins; hashed SubPlan, 0.29 ms); disable/enable actions via service role + `ban_duration`; layout → `/signout?reason=account_disabled` route; profile 404 + discover/search filters; admin UI (user page toggle, list badge, reports "Disable author"); `adminGetUser` `select("*")` 065 breakage fixed; 9-case check script passes live; +9 tests (395 + 1 skipped / 32). Task 24 renumbered to 067. Browser walkthrough deferred to Task 25. |
| 2026-09-02 | 6 | COMPLETE | Row-count checks (`.select("id")`, zero rows → "Nothing was changed", no audit row) on admin book update/delete, review delete, submission reject, enrichment update and report close; `admin-enrichment.ts` uses the `requireAdmin()` client; +14 tests in 3 new files + 1 updated (386 passed + 1 skipped / 32 files). 064 check re-run live: ALL CHECKS PASSED (C21 admin sees others' pending submissions). No admin actions exist for comments/place_photos; approval already RPC-only. Browser check deferred to Task 25. |
| 2026-09-02 | 5 | COMPLETE | All 8 fixes in; 3 new shared modules (`lib/config/image-hosts.ts`, `lib/utils/secrets.ts`, `lib/utils/csv-escape.ts`); +33 tests; `next.config.ts` remotePatterns now read from the image-host module. `vercel env ls` shows **no KV/Redis vars in any environment** → user chose to **park** the fail-closed limiter (logs once, counts in memory) and track "Provision Upstash Redis" in Out of Scope; fail-closed test kept as `it.skip`. Final gates: 371 passed + 1 skipped / 29 files. |
| 2026-09-02 | 10 | COMPLETE | Review activity cards: Radix overflow menu (Copy link; Report → `ReportDialog` for signed-in non-authors), started-reading/check-in buttons removed (no reportable target), 8 `console.log` removed, `currentUserId` prop threaded page → tabs → card; first component test under `__tests__/components/` (7). Live proof via throwaway route: `submitReport` from the feed wrote an `open` review report, then cleaned up. 429 passed + 1 skipped / 36 files. |
| 2026-09-02 | 11 | COMPLETE | Migration 067 applied live (reports.reporter_id nullable + SET NULL; book_submissions.moderated_by SET NULL; `sync_reading_stats()` guard — without it `auth.admin.deleteUser` failed 23503 on `reading_stats` for any account with books/reviews); `changePassword` (throwaway-client probe, revoked; `auth.password_change` audit) + `deleteAccount` (`amr` freshness ≤ 10 min, username match, audit first, place-photo storage, local sign-out); Account card replaces the placeholder; 20 tests; live route proved both flows end-to-end and the check script passes. 449 passed + 1 skipped / 37 files. Task 24 → 068. |
| 2026-09-03 | 12 | CODE COMPLETE - Verification blocked | Privacy (13 sections, `PROCESSORS` table: Supabase, Vercel, Sentry 1%/100%-on-error masked replay, Resend, Google sign-in/Books/Places/Gemini, OpenAI+Anthropic fallback, Mapbox browser tiles, ipapi, Nominatim/Overpass, Open Library/Google Books/archive.org covers loaded by the browser) + terms (15 sections: 13+ age, reports on review/comment/place photo, disable, AI disclaimer, location opt-in, catalog/rating sources, scraping ban) rewritten from the code; new `components/legal/legal-article-class.ts` because `prose` had no plugin behind it. Rendered on a temp dev server: both 200, one h1, links resolve. Lint + tsc clean. Blocked on the user reading the copy. |
| 2026-09-03 | 13 | COMPLETE | `hooks/use-cover-src.ts` picks the first cover candidate during render and advances on `<img>` error / decoded 1×1; `CoverImage`, `CoverImageMini` and all three `BookCard` variants use it (probe + skeleton removed, `validateCoverUrl`/`findFirstValidCoverUrl` deleted); Open Library URLs get `?default=false` so a missing cover 404s through `/_next/image`. Measured: direct browser requests to Open Library/Google Books on `/` 7 + 5 → 0; book page server HTML cover `<img>` 0 → 7 + preload. First live run exposed the old `< 50 px` heuristic as wrong behind the optimizer (xs covers are 48 px) — now `<= 1 px`. +12 tests: 461 passed + 1 skipped / 39 files. |
| 2026-09-03 | 14 | COMPLETE | 59 server files → `getUser()`; `getUser` memo = React `cache` + `WeakMap` on the per-request `cookies()` object (route handlers/actions have no `cache` scope); 25 dead `createClient()` calls pruned via lint output; `useSignOut` (no mount-time auth call) replaces deleted `useAuth`; `proxy.ts` unchanged (JWKS empty → HS256 → `getClaims()` would still call `/user`). Measured on a fresh dev server with a fetch counter + throwaway magic-link session: `/dashboard` 2 → 2 (audit's 11 was wrong: Next dedupes identical GETs in a render), `/api/messages/conversations` 4 → 2. +2 tests: 463 passed + 1 skipped / 40 files. |
| 2026-09-03 | 15 | COMPLETE | Hero: 6,377,135-byte PNG → 165,718-byte WebP source, `quality={75}`, `sizes` 100vw/70vw → served 118,802 → 53,164 bytes at w=1080 (295,798 → 107,920 at w=1920); Merriweather weights 400/700 (no `font-black` anywhere); `images.minimumCacheTTL` 2,592,000 (verified in the optimizer's `Cache-Control`); Replay via `lazyLoadIntegration` in `requestIdleCallback` + `browser.sentry-cdn.com` in CSP `script-src` → homepage JS 1,885,604 → 1,765,238 bytes raw, Sentry chunk 532,660 → 412,296 with 0 `rrweb`; `reactComponentAnnotation` removed (was inert under Turbopack — no `data-sentry-*` in any HTML). Two production builds exit 0; gates unchanged (463 tests / 40 files). |
| 2026-09-03 | 16 | COMPLETE | `getBookBySlug` (React `cache` + `unstable_cache`, public client, `maybeSingle`), `getBookReviews(bookId, page)` 10/page with exact count, `getRelatedBooks` cached; book page `Promise.all([book, getUser()])`, `?page=` nav, `generateStaticParams` removed; profile page parallel viewer + `getProfileByUsername` under React `cache`, `getUserReviews` cached; `likeReview`/`unlikeReview`/`adminDeleteReview`/`enrichSingleBook` now invalidate tags. Measured anonymous `/books/atomic-habits`: 7 requests every render → 7 cold / 4 warm; throwaway-book proof that DB writes stay invisible until the tag is revalidated. +6 tests: 469 passed + 1 skipped / 41 files. Soft-404 on missing books is pre-existing (Task 19). |
| 2026-09-03 | 17 | COMPLETE | `getCommunityFeed` → one FK-joined query, cached (`reviews`+`books`, 600 s); `getHomeCounts` cached (`reviews`, 600 s); `getCuratedFallback` cached (`books`, 600 s); `getCandidatePool` (200 books + vibe map, `books`+`reviews`, 1800 s) with the four reader reads in one `Promise.all`; `getHomeReadingActivity` parallel; `lib/ai/trending-insights.ts` extracted, page passes an un-awaited promise into a `Suspense` boundary, `TrendingNowList` is a server component. Dev medians of 5: anon 0.68 → 0.46 s / 5 → 0 requests; signed-in no signals 1.07 → 0.91 s / 14 → 10; with signals 1.45 → 0.95 s / 18 → 13; Chrome: 57 anonymous requests, 0 to `/api/`. +7 tests: 476 passed + 1 skipped / 43 files. |
| | | | |
