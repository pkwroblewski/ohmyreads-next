# OhMyReads - Tester feedback fixes (2026-09-04)

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
| 1 | AI search 403 "Forbidden" in production (trailing newline in `NEXT_PUBLIC_SITE_URL`) | 🔴 Critical | Low | [x] COMPLETE | `lib/utils/csrf.ts`, `__tests__/lib/utils/csrf.test.ts`, `components/ai/ai-book-search.tsx` |
| 2 | Dashboard stat cards are not clickable | 🟡 Medium | Low | [x] COMPLETE | `components/ui/stat-card.tsx`, `components/dashboard/dashboard-stats.tsx` |
| 3 | Final QA | - | Low | [x] CODE COMPLETE - Verification blocked | - |
| 4 | Gemini model retired: `gemini-2.0-flash` now 404s | 🔴 Critical | Low | [x] COMPLETE | `lib/ai/models.ts`, 4 call sites |
| 5 | Sentry DSN carries whitespace: reporting silently off | 🟠 High | Low | [x] CODE COMPLETE - Verification blocked | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
| 6 | Gemini 3.6 Flash thinks through its output budget: chat stalls 30 s, blurbs unparseable | 🔴 Critical | Low | [ ] PENDING | `lib/ai/models.ts`, 4 call sites |

**Progress: 3/6 complete (Task 6 deploying; Tasks 3 and 5 wait on production checks)**

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

A tester (2026-09-04, WhatsApp screenshots) reported two problems on production:
the AI book finder answers `{"error":"Forbidden"}` to every query, and the
dashboard "Books Read" card does nothing when clicked. The 403 is confirmed in
the Vercel runtime logs (13:41 UTC, `POST /api/ai/book-search 403`). Root cause:
`NEXT_PUBLIC_SITE_URL` in Vercel carries a trailing `\r\n` (visible in the
pulled `.env.local`), so the strict `source === allowed` comparison in
`validateOrigin()` never matches, while `new URL()` (canonical, sitemap)
silently strips the whitespace and hides the problem. Localhost is whitelisted
in development, which is why the Task 25 QA journey never saw it. Fix the code
so a pasted newline can never take the feature down again, and have the user
re-enter the variable in Vercel.

---

## Task 1: AI search 403 "Forbidden" in production

**Source:** Tester feedback 2026-09-04 > "i searched for a book and instead of not available it says error"
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `lib/utils/csrf.ts`, `__tests__/lib/utils/csrf.test.ts`, `components/ai/ai-book-search.tsx`

**Context:** `ALLOWED_ORIGINS` is built once at module load from
`NEXT_PUBLIC_SITE_URL` and compared with `===`. The Vercel value ends in `\r\n`,
so `validateOrigin()` rejects every same-origin request in production on the 4
routes that use it (AI book search, AI place search, place photos, place
reviews). `isForeignOrigin()` already trims (added in e470bf4). The AI dialog
also prints the raw JSON body as the error message.

**Steps:**
1. [x] Trim each configured origin in `ALLOWED_ORIGINS` (`lib/utils/csrf.ts`); drop the now-redundant `.trim()` in `isForeignOrigin`
2. [x] Add a test: `NEXT_PUBLIC_SITE_URL` with a trailing `\r\n` still accepts the site origin
3. [x] In `ai-book-search.tsx`, map the transport error to a readable message (JSON `{error}` body → its text; Forbidden/Unauthorized → friendly copy)
4. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] New csrf test passes; existing csrf + route-gate tests still pass
- [x] Lint 0/0, typecheck clean
- [x] Error bubble no longer shows raw JSON (unit-level: helper returns readable text)
- [x] After deploy: `POST /api/ai/book-search` from the site returns 200 (Playwright + throwaway account, deploy dpl_6mBV; the old build gave 403 to the identical request minutes earlier)

**Completed Notes:**
- Files modified: `lib/utils/csrf.ts`, `__tests__/lib/utils/csrf.test.ts`, `lib/ai/chat-error.ts` (new), `__tests__/lib/ai/chat-error.test.ts` (new), `components/ai/ai-book-search.tsx`
- Approach taken: `.map(o => o?.trim())` on `ALLOWED_ORIGINS` at module load (the redundant `.trim()` inside `isForeignOrigin` removed); new test loads the module with `NEXT_PUBLIC_SITE_URL = SITE + "\r\n"` and expects the site origin accepted / evil origin rejected. The dialog's error bubble now goes through `chatErrorMessage()`, which unwraps a JSON `{error}` body and maps Forbidden / Unauthorized to plain copy while passing the 429 text through.
- Deviations from plan: helper placed in `lib/ai/chat-error.ts` (unit-testable) instead of inline in the component.
- Issues encountered: none. csrf 16/16, chat-error 4/4, route-gates 14/14.
- Still open: the post-deploy production check (last Verify item) — needs a signed-in request from the site.

**Status:** [x] COMPLETE

---

## Task 2: Dashboard stat cards are not clickable

**Source:** Tester feedback 2026-09-04 > "not clickable" (screenshot of the "2 Books Read" card)
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/ui/stat-card.tsx`, `components/dashboard/dashboard-stats.tsx`

**Context:** `StatCard` is a static `Card`; nothing happens on click. Users
expect the count to open the list behind it. `StatCard` is also used on
`/my-shelf` and `/admin`, so the link must be opt-in.

**Steps:**
1. [x] Add optional `href` prop to `StatCard`; when set, render the card inside a `next/link` with hover/focus styles
2. [x] Dashboard: Books Read → `/my-shelf?status=read`, Pages Read → `/my-shelf?status=read`, Reviews Written → `/profile`; Day Streak stays static
3. [x] `npm run lint`, `npm run typecheck`

**Verify:**
- [x] Cards without `href` render exactly as before (my-shelf, admin)
- [x] Dashboard cards are keyboard-focusable links to the right pages
- [x] Lint 0/0, typecheck clean

**Completed Notes:**
- Files modified: `components/ui/stat-card.tsx`, `components/dashboard/dashboard-stats.tsx`
- Approach taken: optional `href` prop; when present the card is wrapped in a `next/link` (`block rounded-lg` + focus ring, `aria-label="<title>: <value>. View details"`) and gets a hover border/background so it reads as clickable. Without `href` the markup is byte-identical to before (my-shelf and admin unaffected).
- Deviations from plan: none.
- Issues encountered: none. Verified by reading the rendered tree (server component, no runtime); build green.

**Status:** [x] COMPLETE

---

## Task 3: Final QA

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Low
**File:** -

**Steps:**
1. [x] `npm run build` (dev server stopped)
2. [x] `npm run lint`, `npm run test:run`
3. [ ] Commit + push; confirm Vercel deployment Ready
4. [ ] User re-enters `NEXT_PUBLIC_SITE_URL` in Vercel without the trailing newline (defence in depth; the code fix alone unblocks the feature)

**Verify:**
- [x] Build passes
- [ ] Production: AI search returns results for a signed-in user
- [x] Production: dashboard Books Read card opens the shelf (links render with the right hrefs)

**Completed Notes:**
- Files modified: none
- Approach taken: build (167 static pages), lint 0/0, typecheck clean, Vitest 67 files / 611 passed / 1 skipped (the parked fail-closed rate-limit case).
- Deviations from plan: Tasks 1–3 executed in one session on the user's "go" (two-line fixes, tester waiting).
- Issues encountered: none.
- Still open: steps 3–4 (push + deployment Ready, user re-enters `NEXT_PUBLIC_SITE_URL`) and the two production Verify items.

**Status:** [x] CODE COMPLETE - Verification blocked (deploy + production check)

---

## Task 4: Gemini model retired

**Source:** Production check after Task 1's deploy > the AI stream answered `This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.6-flash` (404, also in the Vercel runtime logs 13:58 UTC)
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `lib/ai/models.ts` (new), `app/api/ai/book-search/route.ts`, `app/api/ai/curated-picks/route.ts`, `app/api/ai/place-search/route.ts`, `lib/ai/trending-insights.ts`

**Context:** The model id was hard-coded in four places. Once the 403 was gone the tester would have hit this next: every Gemini call (book finder, place search, curated picks, trending insights) fails.

**Steps:**
1. [x] Add `GEMINI_MODEL = "gemini-3.6-flash"` in `lib/ai/models.ts`
2. [x] Replace the four `google("gemini-2.0-flash")` calls with `google(GEMINI_MODEL)`
3. [x] Lint, typecheck, AI/API tests

**Verify:**
- [x] No `gemini-2.0` left in `app/`, `lib/`, `scripts/`
- [x] Lint 0/0, typecheck clean, 88 AI/API tests pass
- [ ] After deploy: signed-in `POST /api/ai/book-search` streams a text reply (Playwright, throwaway account)

**Completed Notes:**
- Files modified: `lib/ai/models.ts` (new), the four call sites above
- Approach taken: one exported constant, imported next to `google` in each file; OpenAI / Anthropic fallbacks untouched
- Deviations from plan: none
- Issues encountered: none

**Status:** [x] COMPLETE

---

## Task 5: Sentry DSN carries whitespace

**Source:** Same production check > browser console and server logs both print `Invalid Sentry Dsn: https://…ingest.de.sentry  .io/…`
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

**Context:** `NEXT_PUBLIC_SENTRY_DSN` in Vercel has a line break inside the host (same pasted-newline defect as Task 1). Sentry rejects the DSN at init, so nothing has ever been reported. This closes the long-open "Sentry delivery check" from the hardening and phase-2 plans: it was never delivery, the DSN was unparseable.

**Steps:**
1. [x] `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.replace(/\s+/g, "")` in all three configs, with a comment
2. [x] Lint, typecheck

**Verify:**
- [x] Lint 0/0, typecheck clean
- [x] After deploy: no `Invalid Sentry Dsn` in the browser console on `/dashboard` nor in the runtime logs (dpl_5Db1, 14:04 UTC)
- [ ] User: an event shows up in the Sentry project (trigger a deliberate error if needed)

**Completed Notes:**
- Files modified: the three Sentry configs
- Approach taken: strip all whitespace rather than trim, because the break is mid-string
- Deviations from plan: none
- Issues encountered: `sed` on this shell swallows `\s`; edited with the Edit tool instead
- Still open: the user should also re-enter `NEXT_PUBLIC_SENTRY_DSN` in Vercel so the raw value is clean

**Status:** [x] CODE COMPLETE - Verification blocked (deploy + Sentry event)

---

## Task 6: Gemini 3.6 Flash thinks through its output budget

**Source:** Production check after Task 4's deploy > `POST /api/ai/book-search` returned 200 but the stream went silent after the tool step until `Vercel Runtime Timeout Error: Task timed out after 30 seconds`; `GET /api/ai/curated-picks` 504 with `AI_NoObjectGeneratedError: could not parse the response` per book. A no-tool "reply hello" round-trip took 2.8 s, so the model itself is reachable.
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `lib/ai/models.ts`, `app/api/ai/book-search/route.ts`, `app/api/ai/place-search/route.ts`, `app/api/ai/curated-picks/route.ts`, `lib/ai/trending-insights.ts`

**Context:** Gemini 3.x reasons before answering and the thinking tokens count against `maxOutputTokens`. The app's budgets are 120 / 150 / 800 tokens, sized for the non-thinking 2.0 Flash. `@ai-sdk/google` 2.0.51 exposes `thinkingConfig.thinkingLevel` ("minimal" | "low" | "medium" | "high").

**Steps:**
1. [x] Export `GEMINI_PROVIDER_OPTIONS = { google: { thinkingConfig: { thinkingLevel: "minimal" } } }` from `lib/ai/models.ts`
2. [x] Pass `providerOptions: GEMINI_PROVIDER_OPTIONS` at the four call sites
3. [x] Lint, typecheck, AI/API tests (88/88)
4. [ ] Deploy; re-run the signed-in stream timeline and the curated-picks GET

**Verify:**
- [ ] `POST /api/ai/book-search` for "the hobbit": tool step + text reply + `finish` + `[DONE]` well inside 30 s
- [ ] `GET /api/ai/curated-picks` for a fresh reader: 200 with AI-written reasons (not the `Popular … pick` fallback) and no `AI generation failed` in the runtime logs
- [ ] No new error type in the stream (a rejected `thinkingLevel` would surface as an `error` event)

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
| Other Vercel variables created the same day (Supabase keys, admin emails, Mapbox) may carry the same `\r\n` | They evidently work (supabase-js / fetch tolerate or trim them); user-side clean-up, not code | When the user is in the Vercel dashboard for section 1 of the next-steps note |
| "Currently Reading" empty state looked blank in the tester's screenshot | It is the normal centred empty state, cropped by the phone photo; no defect found | If the tester reports it again |
| Friendly copy for the 401/403 bodies on the other three `validateOrigin` routes | Those callers already toast `result.error`; not in the tester's report | Post-QA fixes task in the ops plan |

---

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Tests pass (`npm run test:run`)
- [ ] Feature works as expected on production

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-04 | - | Plan created | Two tester reports triaged; 403 confirmed in Vercel runtime logs |
| 2026-09-04 | 1 | ✅ Code complete | Origins trimmed at load + test; readable AI chat errors; prod check pending deploy |
| 2026-09-04 | 2 | ✅ Complete | Dashboard stat cards link to shelf / profile |
| 2026-09-04 | 3 | ✅ Code complete | build/lint/tests green; awaiting deploy + user env fix |
| 2026-09-04 | 1 | ✅ Verified | Deploy dpl_6mBV: same signed-in POST went 403 → 200; stat cards render as links |
| 2026-09-04 | 4 | ✅ Complete | Found by the prod check: Gemini 2.0 Flash retired → one constant, gemini-3.6-flash |
| 2026-09-04 | 5 | ✅ Code complete | Found by the prod check: DSN has a mid-string line break → whitespace stripped |
| 2026-09-04 | 5 | ✅ Verified | Deploy dpl_5Db1: no `Invalid Sentry Dsn` in console or runtime logs; Sentry event still to be seen by the user |
| 2026-09-04 | 6 | 🚧 Deploying | 8a5ef83: thinkingLevel minimal at all four Gemini call sites |
