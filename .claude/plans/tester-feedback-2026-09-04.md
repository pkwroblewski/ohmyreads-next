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
| 1 | AI search 403 "Forbidden" in production (trailing newline in `NEXT_PUBLIC_SITE_URL`) | 🔴 Critical | Low | [x] CODE COMPLETE - Verification blocked | `lib/utils/csrf.ts`, `__tests__/lib/utils/csrf.test.ts`, `components/ai/ai-book-search.tsx` |
| 2 | Dashboard stat cards are not clickable | 🟡 Medium | Low | [x] COMPLETE | `components/ui/stat-card.tsx`, `components/dashboard/dashboard-stats.tsx` |
| 3 | Final QA | - | Low | [x] CODE COMPLETE - Verification blocked | - |

**Progress: 1/3 complete (Tasks 1 and 3 wait on the deploy + production check)**

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
- [ ] After deploy: `POST /api/ai/book-search` from the site returns 200 (user to confirm or Claude via throwaway account)

**Completed Notes:**
- Files modified: `lib/utils/csrf.ts`, `__tests__/lib/utils/csrf.test.ts`, `lib/ai/chat-error.ts` (new), `__tests__/lib/ai/chat-error.test.ts` (new), `components/ai/ai-book-search.tsx`
- Approach taken: `.map(o => o?.trim())` on `ALLOWED_ORIGINS` at module load (the redundant `.trim()` inside `isForeignOrigin` removed); new test loads the module with `NEXT_PUBLIC_SITE_URL = SITE + "\r\n"` and expects the site origin accepted / evil origin rejected. The dialog's error bubble now goes through `chatErrorMessage()`, which unwraps a JSON `{error}` body and maps Forbidden / Unauthorized to plain copy while passing the 429 text through.
- Deviations from plan: helper placed in `lib/ai/chat-error.ts` (unit-testable) instead of inline in the component.
- Issues encountered: none. csrf 16/16, chat-error 4/4, route-gates 14/14.
- Still open: the post-deploy production check (last Verify item) — needs a signed-in request from the site.

**Status:** [x] CODE COMPLETE - Verification blocked (production check after deploy)

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
- [ ] Production: dashboard Books Read card opens the shelf

**Completed Notes:**
- Files modified: none
- Approach taken: build (167 static pages), lint 0/0, typecheck clean, Vitest 67 files / 611 passed / 1 skipped (the parked fail-closed rate-limit case).
- Deviations from plan: Tasks 1–3 executed in one session on the user's "go" (two-line fixes, tester waiting).
- Issues encountered: none.
- Still open: steps 3–4 (push + deployment Ready, user re-enters `NEXT_PUBLIC_SITE_URL`) and the two production Verify items.

**Status:** [x] CODE COMPLETE - Verification blocked (deploy + production check)

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
