# Next steps after the phase-2 hardening plan (written 2026-09-04)

This is a backlog note, not an execution plan. When one of these blocks is
picked up, convert it into a plan in the `.claude/docs/example-plan.md`
format first (Status table, one task per session, `/clear` between tasks).

**Where things stand:** all 25 phase-2 tasks are complete (`.claude/plans/phase2-hardening-2026-09.md`),
`origin/main` = `79d05f1`, production deployment Ready and smoke-checked
(home / book / browse / trending / sitemap 200, missing profile 404,
`/api/email/unsubscribe` 503 because its secret is missing). Migrations
064–068 are applied live. Nothing is broken for users; what follows is
ranked by how much it changes what users actually get.

---

## 1. Only the user can do these (Vercel dashboard + Sentry, ~30 min)

| Missing in production | Effect today | How |
|---|---|---|
| Upstash Redis → `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Rate limiting is per-instance memory, i.e. effectively none on serverless | Vercel Marketplace → Upstash Redis → connect to `ohmyreads-next` (sets both names in every environment) |
| `RESEND_API_KEY` | No email is sent: no welcome mail, no weekly digest | Resend dashboard → API key → Vercel env (Production + Preview) |
| `CRON_SECRET` | Weekly digest cron never runs | Any 32+ char random string; Vercel env |
| `SUPABASE_WEBHOOK_SECRET` | Welcome-email webhook rejected | Same value in Vercel env and in the Supabase webhook header |
| `EMAIL_TOKEN_SECRET` (optional, falls back to `CRON_SECRET`) | Unsubscribe link answers 503 | Random string; Vercel env |
| Sentry delivery check | Error reporting configured (`NEXT_PUBLIC_SENTRY_DSN` etc. since Feb 2026) but never observed working | Open the Sentry project, confirm events from the current production deployment; if none, trigger a deliberate 500 and check again |

Verify with `npx --yes vercel@latest env ls production` (stored auth works on this machine).
Optional while there: check an AI provider key exists in production (none in `.env.local`).

## 2. Claude can do these — one short ops plan, three tasks

1. **Wire the secrets once they exist** — restore the fail-closed branch in
   `checkRateLimit()` (`lib/utils/rate-limit.ts`, `isProduction && !isKVConfigured` →
   `return { allowed: false, remaining: 0, resetIn: 60000 }` after the once-only log),
   un-skip "FAILS CLOSED in production and says why once" in
   `__tests__/lib/utils/rate-limit-kv.test.ts` and drop the "counts in memory in production"
   case; then verify live: digest cron (`/api/cron/*` with the secret), unsubscribe GET/POST,
   welcome webhook. Exact steps also in the phase-2 plan's Out of Scope row
   "Provision Upstash Redis + restore fail-closed rate limiting".
2. **Migration 069 — SECURITY DEFINER lints 0028/0029** — 10 functions callable by `anon`,
   17 by `authenticated` (club helpers used by RLS, review like counters, `get_nearby_readers`,
   `get_top_reviewers`, `generate_club_slug`, `add_club_creator_as_admin`, `reconcile_*`,
   moderation RPCs, `set_book_shelves`, `get_my_profile`, `are_friends`). Per-function review:
   `REVOKE EXECUTE FROM anon` where no anonymous caller exists (start with `reconcile_*` and the
   moderation RPCs, which already guard internally), keep the RLS-used club helpers. Dry-run +
   check script + advisors, same pattern as 068.
3. **Post-QA fixes** (found by the Task 25 journey, none user-blocking):
   - `/login` shows Supabase's raw "User is banned" for disabled accounts → map in
     `lib/auth/login-errors.ts` to "This account has been disabled".
   - `app/(app)/layout.tsx` logs `NEXT_REDIRECT` ("Layout error") and "Auth session missing"
     as errors after sign-out / account deletion → rethrow redirect errors without logging
     (would spam Sentry once it works).
   - `/admin/books/[id]` labels the 13-digit `books.isbn` column "ISBN-10".
   - supabase-js "user object from getSession() could be insecure" warning printed server-side
     on `/books/[slug]` → find the `getSession()` caller, use `getUser()`.
   - Password login never routes a brand-new account into `/onboarding/taste` (only the
     confirm-link `/callback` path does) → decide whether the dashboard card is enough.

## 3. Decisions waiting on the user

- **Task 12** — read the rewritten privacy policy and terms (`app/(public)/privacy`, `/terms`);
  they are unreviewed by a human. Say "approved" or ask for wording changes → status flips to COMPLETE.
- **Task 21** — `lib/actions` coverage is 31.8 % vs the 50 % target (13 untested action files:
  clubs, checkins, challenges, lists, friends, admin-enrichment, places, admin-import, taste,
  follows, badges, email, goals). Accept, or extend (~4 large modules to reach 50 %).
- **Task 22** — 4 `as unknown as` casts remain vs ≤ 2 (all `places_cache.data` Json round-trips).
  Recommendation: accept.

## 4. Parked, revisit later

- 54 `unused_index` advisor entries — re-check the performance advisor in **October 2026**;
  most are 061's indexes that have had no traffic yet.
- Confirm-link onboarding routing (`/callback` → `/onboarding/taste`) — needs a signup where
  the email link is actually clicked (throwaway recipe in the `playwright-dev-login` memory).
- Logged-in rate-limit checks + real place-photo upload (`place-review` 10/min,
  `place-photo` 10/h) — nothing in the Task 25 journey touched places.
- Mapbox token recovery / rotation (outside the codebase; user is contacting Mapbox support).
- Product features G3–G10 (notifications, block/mute, DNF status, Goodreads review import,
  timezone, series/editions, club discussions, avatar upload, i18n) — start with notifications
  and block/mute; several deferred items depend on those tables.

## Suggested order

1. User: section 1 (env + Sentry), then say the variables exist.
2. Claude: write the three-task ops plan from section 2 and run it one task per session.
3. User: section 3 decisions whenever convenient (they block nothing).
4. Then a product plan (section 4, last bullet).
