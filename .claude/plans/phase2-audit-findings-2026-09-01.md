# OhMyReads — Phase 2 Audit Findings (2026-09-01)

> **This is a findings document, not a plan.** It is the raw input for the next
> plan file, which must be created in the exact `example-plan.md` template before
> any task is executed. Findings marked **VERIFIED** were re-checked by the lead
> against the code or the live database on 2026-09-01; the rest are agent
> findings with file:line evidence that were not independently re-read.

## State of the previous plan (`hi-claude-review-the-tidy-dewdrop.md`)

- 32 of 32 tasks written, committed and pushed on `main` through `a51eab6`.
- Migrations 053–063 applied to production. Next free migration number: `064`.
- CI gates re-run today on the committed tree: `tsc` clean, lint 0 errors / 25
  warnings, **245 tests passing (18 files)**.
- Vercel runtime errors for the last 7 days: **none**.
- Only outstanding item: task 31 step 4, the signed-in manual journey smoke test,
  which also closes the deferred browser checks of tasks 1, 2, 5, 7, 9, 23, 26, 30.
  Task 5 additionally needs a `NEXT_PUBLIC_SENTRY_DSN`; task 22 needs an AI key.
- Uncommitted: `CLAUDE.md` lost its `## Commands` section (decide: restore or commit).

---

## P0 — Security (all VERIFIED unless marked)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| S1 | **`approve_book_submission`, `approve_place_submission`, `reject_place_submission` are SECURITY DEFINER with no admin check and EXECUTE granted to `anon` + `authenticated`.** A user submits a book/place, then calls `/rest/v1/rpc/approve_*` with their own submission id and publishes it into the catalog / map, stamping any moderator id. Supabase security advisor lists 39 SECURITY DEFINER functions anon-callable, 41 authenticated-callable (most are trigger functions that should not be callable at all). | `019_audit_security_fixes.sql:79`, `007_user_locations_and_places.sql:166,224`; live advisor `anon_security_definer_function_executable` | Migration 064: in-body `is_admin` guard + `REVOKE ALL ... FROM PUBLIC, anon` on the three; `REVOKE` execute on every trigger function and on `cleanup_expired_presence`, `are_friends`, `get_user_shelf_count`, `recalculate_book_rating`. |
| S2 | **Friend request receiver can rewrite `sender_id`.** UPDATE policy `USING (receiver_id = uid AND pending)` but `WITH CHECK (status IN accepted,rejected)` only. A forged accepted row satisfies `are_friends()`, which is the sole gate on `direct_messages` INSERT → DM anyone. | `029_rls_and_indexes.sql:35-38`; live `pg_policies` confirms | Add `receiver_id = auth.uid()` to WITH CHECK + BEFORE UPDATE trigger freezing `sender_id`/`receiver_id`. |
| S3 | **Stored XSS via `javascript:` URLs.** `z.string().url()` in zod 4.1.13 accepts `javascript:`, `data:`, `vbscript:` (tested). Rendered as raw `href` on public profile, social links, and the admin user page. CSP has `script-src 'unsafe-inline'`. | `lib/validation/profile.ts:15-16,21`; `app/(public)/users/[username]/page.tsx:205`; `components/social/social-links-display.tsx:69`; `admin/users/[id]/page.tsx:96` | `.regex(/^https?:\/\//)` on website/avatarUrl/social url/coverUrl; guard again at render. |
| S4 | **`profiles` is world-readable including `location_geohash` (≈19×38 m), `location_label`, `presence_note`, `is_admin`, `unread_messages_count`.** Presence/truncation rules live only in JS. Anyone with the anon key: `GET /rest/v1/profiles?select=username,location_geohash&location_enabled=eq.true`. | `001_initial_schema.sql:27`; live policy `Public profiles are viewable by everyone USING (true)`; `lib/queries/geo.ts:100-113` | Column-level `REVOKE SELECT (...) FROM anon, authenticated`; serve nearby readers through a SECURITY DEFINER RPC that applies the rules. |
| S5 | **Owner can write counter columns directly.** `profiles` UPDATE has no WITH CHECK (followers/following/friends/unread counts); `reviews.likes_count`, `reading_lists.likes_count` writable by author; `reading_stats` owner has INSERT/UPDATE/DELETE; `user_badges` self-grant with free-text `badge_id`. | live `pg_policies`; `001:30,135`, `026:72`, `030:9-16`, `009:27` | BEFORE UPDATE triggers reverting counter columns to OLD unless service_role; drop `reading_stats` DELETE; badges only via service role. Note `lib/actions/messages.ts:148` writes `unread_messages_count` via user client — move to service role. |
| S6 | `direct_messages` UPDATE policy pins only `receiver_id`: recipient can rewrite `content`/`sender_id` of any inbox message. | `023_direct_messages.sql:79-82` | WITH CHECK + freeze trigger on content/sender_id/created_at. |
| S7 | Signup metadata bypasses profile validation: `handle_new_user` copies `raw_user_meta_data.username/full_name/avatar_url` unchecked; no CHECK on `profiles.username`. | `044_fix_handle_new_user_search_path.sql:14-17`; `059_constraints.sql` has none | `CHECK (username ~ '^[a-z0-9_]{3,30}$')`, normalise in trigger, cap display_name/avatar_url. |
| S8 | Rate limiter falls back to per-instance memory in production when `KV_REST_API_URL/TOKEN` are unset (fail-closed covers KV *errors* only). | `lib/utils/rate-limit.ts:38,181` | Verify KV vars on Vercel; fail closed when unset in prod. (agent finding, code path read) |
| S9 | SSRF via OG routes: `avatar_url`/`cover_url` fetched server-side inside `ImageResponse`. | `app/api/og/review/route.tsx:75,187`, `og/stats/route.tsx:394` | Only render hosts in `remotePatterns`. (agent) |
| S10 | Low: `isForeignOrigin` allows no-Origin/no-Referer (`csrf.ts:379`) → cross-site `<img>` farms paid geo proxies; cron secret compared with `!==` (`cron/weekly-digest/route.ts:30`); comment reply parent not checked against `review_id` (`comments.ts:559-573`); CSV formula injection (`export/route.ts:305`); `placeGeohash` not validated (`location.ts:366`); `discover/browse` NaN page → 500 (`route.ts:536`). | as cited | Sec-Fetch-Site check; `safeCompare`; `.eq("review_id")`; prefix `'`; `isValidGeohash`; coerce+min. (agent) |

## P1 — Broken in production today (VERIFIED live)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | **Admin book edit fails, admin book delete and review delete silently delete 0 rows and still write a success audit row.** `books` has NO UPDATE/DELETE policy; `reviews`/`comments` have owner-only DELETE; `requireAdmin()` returns the session client. | live `pg_policies`; `lib/actions/admin-books.ts:257,315`; `admin-reviews.ts:236`; `admin-enrichment.ts:122` | Migration 064: admin UPDATE/DELETE policies on `books`, admin DELETE on `reviews`/`comments`/`place_photos`. Or route admin writes through `createAdminClient()`. Check row count on deletes. |
| B2 | **Book-submission moderation queue is empty for admins and approval cannot succeed.** `book_submissions` has no admin SELECT/UPDATE policy; owner UPDATE requires `status = 'pending'` in WITH CHECK, so status can never become `approved`. | live `pg_policies`; `lib/actions/book-submissions.ts:390-470` (uses `checkAdmin` session client) | Admin SELECT + UPDATE policies mirroring `place_submissions` (007:129,144). |
| B3 | **Normal users cannot add a book that is not already in the catalog.** `importAndAddToShelf` (AI search) and Goodreads CSV import insert into `books` with the session client; since 019 only admins may INSERT. The owner tests as admin, so this was never seen. | `lib/actions/books.ts:419-471`, `lib/actions/import.ts:199,319`; live policy `Admins can insert books` | Insert through service role after validation, or an "authenticated users may insert with `created_by = auth.uid()` and null ratings" policy + CHECK. |
| B4 | **Admin "disable user" is a no-op** (writes only an audit row; no column, no gate, no UI caller). The new reports queue has no enforcement action. | `lib/actions/admin-users.ts:346-349`; grep: no caller | `profiles.disabled_at` + proxy/RLS enforcement + button on `admin/users/[id]`. |
| B5 | Login page never reads the `?error=` reason the app layout sends on auth/profile/layout failure → silent logout. | `app/(app)/layout.tsx:27,56,79`; `app/(auth)/login/page.tsx:73` reads only `redirect` | Read `error` into the existing banner. |
| B6 | Admin dashboard shows hard-coded growth trends (`12`, `8`) next to real counts; two dead tool links `/admin/email`, `/admin/settings`. | `app/(app)/admin/page.tsx:272,283,445-446` | Remove trend props; remove or build the links. |
| B7 | Weekly digest defaults on with no opt-out UI; `email_digest_*` / `email_notifications_enabled` never written anywhere. | `app/api/cron/weekly-digest/route.ts:48-51`; grep | Email section in settings + unsubscribe link. |
| B8 | Three "More options" buttons on activity cards have no handler; debug `console.log` in the same file. | `components/community/activity-card.tsx:88,177,345,255-301` | Wire to Report/Share or remove. |

## P2 — Performance (agent findings; items marked VERIFIED were re-checked)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P1 | **Covers never in server HTML** — `CoverImage` resolves the URL in `useEffect`, probes candidates sequentially with `new Image()` straight from Open Library, then downloads again via `/_next/image`. `priority` is inert; crawlers see no `<img>`. Homepage does this for ~19 covers. | `components/books/cover-image.tsx:93-113`, `book-card.tsx:115-129`, `lib/utils/covers.ts:186-228` | Resolve first candidate on the server (`resolveCoverUrl` exists), render `<Image>` in RSC, fall back via `onError`. |
| P2 | **Auth round-trips: 11 per dashboard request, 5 per public page** — 62 files call `supabase.auth.getUser()` directly; only `lib/supabase/server.ts:38` is memoised. (VERIFIED count) | list in perf agent report: proxy.ts:73, messages.ts:19/119, dashboard sections, etc. | Replace with memoised `getUser()`; consider `getClaims()` in proxy. |
| P3 | **Homepage hero is a 6.4 MB PNG** at q90 / `sizes=100vw`. (VERIFIED) | `public/images/Gemini_Generated_Image_*.png`; `components/home/home-hero.tsx:110-119` | Pre-export ~2000px WebP (~200 KB), q75-80, tighter `sizes`. |
| P4 | Book page: `getBookBySlug` called twice (no `cache()`), auth awaited serially, 50 reviews eager, no `unstable_cache` on public reads, `generateStaticParams` inert because page calls `cookies()`. Same double-fetch on `users/[username]`. | `app/(public)/books/[slug]/page.tsx:39,83,103-113`; `lib/queries/books.ts:12,47` | `cache()` wrappers; `Promise.all`; public reads via `createPublicClient()` + `unstable_cache` with existing tags; paginate reviews to 10. |
| P5 | Homepage public reads uncached (curated anon branch, community feed, two `count: exact` scans); signed-in path runs ~9 sequential queries incl. a 200-book pool per view. | `app/(public)/page.tsx:92-99`; `lib/queries/recommendations.ts:53-140,453-465`; `home.ts:53-153` | Cache anon reads 5-15 min; cache the user-independent pool; `Promise.all` the user queries. |
| P6 | `my-shelf` and `getUserStats` fetch every `user_books` row to count in JS (PostgREST caps at 1000 → silent truncation for CSV importers); custom-shelf view is a 4-query waterfall. | `app/(app)/my-shelf/page.tsx:48-98`; `lib/queries/users.ts:55-56` | `head:true` counts in `Promise.all`; paginate grid; single `shelf_books!inner` query. |
| P7 | Sentry Replay bundled eagerly (~50-70 KB gz) at 1% sampling; `reactComponentAnnotation` inflates every payload (and sits under the `webpack` key — may not apply under Turbopack). | `sentry.client.config.ts:19-25`; `next.config.ts:125-127` | `lazyLoadIntegration`; disable annotation. |
| P8 | Anonymous homepage fires `/api/ai/trending-insights` on mount and always 401s. (VERIFIED) | `components/home/trending-now-list.tsx:33-55` | Gate on `isLoggedIn` or fetch server-side. |
| P9 | Service worker `cache.put`s every same-origin 200 incl. personalised HTML and `_rsc` payloads, unbounded; precaches `/discover`. (VERIFIED) | `public/sw.js:19,65` | Cache only `_next/static`, fonts, offline page; skip `_rsc` and `Cache-Control: private`. |
| P10 | Small: `useAuth` (network `getUser`) used only for `signOut` in top bar + sidebar; Merriweather 900 loaded, `font-black` unused; `images.minimumCacheTTL` at default 4 h for immutable covers. | `hooks/use-auth.ts:13-42`; `app/layout.tsx:14-19`; `next.config.ts:7` | `useSignOut()`; drop weight; TTL 30 d. |

## P2 — SEO (agent findings; VERIFIED where marked)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| E1 | No `alternates.canonical` on books/authors/lists/clubs (only users has one). (VERIFIED) | `books/[slug]/page.tsx:48-79` etc. | Add canonical to each `generateMetadata`. |
| E2 | Sitemap lists every profile with a username regardless of `discovery_visible`; profile page emits Person JSON-LD with no `noindex` for opted-out readers. (VERIFIED) | `app/sitemap.ts:96-107`; `users/[username]/page.tsx:53-64,124` | `.eq("discovery_visible", true)`; `robots: noindex` on hidden profiles. |
| E3 | `/books` ignores query params entirely (`BookBrowser` state only) → genre links and the sitelinks-searchbox target render identical HTML. | `app/(public)/books/page.tsx:31-54`; `components/books/book-browser.tsx:27-38` | Seed from `searchParams`; consider `/books/genre/[genre]`. |
| E4 | Brand duplicated in titles (`Trending Books - OhMyReads \| OhMyReads`) on 4 pages. | `app/layout.tsx:25` vs `page.tsx:28`, `trending`, `recommendations`, `about` | Strip page-level brand; home uses `title.absolute`. |
| E5 | robots disallows `/login`,`/signup` yet sitemap submits them; sitemap omits `/trending`, `/discover`, `/clubs`, `/community`, `/recommendations`, club pages, public lists; `lastModified` is `created_at` or `new Date()`. | `app/robots.ts:20-21`; `app/sitemap.ts:65-76,90,113,121` | Fix entries; use `updated_at`. |
| E6 | Organization JSON-LD `logo: /logo.png` does not exist; OG book card and author page show Open Library `average_rating` unlabeled as the site's own; `og:type` should be `book`; personalised `/discover` and `/recommendations` indexable. | `page.tsx:112`; `api/og/book/route.tsx:20,29-30`; `lib/queries/authors.ts:95-98`; `discover/page.tsx:7-17` | Point at an existing icon; use `local_*` fields or label; `noindex, follow`. |

## P2 — UX / Accessibility (agent findings)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| U1 | Gold rating text on cream ≈ 2.0:1 contrast (4.5:1 needed); `text-amber-600` ≈ 3.0:1. | `book-card.tsx:202,306,412`; `rating-display.tsx:55`; `review-card.tsx:114` | Gold for the star glyph only; numeric label in `text-foreground`. |
| U2 | Cards show Open Library `average_rating` with a bare star; detail page labels both sources → grid and detail disagree with no explanation. | `book-card.tsx:409`; `shelf-book-card.tsx:185` vs `books/[slug]/page.tsx:259-295` | Prefer local rating on cards when present, else label. |
| U3 | Search palette is a plain div: no `role=dialog`, focus trap, or restore; Tab escapes into the page. | `components/search/global-search-modal.tsx:37-61` | Radix Dialog. |
| U4 | Shelf card menu is `opacity-0 group-hover:opacity-100` → invisible on touch and to keyboard users. | `components/books/shelf-book-card.tsx:239-243` | `group-focus-within`, always visible below `lg`. |
| U5 | Floating chat button (`bottom-6 z-30`) sits under the mobile bottom nav (`bottom-0 h-16 z-50`). | `components/messages/chat-trigger.tsx:16`; `mobile-bottom-nav.tsx:143-150` | Offset above nav on small screens. |
| U6 | Rating a book requires scrolling to the full review form; no inline star control next to Add to Shelf. | `books/[slug]/page.tsx:338-365,397` | Five-star control posting a rating-only review (already supported). |
| U7 | Same `toggleReviewLike` is a thumbs-up "Helpful" on review cards and a red heart "Like" on activity cards. | `review-card.tsx:350-366`; `activity-card.tsx:404-416` | One icon, one verb. |
| U8 | A11y set: `RatingDisplay` stars have no text alternative; no skip link; unconditional `scroll-behavior: smooth` with no `prefers-reduced-motion`; search results lack combobox/listbox roles and live region; mobile More sheet has no Escape/focus handling; login/signup error banners lack `role=alert`, `Input` never sets `aria-invalid`. | `rating-display.tsx:48-77`; `app/globals.css:113-115`; `unified-search.tsx:221-252`; `mobile-bottom-nav.tsx:68-140`; `login/page.tsx:142`; `ui/input.tsx:9` | As listed. |

## P2 — Database integrity (agent findings; live advisor data where marked)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| D1 | `friend_requests` uniqueness is directional → A→B and B→A both accepted doubles `friends_count`, and `reconcile_counters` validates the inflated value. | `022_friend_requests.sql:15`; `057:366` | Unique index on `LEAST/GREATEST(sender_id, receiver_id)` after dedupe. |
| D2 | `update_place_photos_count` is not SECURITY DEFINER → runs as uploader, filtered by admin-only `places` UPDATE policy, `photos_count` never increments. | `012_place_photos.sql:69` | `ALTER FUNCTION ... SECURITY DEFINER SET search_path = public`. |
| D3 | `user_checkin_stats` has no reconcile path (trigger on INSERT only, deletes allowed). | `013_place_checkins.sql:30,86` | Add block to `reconcile_counters`. |
| D4 | `on_review_created` ignores `is_public_activity` unlike sibling triggers. | `005:46` vs `005:65`, `013:203` | Add the check. |
| D5 | `book_club_reads.club_id/book_id` nullable; `update_club_member_count` decrement lacks `GREATEST(0, …)`. | `025:32-33,168` | NOT NULL + guard. |
| D6 | Missing composite indexes for the book review list (`book_id, created_at DESC` / `book_id, likes_count DESC`); 9 unindexed FKs (live advisor: `reports.resolved_by`, `profiles.admin_granted_by`, `book_submissions.book_id/moderated_by`, `place_checkins.book_id`, `places.submitted_by`, `place_submissions.moderator_id`, `reading_list_books.book_id`, `book_club_reads.book_id`). | `lib/queries/reviews.ts:38-53`; advisor `unindexed_foreign_keys` | Add indexes in 064. |
| D7 | Live advisor: **91 `auth_rls_initplan` warnings** (policies call `auth.uid()` without `(select …)`, re-evaluated per row) and **72 `multiple_permissive_policies`** (12 on `book_club_members`). 4 functions still have mutable `search_path` (`get_distinct_genres`, `update_club_timestamp`, `update_list_timestamp`, `generate_list_slug` — SECURITY INVOKER, so task 7's loop skipped them). `pg_trgm` in `public`. `books_external_id_dedupe_backup` has RLS with no policies (should be dropped). | advisor output 2026-09-01 | Batch rewrite policies with `(select auth.uid())` and merge permissive policies; set `search_path` on the 4; drop the backup table. |
| D8 | Redundant indexes: 006's partial uniques on `isbn`/`google_books_id`/`open_library_id` superseded by 059; `user_books_user_book_idx`; `idx_activity_feed_user_id`; plus 60 `unused_index` advisor entries (many are the new 061 indexes, expected). | advisor + migrations | Drop the 5 confirmed redundant ones; revisit `unused_index` in a month. |

## P3 — Product gaps (agent findings, evidence-cited)

| # | Gap | Evidence | Severity |
|---|---|---|---|
| G1 | No account deletion, email or password change; settings says "coming soon" while `/privacy` §5 promises deletion. | `app/(app)/settings/page.tsx:150-157`; audit enum `user.delete_account` unused | Blocker (legal) |
| G2 | Privacy policy omits location geohash/presence, Mapbox, ipapi, AI providers, Sentry, Resend; terms have no AI/location clause. | `app/(public)/privacy/page.tsx` | Major (legal) |
| G3 | No notifications (likes, comments, follows, club joins) beyond friend requests and DM unread. | grep: no table, no bell | Major |
| G4 | No block/mute; only recourse is the report queue, which cannot ban (B4). | grep: none | Major |
| G5 | No DNF/paused status, no re-reads (`UNIQUE(user_id, book_id)`), integer-only stars. | `001_initial_schema.sql:79,85` | Major |
| G6 | Goodreads import discards "My Review", custom shelves (parser extracts them), read count, private notes. | `lib/utils/csv-parser.ts`; `lib/actions/import.ts:278-293` | Major |
| G7 | Privacy controls thinner than `/features` claims; `profiles.is_public_activity` never read or written. | `features/page.tsx:81-83`; grep | Major |
| G8 | Reading stats/streaks use server UTC; no user timezone. | `lib/queries/stats.ts:96-97,202-205,352-364` | Major |
| G9 | No series/editions/ISBN dedupe (dedupe only on exact external ids); no admin merge tool. | `lib/actions/books.ts:~470-490` | Major over time |
| G10 | Clubs are a shell (disabled Settings button, no discussions); goals yearly only vs "monthly" copy; avatar upload disabled; 42 locale-less `toLocale*` calls. | `clubs/[slug]/page.tsx:86`; `profile/edit/page.tsx:171`; grep | Minor |

## Code quality & tests

**Coverage inventory:** 18 test files / 245 tests. Untested: 23 of 27 action files, 22 of 22 query files, 20 of 22 validation files, 27 of 30 API routes. Tests hand-roll a `createMockSupabase()` chain per file (no shared helper) and mock `@/lib/supabase/server`, `next/cache`, `rate-limit` at module top.

| # | Untested module | Risk | What to assert |
|---|---|---|---|
| T1 | `lib/actions/books.ts` (581 LOC) | Critical | addToShelf: unauth/rate-limit/schema guards; upsert has `started_at`/`finished_at` per status with `onConflict:"user_id,book_id"`; badges synced only on `read`; rejected badge sync still returns success; `invalidateTags` called. importAndAddToShelf: 23505 retry with hex suffix, gives up after 10. **Add a test that a non-admin insert into `books` is expected to succeed (B3).** |
| T2 | `lib/actions/shelves.ts` (904 LOC, 12 exports) | Critical | Ownership refusal on every mutation when `shelf.user_id ≠ caller`; unauth guard on all 12. |
| T3 | `app/api/export/route.ts` | High | 401/429/400 paths; `Content-Disposition` filename; CSV formula cells neutralised (S10). |
| T4 | `app/api/webhooks/supabase/route.ts` | High | `safeCompare` null/length cases; prod unset secret → 401; wrong secret → no admin call. |
| T5 | `app/api/cron/weekly-digest/route.ts` | High | 503 unset secret; 401 wrong bearer; only digest-enabled users emailed; one failure does not abort loop. |
| T6 | `lib/actions/messages.ts` | High | self-message refused; no accepted friendship → no insert; markMessagesAsRead scoped to recipient. |
| T7 | `lib/utils/csv-parser.ts` + `lib/actions/import.ts` | Med-High | quoted commas, `="978…"` ISBN form, CRLF, header order; 500-row chunking. |
| T8 | `lib/actions/user.ts` updateProfile / `location.ts` updateLocation | Medium | username taken by other id refused; precision clamped 4–8; stored geohash matches encoder. |

Cheap pure-function targets: `jsonld.ts`, `opening-hours.ts` `isOpenNow`, `discover.ts` `computeCompatibilityScore`, `covers.ts` builders.

**Weak tests:** `__tests__/lib/actions/reviews.test.ts:126` and `comments.test.ts:85` assert only inside `if (result.error)` (zero assertions on success). `revalidatePath`/`invalidateTags`/`updateTag` are mocked everywhere but asserted **0 times** across 18 files, so the class of bug fixed in `a51eab6` is invisible. `geohash.test.ts:100` is `not.toThrow()` only.

**Code quality (ranked):**

| # | Finding | Evidence | Fix |
|---|---|---|---|
| Q1 | Auth preamble duplicated 84× (`getUser()` + `return { error: "Not authenticated" }` ×65 + 9 wording variants); post-auth profile fetch duplicated 11×. No `requireUser` exists. | 21 action files | `lib/auth/require-user.ts` mirroring `requireAdmin`'s shape, optional `withProfile`. |
| Q2 | Five action return shapes: `{error}` 207, `{success:true}` 77, `{success:false,error}` 153, `{success,messageId,error:null}`, `{data}` 5, plus `throw` in `admin-enrichment.ts` and bare `null`/`[]`. Only `reports.ts:27` declares a type. | grep | One `ActionResult<T>` in `types/app.ts`; migrate file by file. |
| Q3 | 29 of 121 `"use server"` exports are reads (`get*`/`can*`/`check*`) — each is a public POST endpoint. | shelves 4, checkins 3, book-submissions 3, admin-* 9 | Move to `lib/queries`. |
| Q4 | Dead code: 6 never-imported components (`global-activity-feed`, `mood-matcher`, `comment-section`, `review-list`, `book-recommendation-row`, `event-card`); ~30 dead exported functions (`followUser`/`unfollowUser`, `adminDisableUser`/`EnableUser` [see B4 — wire, don't delete], `updateList`/`deleteList`, `updateClub`/`deleteClub`, `deleteMessage`, 8 of 13 exports in `covers.ts`, 11 in `external-book-search.ts`, …). | grep-verified by agent | Delete or wire; enable `noUnusedLocals`. |
| Q5 | `lib/queries` return `[]` on error at ~72 sites → a failed primary query renders an empty page and never reaches `error.tsx`. | follows 10, book-submissions 8, books 7, geo 6 | Throw (or `{data,error}`) for a page's primary query; keep swallow for side panels. |
| Q6 | Large files: `reader-map-immersive.tsx` 1256 LOC (19 useState + 15 useEffect); `shelves.ts` 904; `recommendations.ts` 774; `external-book-search.ts` 735; `book-submissions.ts` 638. | wc | Split by concern; extract pure scoring. |
| Q7 | 17 `as unknown as` casts coercing Supabase join results to hand-written types (`any` 0, `!` 0 — good). | reviews.ts:164,201,244; books.ts:116,163; users.ts:181,222; … | `.returns<T>()` or derive types from `Database` rows. |
| Q8 | Client-side fetch on mount where server would do: `profile/edit/page.tsx:40`; `curated-mini-grid.tsx:43` and `trending-now-list.tsx:40` hit paid AI routes on every home mount (see P8). | as cited | Server components / server-side fetch. |
| Q9 | Real index-key bugs: `social-links-editor.tsx:76` (editable list), `reader-map-immersive.tsx:1072`, `location-section.tsx:473`, `goodreads-import.tsx:184,208`, `ai-place-search.tsx:195`. | grep | Stable ids. |
| Q10 | `use-realtime-messages.ts` has two near-identical subscribe blocks (31–80, 105–158). | hooks/ | One hook with channel key + filter. |
| Q11 | tsconfig: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` absent; `noUncheckedIndexedAccess` known (123 errors). | tsconfig.json | Add `noUnusedLocals` first. |
| Q12 | Lint: 18 `no-img-element` warnings, 8 of them in OG routes where `<img>` is required; 4 `alt-text`; 3 `exhaustive-deps`. | eslint json | Disable the img rule for `app/api/og/**`; fix the ~10 real ones. |
| Q13 | `scripts/`: 4 one-off data migrations already applied (`seed-books`, `reseed-curated`, `fix-duplicate-books`, `import-award-winners`) sit beside 2 live tools; none in `package.json`. | ls scripts | Archive the four; add `npm run` entries for `enrich-books` and `import-ratings`. |
| Q14 | README is create-next-app boilerplate; no mention of `test`/`typecheck`/`types:gen`, `.env.example`, migrations, `proxy.ts`. | README.md | Rewrite setup + commands section (also restore the `## Commands` block dropped from CLAUDE.md). |

## Recommended sequencing for the next plan

1. **Migration 064 (one file, P0+P1 DB):** S1 RPC guards + REVOKEs, S2 friend_requests WITH CHECK + freeze trigger, S5/S6 counter and message freeze triggers, S7 username CHECK, B1/B2 admin policies on `books`/`reviews`/`comments`/`place_photos`/`book_submissions`, D1 friendship unique, D2 photos trigger, D6 indexes. Apply with `npx supabase db query --linked`, regen types.
2. **App-side P0:** S3 URL scheme validation, S4 profile column revoke + geo RPC, B3 books insert via service role, S8 KV guard, S9/S10 small fixes.
3. **P1 product-correctness:** B4 disable user, B5 login error banner, B6 admin dashboard, B7 digest opt-out, B8 activity menu.
4. **Perf pass:** P1 server-rendered covers, P2 memoised auth, P3 hero image, P4/P5 caching, P8/P9.
5. **SEO + a11y pass:** E1–E6, U1–U8.
6. **Product:** G1/G2 legal first, then G3–G6.
7. **Finally:** the signed-in smoke test from the previous plan (task 31 step 4), now as the exit gate for all of the above.
