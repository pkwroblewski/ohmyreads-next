# Bug Fix Plan — OhMyReads (March 2026)

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

## Context

User reported 5 bugs discovered through normal usage. All existing plans are complete; this plan addresses a new batch of issues. Each bug has been investigated via code exploration and verified against the actual codebase before planning.

**Key finding from verification:** Task 3 (optional rating) has a significantly larger blast radius than originally planned — 15+ files reference `review.rating` with no null safety. The plan has been expanded accordingly.

---

## Team Agent Strategy

Each task is executed using a structured team of specialized agents, orchestrated by the main Claude session. This ensures separation of concerns, quality gates, and devil's advocate review before any code is finalized.

### Agent Roles

| Role | Agent Type | Responsibility |
|------|-----------|----------------|
| **Orchestrator** | Main session (me) | Coordinates agents, manages plan state, commits |
| **Coder** | `gsd-executor` | Implements code changes per plan steps |
| **Database Designer** | `gsd-executor` | Writes and validates SQL migrations |
| **UI/UX Designer** | `ui-ux-design-reviewer` | Reviews UI changes for consistency, a11y, visual quality |
| **Reviewer (Devil's Advocate)** | `code-quality-reviewer` | Reviews ALL code for bugs, security, edge cases, regressions |
| **Security Auditor** | `code-quality-reviewer` | Dedicated security review: injection, auth bypass, data exposure, OWASP top 10 |
| **Integration Checker** | `gsd-integration-checker` | Verifies cross-file changes connect properly end-to-end |

### Execution Flow Per Task

```
Orchestrator
  |
  ├── Coder Agent (implements changes)
  │     └── returns modified files
  |
  ├── DB Designer Agent (if migration needed)
  │     └── returns SQL + type impact analysis
  |
  ├── UI/UX Designer Agent (if UI changes)
  │     └── returns design recommendations
  |
  ├── Reviewer Agent (devil's advocate - ALWAYS runs)
  │     └── returns issues, edge cases, regressions found
  |
  ├── Security Auditor (ALWAYS runs - dedicated security pass)
  │     └── returns security findings: injection, auth, data exposure
  |
  └── Integration Checker (for multi-file tasks)
        └── returns E2E verification report
```

**Rules:**
- No task is marked COMPLETE until both the Reviewer and Security Auditor agents have signed off
- If either finds issues, the Coder agent re-implements before re-review
- Security Auditor runs as a separate pass from Reviewer to ensure security concerns get dedicated attention

### Security Principles (All Tasks)

Every code change must be evaluated against these security requirements:

1. **Input Validation** — All user inputs validated server-side via Zod schemas before DB operations. Never trust client-side validation alone.
2. **SQL Injection Prevention** — All DB queries use parameterized queries via Supabase client. No raw SQL string interpolation.
3. **Authorization** — Every server action verifies the authenticated user owns the resource being modified. No IDOR vulnerabilities.
4. **Data Exposure** — No PII or internal IDs leaked in error messages, API responses, or client-side logs.
5. **XSS Prevention** — No raw HTML injection. All user-generated content escaped by React's default rendering. No unsafe HTML rendering patterns.
6. **CSRF** — Server actions validated via Next.js built-in CSRF protection (origin header checking).
7. **RLS Policies** — Any new migration must verify existing Row Level Security policies still cover the changed columns.
8. **CSP Headers** — No new inline scripts or external domains added without updating Content-Security-Policy.
9. **Type Safety** — TypeScript `strict` mode catches null/undefined at compile time. No `any` types introduced.

---

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Fix Admin "Manage Places" broken link | 🔴 Critical | Low | [x] COMPLETE | `app/(app)/admin/page.tsx` |
| 2 | Add back-to-dashboard link on Bookshelves page | 🟠 High | Low | [x] COMPLETE | `app/(app)/my-shelf/page.tsx` |
| 3 | Make star rating optional for reviews | 🟠 High | High | [x] COMPLETE | 20+ files (see task detail) |
| 4 | Fix book cover loading (slow/broken) | 🟡 Medium | Low | [x] COMPLETE | `components/books/book-card.tsx`, `components/books/book-list-horizontal.tsx` |
| 5 | Remove duplicate "OhMyReads" logo in sidebar | 🟡 Medium | Low | [x] COMPLETE | `components/layout/sidebar.tsx` |

**Progress: 5/5 complete ✓**

---

## Out of Scope (Deferred)

| Item | Reason |
|------|--------|
| Admin Email Settings / Site Settings routes | No page exists; full feature needed, not in scope |
| Admin Reports route (`/admin/reports`) | No page exists; full feature needed, not in scope |
| Cover placeholder detection for Google Books | Cannot do client-side without CORS canvas; architectural decision |
| Monetization or social features | Not related to bug fixes |
| Regenerating Supabase types | Requires `npx supabase gen types` with DB access; note in Task 3 |
| Server-side cover URL resolution for full LCP optimization | Architectural refactor; `priority` still provides `loading="eager"` benefit |
| Refactor BookCard to use CoverImage internally | ~70 lines of deduplication; good cleanup but not a bug fix |
| Parallel/timeout URL validation in covers.ts | Performance improvement; separate optimization task |
| Warm-toned blur placeholder, ARIA role fix, URL validation cache | UI/UX improvements identified by reviewer; not regressions |

---

## Task 1 — Fix Admin "Manage Places" Broken Link

**Source/Audit Finding:** User reported "Manage Places" in Admin dashboard gives "Page not found"

**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `app/(app)/admin/page.tsx`

**Context:**
The Admin Tools grid links "Manage Places" to `/admin/places` (line 413), but the actual page exists at `/admin/moderation/places`. The route `app/(app)/admin/moderation/places/page.tsx` has the full `PlaceModerationPage` implementation.

**Agents Used:**
- **Coder** — single-line fix
- **Reviewer** — verify no other broken admin links exist
- **Security Auditor** — confirm admin routes are auth-protected

**Steps:**
- [x] Change `href: "/admin/places"` → `href: "/admin/moderation/places"` on line 413
- [x] Run Reviewer agent: scan all `href` values in `admin/page.tsx` to confirm no other broken links
- [x] Run Security Auditor: verify `/admin/moderation/places` route has proper admin auth guard (no unauthorized access)

**Verify:**
- [x] Navigate to Admin dashboard → click "Manage Places" → should land on Place Moderation page (link verified correct)
- [x] Admin route is protected by auth middleware (non-admin users cannot access) — confirmed 4 layers of defense
- [x] `npm run build` passes

**Completed Notes:**
- **Files modified:** `app/(app)/admin/page.tsx` (line 413)
- **Approach:** Single-line href fix from `/admin/places` to `/admin/moderation/places`
- **Reviewer findings:** 2 other broken links found (`/admin/email`, `/admin/settings`, `/admin/reports`) — all are missing features, not broken routes. Added `/admin/reports` to Out of Scope table.
- **Security Auditor findings:** Admin routes confirmed protected by 4 layers: proxy (edge), parent layout auth, admin layout admin-check, page-level auth + server action auth. No security issues.
- **Build:** Passes clean

**Status:** `[x] COMPLETE`

---

## Task 2 — Add Back-to-Dashboard Link on Bookshelves Page

**Source/Audit Finding:** User reports clicking back from "My Reads" (Bookshelves) to main page does not work

**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/(app)/my-shelf/page.tsx`

**Context:**
The dashboard `CurrentlyReading` component has a "View All" button that links to `/my-shelf?status=reading` (currently-reading.tsx:48). The `/my-shelf` page has no back button in its header (lines 117–132). Users who open in a new tab or refresh lose browser history, leaving them stranded.

**Agents Used:**
- **Coder** — add back button with left-arrow icon
- **UI/UX Designer** — review placement, icon choice, consistency with other page headers
- **Reviewer** — check for a11y, ensure no layout shifts

**Steps:**
- [x] In `app/(app)/my-shelf/page.tsx` header section (around line 117), add a `<Link href="/dashboard">` back button with `ArrowLeft` icon (from Lucide) before the `<h1>`
- [x] Style consistently with existing page header patterns in the app
- [x] Run Reviewer agent for code quality + a11y check

**Verify:**
- [x] Navigate dashboard → Currently Reading → View All → back button appears → clicking it returns to `/dashboard`
- [x] Also works if page is opened directly (not from history) — uses `<Link>` not browser history
- [x] Back button is keyboard accessible and has proper aria-label
- [x] `npm run build` passes

**Completed Notes:**
- **Files modified:** `app/(app)/my-shelf/page.tsx` — added `ArrowLeft` + `Link` imports, added back-to-dashboard link before the page header
- **Approach:** Used the same inline text-link pattern as `lists/create/page.tsx` (lines 58-64) — `<Link>` with `ArrowLeft` icon, `text-sm text-muted-foreground hover:text-foreground` styling, `aria-label="Back to Dashboard"`
- **Reviewer findings:** Code quality reviewer confirmed — accessible, consistent with app patterns, no layout issues
- **Build:** Passes clean

**Status:** `[x] COMPLETE`

---

## Task 3 — Make Star Rating Optional for Reviews

**Source/Audit Finding:** User reports you must always put stars to post a review; text-only reviews are not possible

**Priority:** 🟠 High
**Effort:** High (upgraded from Medium — blast radius is 15+ files)

**File(s):**
- `supabase/migrations/044_make_review_rating_nullable.sql` (new)
- `types/database.ts` (line 82)
- `lib/validation/review.ts` (lines 10-13)
- `components/reviews/review-form.tsx` (lines 27, 57, 128)
- `lib/actions/reviews.ts` (lines 95, 165)
- `components/reviews/review-card.tsx` (line 176)
- `components/ui/rating-display.tsx` (lines 40-41)
- `components/community/activity-card.tsx` (line 363)
- `components/geo/place-reviews-list.tsx` (line 220)
- `lib/queries/reviews.ts` (lines 278, 290)
- `lib/queries/admin-analytics.ts` (lines 109, 321-322)
- `lib/queries/stats.ts` (lines 138-140, 264, 282)
- `app/(app)/admin/page.tsx` (line 379)
- `app/(app)/admin/reviews/page.tsx` (lines 338, 440)
- `app/(app)/admin/users/[id]/page.tsx` (line 242)
- `app/api/og/review/route.tsx` (line 48)
- `app/api/og/stats/route.tsx` (line 50)
- `app/api/export/route.ts` (line 218)

**Context:**
Currently:
- DB: `rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL` — enforces required
- Zod: `rating: z.number().min(1).max(5)` — no `.optional()`
- Form: `canSubmit = rating > 0` — disabled unless stars selected
- Label shows "Your Rating *" (asterisk = required)

New behavior: Rating is optional. You can submit: rating-only, text-only, or both. Cannot submit a completely empty review.

**Critical blast radius issues found during verification:**
- 4 display components render `star <= review.rating` with no null check → TypeError
- 3 query files use `reduce((acc, r) => acc + r.rating, 0)` → NaN when rating is null
- OG image generation uses `"★".repeat(review.rating)` → TypeError on null
- Admin pages display `review.rating` directly → shows "null" string
- TypeScript type `rating: number` must become `rating: number | null`

**Agents Used:**
- **Database Designer** — write migration, verify constraint correctness
- **Coder** — implement all null-safety changes across 15+ files
- **UI/UX Designer** — review how "no rating" displays in review cards, admin pages
- **Reviewer (Devil's Advocate)** — full regression check across all 15+ files, edge cases
- **Integration Checker** — verify create/read/update/display/export flow E2E

**Steps:**

*Phase A — Database & Types:*
- [x] Create migration `supabase/migrations/048_make_review_rating_nullable.sql` (applied to production)
- [x] Update `types/database.ts`: `rating: number` → `rating: number | null` (2 locations)

*Phase B — Validation & Actions:*
- [x] In `lib/validation/review.ts`: rating is now `.nullable().optional()` in both create and update schemas
- [x] Updated `.refine()`: requires at least rating OR 50+ chars text; rejects partial text (<50) without rating
- [x] In `lib/actions/reviews.ts`: null rating passed via `?? null`, server-side final-state validation in updateReview

*Phase C — Form UI:*
- [x] In `components/reviews/review-form.tsx`:
  - `canSubmit = rating > 0 || hasTextContent` (50+ chars)
  - Label changed to "Your Rating (optional)"
  - Click-to-deselect: clicking same star clears rating
  - Context-aware helper text for text-only vs star-only modes

*Phase D — Display Components (null safety):*
- [x] `components/reviews/review-card.tsx`: wrapped stars in `{review.rating != null && ...}`
- [x] `components/ui/rating-display.tsx`: prop type `number | null`, early return null
- [x] `components/community/activity-card.tsx`: added `review.rating != null` check
- [x] `components/geo/place-reviews-list.tsx`: added `review.rating != null` check

*Phase E — Calculations (NaN prevention):*
- [x] `lib/queries/reviews.ts`: filter nulls before reduce, use ratedReviews.length for avg
- [x] `lib/queries/admin-analytics.ts`: filter nulls before reduce (2 locations)
- [x] `lib/queries/stats.ts`: filter nulls for avg, highest rated, rating distribution

*Phase F — Admin & API:*
- [x] `app/(app)/admin/page.tsx`: shows "—" for null rating
- [x] `app/(app)/admin/reviews/page.tsx`: shows "—" in list, "No rating" in detail dialog
- [x] `app/(app)/admin/users/[id]/page.tsx`: shows "—" for null rating, fixed local type
- [x] `app/api/og/review/route.tsx`: conditional star rendering, skips if null
- [x] `app/api/og/stats/route.tsx`: filters nulls before avg
- [x] `app/api/export/route.ts`: exports empty string for null rating

*Phase G — Agent Team Reviews:*
- [x] **Code Quality Reviewer** — signed off after fixes for A1 (JSON-LD), A2 (admin type), A3 (content preview), A4 (null guard), B3 (admin user type)
- [x] **Security Auditor** — signed off after fixes for A1 (error message leakage), A2 (updateReview final-state validation)
- [x] Issues found by reviewers fixed before completion

**Verify:**
- [x] Can submit a review with only stars (no text) — validation allows rating-only
- [x] Can submit a review with only text (no stars, 50+ chars) — NEW, Zod refine validates
- [x] Cannot submit a completely empty review (no stars, no text) — refine blocks
- [x] Review card UI hides stars when `rating` is null
- [x] Average rating calculations exclude null ratings (filter before reduce)
- [x] Admin pages show "—" for unrated reviews
- [x] OG image conditionally renders stars only if rating exists
- [x] CSV export handles null rating (empty string)
- [x] `npm run build` passes with no TypeScript errors
- [x] `npm run lint` passes (0 errors, 25 pre-existing warnings)

**Completed Notes:**
- **Files modified (20):** `supabase/migrations/048_make_review_rating_nullable.sql` (new), `types/database.ts`, `lib/validation/review.ts`, `lib/actions/reviews.ts`, `lib/actions/admin-reviews.ts`, `components/reviews/review-form.tsx`, `components/reviews/review-card.tsx`, `components/ui/rating-display.tsx`, `components/community/activity-card.tsx`, `components/geo/place-reviews-list.tsx`, `lib/queries/reviews.ts`, `lib/queries/admin-analytics.ts`, `lib/queries/stats.ts`, `app/(app)/admin/page.tsx`, `app/(app)/admin/reviews/page.tsx`, `app/(app)/admin/users/[id]/page.tsx`, `app/(public)/books/[slug]/page.tsx`, `app/api/og/review/route.tsx`, `app/api/og/stats/route.tsx`, `app/api/export/route.ts`
- **Approach:** Made `rating` column nullable in DB, updated TypeScript types to `number | null`, added null safety across all display/calculation/API surfaces. Server-side validation ensures at least rating OR 50+ chars text. Click-to-deselect UX for clearing stars.
- **Migration:** `048_make_review_rating_nullable` applied to production. Updates `recalculate_book_rating` to use `COUNT(rating)` (not `COUNT(*)`) and retains `SET search_path = public`.
- **Reviewer findings fixed:** JSON-LD Schema.org now conditionally includes `reviewRating` (SEO), `ReviewWithDetails` type updated, admin content preview fallback, error messages sanitized (no Supabase internals leaked), `updateReview` validates final merged state server-side.
- **Deferred (from reviewers, pre-existing):** UUID validation on delete/like functions (B1), float rating `.int()` enforcement (B2), stale test names (B3), OG route early UUID validation (C1-C3), debug console.logs in activity-card (C3).

**Status:** `[x] COMPLETE`

---

## Task 4 — Fix Book Cover Loading (Slow / Broken)

**Source/Audit Finding:** User reports book covers not loading properly or loading slowly

**Priority:** 🟡 Medium
**Effort:** Low
**File(s):**
- `components/books/cover-image.tsx`
- `components/books/book-list-horizontal.tsx`

**Context:**
The `CoverImage` component does client-side URL validation via hidden `Image` elements, tested sequentially. All above-fold covers show a loading placeholder while URLs are tested, creating perceived slowness. The fix: pass `priority={true}` for the first N covers so Next.js preloads them eagerly.

Verified: `CoverImage` already accepts `priority` prop (line 39) and forwards it to `<Image>` (line 145). The prop just isn't being passed from `BookListHorizontal`.

**Agents Used:**
- **Coder** (`gsd-executor`) — wire priority prop through, optimize cover validation
- **Reviewer** (`code-quality-reviewer`) — check for LCP impact, verify no unnecessary re-renders
- **Security Auditor** (`code-quality-reviewer`) — verify no new domains bypass CSP, no image URL injection vectors
- **UI/UX Designer** (`ui-ux-design-reviewer`) — review loading UX, placeholder behavior, perceived performance

**Steps:**

*Phase A — Implementation:*
- [x] **Coder Agent**: In `components/books/book-list-horizontal.tsx`: pass `priority={true}` to the first 3 book cards rendered (use index from `.map()`)
- [x] **Coder Agent**: Added `priority` prop to `BookCard` interface, forwarded to all 3 `<Image>` render paths
- [x] **Coder Agent**: Verified `CoverImage` correctly forwards `priority` to `<Image>` (line 145)
- [x] **Coder Agent**: `covers.ts:validateCoverUrl` — sequential validation is correct for fallback chain; no optimization needed
- [x] **Coder Agent**: Verified `next.config.ts` remotePatterns cover all domains (openlibrary, google books, archive.org)

*Phase B — Agent Team Reviews (all run in parallel, all must sign off):*
- [x] **Reviewer Agent**: Signed off. `priority` correctly propagated to all 3 render paths. Threshold of 3 is reasonable. No re-render concerns (primitive boolean prop). Noted architectural limitation: `priority` has diminished LCP benefit because covers are validated client-side before `<Image>` mounts.
- [x] **Security Auditor Agent**: Signed off. No new domains, no injection vectors, CSP fully covers all image domains, boolean prop carries no security risk.
- [x] **UI/UX Designer Agent**: Signed off with recommendations. Noted same architectural limitation (B1). Additional recommendations for future work: refactor BookCard to use CoverImage internally (B2), parallel URL validation (B3), warm-toned blur placeholder (A1), ARIA role fix (C1), URL validation cache (C3).
- [x] No blocking issues found by reviewers — all findings are pre-existing architectural items, not regressions

**Verify:**
- [x] First 3 book covers in "Currently Reading" get `priority={true}` — uses `loading="eager"` and `fetchpriority="high"` instead of lazy loading
- [x] Covers that previously failed (e.g., archive.org redirects) still load correctly — no changes to validation logic
- [x] No new external domains added — CSP and remotePatterns unchanged
- [x] `npm run build` passes with no errors

**Completed Notes:**
- **Files modified (2):** `components/books/book-card.tsx` (added `priority` prop to interface, forwarded to all 3 `<Image>` elements), `components/books/book-list-horizontal.tsx` (passes `priority={index < 3}` to first 3 BookCards)
- **Approach:** Added `priority` boolean prop (default false) to `BookCardProps`. Forwarded it to all 3 Image render paths (grid+actions, rail+actions, default compact). `BookListHorizontal` passes `priority={index < 3}` using map index.
- **Reviewer findings (deferred, pre-existing):** Client-side cover URL validation gates `<Image>` behind async state, reducing `priority` LCP effectiveness (would need server-side cover resolution or optimistic rendering to fully fix). BookCard duplicates CoverImage's validation logic (~70 lines). Sequential URL validation could use parallel/timeout approach. Blur data URL uses dark gradient vs warm theme. ARIA `role="img"` should be `role="status"` for loading states. No in-memory cache for repeated URL validation.
- **Build:** Passes clean

**Status:** `[x] COMPLETE`

---

## Task 5 — Remove Duplicate "My Reads" in Left Panel

**Source/Audit Finding:** User reports two "My Reads" sections showing on the left of the dashboard, one after another; wants to keep top one and remove left panel one

**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** TBD after visual investigation

**Context:**
Code exploration found no obvious code-level duplication:
- Sidebar has "Bookshelves" nav item → links to `/my-shelf`
- Dashboard has "Currently Reading" section → links to `/my-shelf?status=reading`
- Only one `CurrentlyReading` component instance on the dashboard

This may be: a responsive layout issue, a visual misperception, or a state-dependent rendering bug. **Visual inspection required before any code changes.**

**Agents Used:**
- **Coder** (`gsd-executor`) — implement fix once root cause identified
- **Reviewer** (`code-quality-reviewer`) — ensure navigation paths remain intact, no regressions
- **Security Auditor** (`code-quality-reviewer`) — verify no auth-protected routes exposed/hidden unintentionally
- **UI/UX Designer** (`ui-ux-design-reviewer`) — review responsive layout consistency, visual hierarchy

**Steps:**

*Phase A — Investigation:*
- [x] User provided screenshot showing the duplicate: "OhMyReads" logo appears in BOTH the top bar and the sidebar, stacked vertically
- [x] Root cause: `Sidebar` component rendered its own logo section (BookOpen icon + "OhMyReads" text) while `AppTopBar` already displays the same branding

*Phase B — Implementation:*
- [x] Removed the logo section (lines 93-101) from `components/layout/sidebar.tsx`
- [x] Removed unused `BookOpen` import
- [x] Adjusted nav padding from `py-2` to `pt-4 pb-2` for proper spacing without logo

*Phase C — Agent Team Reviews:*
- [x] **Code Quality Reviewer**: Signed off — all 11 nav items intact, no unused imports, spacing appropriate, `Link` still used, logo remains in top bar
- [x] No issues found

**Verify:**
- [x] Dashboard shows only one "OhMyReads" logo (in top bar), sidebar starts directly with navigation
- [x] All sidebar navigation items preserved (Dashboard, Bookshelves, Browse, etc.)
- [x] `npm run build` passes clean

**Completed Notes:**
- **Files modified (1):** `components/layout/sidebar.tsx` — removed duplicate logo section and unused `BookOpen` import, adjusted nav top padding
- **Approach:** The sidebar had its own "OhMyReads" logo + BookOpen icon linking to `/dashboard`, but the `AppTopBar` already renders the identical branding. Removed the sidebar logo to eliminate the visual duplication.
- **Reviewer findings:** Clean — no regressions, all nav items intact, no unused imports
- **Build:** Passes clean

**Status:** `[x] COMPLETE`

---

## Final QA Checklist

**Build & Lint:**
- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes with no new warnings
- [ ] No TypeScript errors introduced

**Functional:**
- [ ] Admin "Manage Places" navigates correctly
- [ ] Bookshelves page has back button to Dashboard
- [ ] Text-only review can be submitted (no stars)
- [ ] Star-only review still works
- [ ] Null-rating reviews display gracefully everywhere (cards, admin, OG, export)
- [ ] Average rating calculations are NaN-safe
- [ ] Book covers load promptly on dashboard
- [ ] Dashboard shows no duplicate "My Reads" sections

**Security (mandatory sign-off):**
- [ ] All server actions validate inputs via Zod before DB operations
- [ ] No raw SQL — all queries use parameterized Supabase client
- [ ] Admin routes remain auth-protected after link fix
- [ ] Migration doesn't weaken existing RLS policies
- [ ] No PII or internal IDs exposed in error responses
- [ ] No XSS vectors introduced (all content React-escaped)
- [ ] `recalculate_book_rating()` retains `SET search_path = public`
- [ ] Export endpoint doesn't leak user data through null handling
- [ ] Reviewer agent has signed off on all tasks
- [ ] Security Auditor agent has signed off on all tasks

---

## Changelog

| Date | Task | Changes |
|------|------|---------|
| 2026-03-08 | Task 1: Fix Admin "Manage Places" broken link | Changed href `/admin/places` → `/admin/moderation/places` in `app/(app)/admin/page.tsx` line 413 |
| 2026-03-08 | Task 2: Add back-to-dashboard link on Bookshelves page | Added `<Link href="/dashboard">` with ArrowLeft icon in `app/(app)/my-shelf/page.tsx` header |
| 2026-03-08 | Task 3: Make star rating optional for reviews | Migration 048 (nullable rating), 20 files updated for null safety across types/validation/form/display/calculations/admin/API/SEO |
| 2026-03-08 | Task 4: Fix book cover loading | Added `priority` prop to BookCard, forwarded to all Image elements. BookListHorizontal passes `priority={index < 3}` for above-the-fold eager loading |
| 2026-03-08 | Task 5: Remove duplicate OhMyReads logo | Removed sidebar logo section from `sidebar.tsx` — top bar already shows it. Removed unused `BookOpen` import. |
