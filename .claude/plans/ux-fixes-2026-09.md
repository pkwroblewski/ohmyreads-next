# OhMyReads - UX fixes from the 2026-09-04 review

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
| 1 | Shared Radix `Dialog` and `DropdownMenu` primitives | 🔴 Critical | Medium | [x] COMPLETE | `components/ui/dialog.tsx` (new), `components/ui/dropdown-menu.tsx` (new), `__tests__/components/ui/dialog.test.tsx` (new) |
| 2 | Migrate the three menus: shelf dropdown, shelf-card actions, Browse sort | 🔴 Critical | Medium | [x] COMPLETE | `components/books/add-to-shelf-button.tsx`, `components/books/shelf-book-card.tsx`, `components/books/book-browser.tsx` |
| 3 | Migrate the three dialogs: progress, Mood Search, custom shelves | 🔴 Critical | Medium | [x] COMPLETE | `components/books/update-progress-dialog.tsx`, `components/ai/ai-book-search.tsx`, `components/shelves/add-to-shelf-modal.tsx` |
| 4 | Mobile chrome: clip horizontal overflow, reserve nav space, Messages into the nav | 🟠 High | Medium | [x] COMPLETE | `components/messages/chat-panel.tsx`, `components/messages/chat-trigger.tsx`, `components/layout/app-shell.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/layout/sidebar.tsx`, `app/globals.css` |
| 5 | Full cover column set in feed, activity and club queries | 🟠 High | Low | [x] COMPLETE | `lib/queries/community.ts`, `components/dashboard/recent-activity.tsx`, `lib/queries/clubs.ts` |
| 6 | Muted text token passes AA | 🟠 High | Low | [x] COMPLETE | `app/globals.css`, `components/layout/sidebar.tsx`, `components/reviews/quick-rating.tsx` |
| 7 | Browse cards show the viewer's shelf status | 🔴 Critical | Medium | [x] COMPLETE | `app/api/books/search/route.ts`, `app/(public)/books/(index)/page.tsx`, `lib/queries/users.ts`, `components/books/book-browser.tsx`, `components/books/book-card.tsx`, `components/books/add-to-shelf-button.tsx`, `__tests__/app/api/books-search.test.ts` |
| 8 | Progress from the book page and dashboard, percent + "finished" | 🟠 High | High | [x] COMPLETE | `components/books/update-progress-dialog.tsx`, `components/books/reading-progress-card.tsx` (new), `components/books/book-list-horizontal.tsx`, `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/dashboard/currently-reading.tsx`, `lib/actions/books.ts`, `lib/validation/book-action.ts`, `types/app.ts`, `__tests__/lib/actions/books-reading-progress.test.ts` (new) |
| 9 | One first-run checklist instead of five empty states | 🟡 Medium | Medium | [x] COMPLETE | `app/(app)/dashboard/page.tsx`, `components/dashboard/first-run-checklist.tsx` (new), `components/dashboard/section-props.ts` (new), `components/dashboard/recent-activity.tsx`, `components/dashboard/friends-activity-section.tsx`, `components/dashboard/recommendations-section.tsx`, `components/dashboard/currently-reading.tsx`, `lib/queries/users.ts`, `__tests__/lib/queries/users.test.ts` |
| 10 | Catalog data pass: dedupe, enrich, fix broken records | 🟠 High | High | [x] COMPLETE | `supabase/migrations/069_dedupe_books.sql` (new), `supabase/checks/069_dedupe_books.dryrun.sql` (new), `supabase/checks/069_dedupe_books.check.sql` (new), `scripts/enrich-books.ts`, `lib/utils/external-book-search.ts`, production data |
| 11 | One rating per card + real result count on Browse | 🟡 Medium | Low | [x] COMPLETE | `components/books/book-card.tsx`, `components/books/book-browser.tsx`, `lib/queries/books.ts`, `app/(public)/books/(index)/page.tsx`, `__tests__/components/books/book-card-rating.test.ts` (new), `__tests__/lib/queries/books.test.ts` |
| 12 | Final QA | - | Medium | [x] CODE COMPLETE - Verification blocked | `components/ai/ai-book-search.tsx`, `lib/utils/external-book-search.ts`, `supabase/migrations/070_clean_ol_descriptions.sql` (new), `.claude/plans/ux-review-2026-09-04.md` |

**Progress: 12/12 complete — PLAN FINISHED 2026-09-05**

### ▶ Plan finished (2026-09-05)

All twelve tasks are done and pushed to `origin/main`. Task 12 carries
`CODE COMPLETE - Verification blocked` by the user's decision (option c on
2026-09-05): the signed-in production walk and the 390 px pass could not be
driven from this tooling, and the user accepted Tasks 7–9's throwaway-account
checks and Tasks 4/7/11's local 390 px checks in their place. Two production
findings from the signed-out walk were fixed on the way (Mood Search dialog
centred on desktop — verified live after deploy; Open Library wiki markup out
of the blurbs, migration 070). What is left for a future plan is the Out of
Scope table below and the "Not scheduled" findings in the review doc.

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

The 2026-09-04 UX review (`.claude/plans/ux-review-2026-09-04.md`) found that the controls readers
touch most are hand-rolled DOM with decorative ARIA, that mobile layout does not reserve space for
its own fixed chrome, that Browse cards forget what the reader already shelved, and that the
catalog shows blank covers, duplicates and one mangled record. The approach is four consolidations
plus data hygiene: one Dialog and one DropdownMenu primitive on the Radix packages already
installed, then migrate every hand-rolled menu and modal to them; fix the three mobile chrome
defects together; select the cover columns the fallback chain needs; darken one token; thread
shelf status into the grid; put progress where readers are; collapse the new-user dashboard into
one checklist; and run a catalog pass. Expected outcome: keyboard and screen-reader users can
operate every core control, nothing sits under the bottom nav, cards reflect reality, and a
first-time tester's first screen is clean.

**Ground truth gathered on 2026-09-04 (do not re-discover):**
- Radix packages present: `react-dialog` 1.1.15, `react-dropdown-menu` 2.1.16, `react-alert-dialog`. Correct usages to copy: `components/search/global-search-modal.tsx:47` (controlled Dialog, `openerRef` focus restore, `onCloseAutoFocus`), `components/layout/app-top-bar.tsx:114` (DropdownMenu), `components/layout/mobile-bottom-nav.tsx` (Dialog as bottom sheet).
- Hand-rolled today: `add-to-shelf-button.tsx:199` (`role="listbox"` over `role="option"` buttons, `focusedIndex` never moves focus), `shelf-book-card.tsx:266` (`role="menu"`), `book-browser.tsx:250` (sort), `update-progress-dialog.tsx:83`, `ai-book-search.tsx:163`, `shelves/add-to-shelf-modal.tsx` (0 Radix usages).
- `app-shell.tsx:45` already pads the app main with `pb-20 lg:pb-8`; on a 390×844 viewport the shelf card's "Update progress" row and the book page's action row still sat under the nav, and the shelf listbox opened beneath it. Chat drawer: `chat-panel.tsx:120` `fixed top-0 right-0 … translate-x-full` widens the document to 1312 px at 1280 (`document.body.scrollWidth`). Chat bubble: `chat-trigger.tsx:17` `fixed bottom-20 lg:bottom-6 right-6`.
- Cover fallback (`CoverImage` / `useCoverSrc`) needs `cover_url`, `isbn`, `open_library_cover_id`, `google_books_id`, `cover_source`; `BOOK_CARD_COLUMNS` in `lib/queries/columns.ts:27` has them. Queries selecting only `cover_url`: `lib/queries/community.ts:93` and `:214`, `components/dashboard/recent-activity.tsx:46`, `lib/queries/clubs.ts:70/167/293/329`.
- `--muted-foreground: 30 14% 48%` (`app/globals.css:27`) → 4.0:1 on cream, 4.2:1 on white. Opacity variants at `sidebar.tsx:111` (`/60`) and `quick-rating.tsx:93` (`/40`). Dark value `42 12% 68%` is fine.
- Search API (`app/api/books/search/route.ts`) selects `BOOK_CARD_COLUMNS` with `count: "exact"` and has no user context; `BookBrowser` renders `<BookCard … showActions />` and `book-card.tsx:218/317` pass no `currentStatus`; the detail page does (`books/[slug]/page.tsx:349`).
- `user_books` has `current_page`, `total_pages`, `progress_percentage` (generated types line 1566); `updateReadingProgress(bookId, currentPage, totalPages?)` at `lib/actions/books.ts:215`; `addToShelf(bookId, status)` at `:134`. The comment at `types/app.ts:135` claiming the columns are missing is stale.
- Dashboard (`app/(app)/dashboard/page.tsx:85-215`): `CurrentlyReading`, `FriendsActivitySection`, `RecommendationsSection`, `RecentActivity` each render their own `EmptyState`; `QuickActionsForNewUsers` (`:186`) renders when no `reading_stats` row and nothing "reading".
- Catalog (read-only SQL, 2026-09-04): 714 books, 14 duplicate title+author groups (13 pairs + one triple; slugs end in `-1`), 0 duplicate ISBNs, 55 without description, 155 without page count, 0 without any cover source. Card rating rule (`book-card.tsx:70`): local average wins whenever `local_ratings_count > 0`, so one reader's 5★ outranks 1k Open Library ratings.
- Existing tests to keep green: `__tests__/components/layout/mobile-bottom-nav.test.tsx`, `__tests__/components/ui/rating-a11y.test.tsx`, `__tests__/components/books/cover-image.test.tsx`, `__tests__/app/api/route-gates.test.ts`.
- Signed-in production checks: throwaway-account recipe in the `playwright-dev-login` memory (works on production; helper script must live in the project root and strip the literal `\r\n` from `.env.local` values; delete the account afterwards).

---

## Task 1: Shared Radix `Dialog` and `DropdownMenu` primitives

**Source:** UX review 2026-09-04 > X1, X2, X6 (agent C1/C2/B5)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `components/ui/dialog.tsx` (new), `components/ui/dropdown-menu.tsx` (new), `__tests__/components/ui/dialog.test.tsx` (new)

**Context:** There is no `components/ui/dialog.tsx` or `dropdown-menu.tsx`, so every author reinvented modals and menus by hand. The correct patterns already exist in the codebase (see ground truth). One styled wrapper each, then Tasks 2 and 3 migrate callers.

**Steps:**
1. [x] `components/ui/dialog.tsx`: export `Dialog`, `DialogTrigger`, `DialogContent` (Portal + Overlay `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` + Content panel, `sm:max-w-lg`, mobile `inset-x-4`), `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`. `DialogContent` accepts an optional `returnFocusTo?: React.RefObject<HTMLElement>` and wires `onCloseAutoFocus` to it (the `global-search-modal.tsx` pattern), because most callers are controlled dialogs with no Trigger.
2. [x] `components/ui/dropdown-menu.tsx`: export `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent` (Portal, `sideOffset={6}`, `collisionPadding={{ bottom: 80 }}` so menus never open under the mobile nav, `z-50`, existing `bg-card border-border shadow-lg` look), `DropdownMenuItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`. Item styling: `px-4 py-2 text-sm data-[highlighted]:bg-muted data-[state=checked]:text-primary`, destructive variant.
3. [x] Respect reduced motion: animation classes under `motion-safe:` only.
4. [x] `__tests__/components/ui/dialog.test.tsx`: opening moves focus into the dialog, Escape closes and restores focus to `returnFocusTo`, the content has `role="dialog"` + `aria-modal`; DropdownMenu: ArrowDown moves highlight, Enter selects, Escape closes.
5. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Both files export the listed parts; no caller migrated yet (that is Tasks 2–3)
- [x] New tests pass; suite green; lint 0/0
- [x] Rendered once in a throwaway page (delete after) to eyeball the overlay and the menu against the warm theme in light and dark

**Completed Notes:**
- Files modified: `components/ui/dialog.tsx` (new), `components/ui/dropdown-menu.tsx` (new), `__tests__/components/ui/dialog.test.tsx` (new, 8 tests). No caller touched.
- Approach taken: shadcn-shaped wrappers over the installed Radix packages, styled like `alert-dialog.tsx` / the top-bar menu (`bg-card border-border shadow-lg`, `rounded-xl`). `DialogContent` takes `returnFocusTo` (a `RefObject<HTMLElement | null>` so `useRef<HTMLButtonElement>(null)` fits) and `hideClose`; it renders a corner ✕ by default, sets `aria-modal="true"` explicitly (Radix relies on `aria-hidden` siblings and never sets it), and merges a caller's `onCloseAutoFocus` before its own. Mobile: `inset-x-4` (measured 16 px each side at 390 px, `scrollWidth` = viewport), `max-h-[calc(100dvh-2rem)] overflow-y-auto`. `DropdownMenuContent` defaults `sideOffset={6}` and `collisionPadding={{ bottom: 80 }}`, caps height at `--radix-dropdown-menu-available-height`; `DropdownMenuItem` has a `variant="destructive"`; `DropdownMenuRadioItem` shows a `Check` indicator and `data-[state=checked]:text-primary`. Also exported: `DialogPortal`/`DialogOverlay`, `DropdownMenuGroup`/`DropdownMenuPortal`.
- Deviations from plan: the codebase's `animate-in fade-in-0 zoom-in-95` classes are no-ops — Tailwind v4 here has no animate plugin, so those utilities generate nothing. The new primitives use the real `fade-in` / `slide-up` keyframes from `globals.css` via `motion-safe:animate-[fade-in_150ms_ease-out]` / `motion-safe:animate-[slide-up_200ms_ease-out]`. (Existing files keep their dead classes; not this task's scope.)
- Issues encountered: in tests, ArrowDown must be fired on the focused menu item, not the `role="menu"` container (Radix roving focus listens on items). Visual check done on a throwaway `app/ux-probe/page.tsx` via Playwright at 1280 and 390 px, light and dark (`.dark` class): overlay blur, card surface, primary-tinted checked radio, red destructive item all read correctly; page + screenshots deleted, dev server stopped.
- Verification: `npm run lint` 0/0, `npm run typecheck` clean, `npm run test:run` 68 files / 620 passed (1 pre-existing skip).

**Status:** [x] COMPLETE

---

## Task 2: Migrate the three menus

**Source:** UX review 2026-09-04 > X2, X6, N3 (dropdown under the nav)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `components/books/add-to-shelf-button.tsx`, `components/books/shelf-book-card.tsx`, `components/books/book-browser.tsx`

**Context:** The shelf control is the most-used control in the app and announces "listbox" then nothing. On mobile its hand-positioned `absolute top-full` panel opened beneath the bottom nav. The shelf-card actions and the Browse sort have the same class of problem.

**Steps:**
1. [x] `add-to-shelf-button.tsx`: replace the `isOpen`/`focusedIndex`/click-outside code with `DropdownMenu` + `DropdownMenuRadioGroup` (value = status) for Want to Read / Reading / Read, a separator, "Manage Shelves…" item, and, when shelved, a destructive "Remove from shelf" item. Keep the props (`bookId`, `bookTitle`, `currentStatus`), the optimistic status, the toasts, and the `AddToShelfModal` hand-off.
2. [x] `shelf-book-card.tsx:266`: the actions menu → `DropdownMenu`; trigger keeps `aria-label="Book options for {title}"`.
3. [x] `book-browser.tsx:250`: sort → `DropdownMenu` with `DropdownMenuRadioGroup`; trigger shows the current sort and gets `aria-expanded` from Radix.
4. [x] Delete the dead `handleClickOutside` / keyboard handlers.
5. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Keyboard: Tab to the shelf button, Enter opens, ArrowDown/Up moves, Enter selects, Escape closes and focus returns to the button
- [x] Screen-reader tree (Playwright snapshot): `button [expanded]` → `menu` → `menuitemradio` entries, no `listbox`
- [x] Mobile 390×844 on the book page: the menu opens *above* the trigger when there is no room below, never under the bottom nav
- [x] Choosing a status still toasts "Book marked as …" and the button label updates without reload
- [x] Lint 0/0, tests green

**Completed Notes:**
- Files modified: `components/books/add-to-shelf-button.tsx` (rewritten around `DropdownMenu`; 281 → 170 lines), `components/books/shelf-book-card.tsx` (actions menu), `components/books/book-browser.tsx` (sort). No new files; the Task 1 primitives cover everything.
- Approach taken: each hand-rolled panel became `DropdownMenu` → `DropdownMenuTrigger asChild` (the existing `Button`) → `DropdownMenuContent` with a `DropdownMenuRadioGroup` for the mutually exclusive choices (shelf status; sort) and plain `DropdownMenuItem`s for actions ("Manage Shelves…", "Add to Custom Shelf", destructive "Remove from Shelf"). Props, optimistic status, toasts, badge toasts, the login redirect on "Not authenticated" and the `AddToShelfModal` hand-off are unchanged. All `isOpen`/`focusedIndex`/`menuRef`/`sortDropdownRef` state, the three click-outside effects and the hand keyboard handler are gone (Radix owns open state, roving focus, typeahead, Escape, outside click, focus return). Chevron rotation now reads `group-data-[state=open]` on the trigger; the card's hover-only menu button stays visible while open via `lg:data-[state=open]:opacity-100`. Browse's sort trigger gained `aria-label="Sort by: …"`.
- Deviations from plan: `AddToShelfButton` no longer sets `disabled={isPending}` on the trigger — it uses `aria-busy` (spinner unchanged). Found in the browser: Radix returns focus to the trigger when the menu closes, and a disabled button cannot take focus, so every keyboard selection dropped focus on `<body>`. With `aria-busy` focus lands back on the button after Enter (verified). A repeat click during the ~2–4 s server round-trip just re-runs the idempotent action.
- Issues encountered: (1) the "Book marked as…" toast was invisible on the first probe only because the dev server's round-trip plus the Playwright call latency exceeded sonner's 4 s duration; polling from inside `page.evaluate` captured `Book marked as "Want to Read"`, `Moved to "Reading"` and the `Badge unlocked` toast. (2) Playwright's aria-snapshot yaml prints a *checked* `menuitemradio` without its name; `role=menuitemradio[name="Want to Read"]` resolves it and the DOM name is "Want to Read", so it is a snapshot rendering quirk, not a missing name. (3) One unrelated `quick-rating` test flaked at 1.1 s while the dev server was compiling; green in isolation and in the full rerun with the server stopped. (4) Cover `_next/image` proxies to Open Library timing out (504) on the dev server delayed Browse's re-fetch by ~40 s; out of scope (review N8).
- Verification (local dev, throwaway `omr-qa-…@mailinator.com` account created with `auth.admin.createUser`, deleted afterwards): book page — Tab/focus → Enter opens `menu "Add book to shelf"` with 3 `menuitemradio` + separator + `menuitem "Manage Shelves..."`, no `listbox`; ArrowDown moves focus + `data-highlighted`; Enter selects, menu closes, label → "Reading"/"Read", `aria-label` → "Current status: …", "Remove from Shelf" appears once shelved, focus back on the trigger; Escape closes with `aria-expanded="false"` and focus on the trigger. 390×844 with the trigger 8 px above the bottom nav: menu `data-side="top"`, bottom 725 px vs nav top 779 px, `scrollWidth` 390. Shelf card — trigger keeps `aria-label="Book options for Harry Potter"`, menu tree `Move to...` label → group of 3 radios (checked = current) → separator → 2 menuitems; ArrowDown+Enter flips the badge to "Reading" immediately, toasts, progress row appears, focus returns. Browse — `Sort by: Popular` trigger, 4 radios with "Popular" checked; ArrowDown×3 + Enter → URL `?sort=title`, label "Sort by: Title A-Z", grid re-sorted ('Salem's Lot, 11/22/63, …), "714 books found". `npm run lint` 0/0, `npm run typecheck` clean, `npm run test:run` 68 files / 620 passed.

**Status:** [x] COMPLETE

---

## Task 3: Migrate the three dialogs

**Source:** UX review 2026-09-04 > X1, X9 (agent C1, C6)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `components/books/update-progress-dialog.tsx`, `components/ai/ai-book-search.tsx`, `components/shelves/add-to-shelf-modal.tsx`

**Context:** Three plain `fixed` divs: no `role="dialog"`, no focus trap, no Escape, page behind stays tabbable and readable by assistive tech.

**Steps:**
1. [x] `update-progress-dialog.tsx`: wrap in `Dialog`/`DialogContent`; keep the form, `currentPage`/`totalPages` props and `onUpdated`. Pass the caller's trigger ref as `returnFocusTo` (the shelf card's "Update progress" button).
2. [x] `ai-book-search.tsx:163`: the panel becomes `DialogContent` (`sm:max-w-3xl`, full-height on mobile); `DialogTitle` "Mood Search" (one name for the feature, see Out of Scope for the rest of the copy); the two `scrollIntoView({behavior:"smooth"})` calls check `matchMedia("(prefers-reduced-motion: reduce)")` and use `"auto"` when set; focus lands in the input on open (`onOpenAutoFocus`).
3. [x] `shelves/add-to-shelf-modal.tsx`: same wrap; it is opened from the shelf menu, so `returnFocusTo` is the shelf button.
4. [x] Remove the hand-rolled overlay/close-button/Escape code from all three.
5. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Each dialog: `role="dialog"` + `aria-modal="true"` in the snapshot, Tab cycles inside, Escape closes, focus returns to the opener
- [x] Mood Search: opens from "Mood Search" on `/books`, sends a query, shows either results or the calm quota sentence (Google billing may still be off — the error path is enough to verify the dialog)
- [x] Progress dialog from a shelf card saves a page and the card's bar updates
- [x] Lint 0/0, tests green

**Completed Notes:**
- Files modified: `components/books/update-progress-dialog.tsx`, `components/ai/ai-book-search.tsx`, `components/shelves/add-to-shelf-modal.tsx` (the three dialogs); `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx`, `components/books/book-browser.tsx` (callers now hold a ref to the opener and pass `returnFocusTo`).
- Approach taken: each `fixed inset-0` div + backdrop + hand ✕ became `Dialog` → `DialogContent` from Task 1 (`p-0` so the existing header/body/footer strips keep their own padding); the `<h2>` became `DialogTitle` and the "Adding: …" / book-title strip became `DialogDescription`, so every dialog has an accessible name and description. The `if (!open) return null` early returns are gone — Radix mounts the content only while open, which also keeps the progress form's "mount fresh, re-seed from props" behaviour with no effect. All three components take an optional `returnFocusTo` ref. Mood Search: `DialogTitle` "Mood Search" (was "AI Book Finder"), `onOpenAutoFocus` puts focus in the input (replaces the 100 ms `setTimeout` effect), `onOpenChange(false)` routes through the existing `handleClose` so the chat resets, both `scrollIntoView` calls go through a `scrollBehavior()` helper that returns `"auto"` under `prefers-reduced-motion: reduce`, and the content is a full-screen sheet below `sm` (`inset-x-0 top-0 h-dvh rounded-none`) and the old 700 px / 85 vh / `max-w-3xl` panel above. Custom shelves: the new-shelf input's own Escape handler moved to `onEscapeKeyDown` on the content (Radix listens in the capture phase, so an input-level handler could not stop the dialog closing) — Escape while naming a shelf backs out of that step only.
- Deviations from plan: none material. The corner close buttons are now the primitive's (`aria-label="Close"` instead of "Close AI book finder" / "Close dialog"); no test referenced the old labels.
- Issues encountered: (1) While a dialog is open the app root `div.min-h-screen` is *not* `aria-hidden` on the book page. Traced to `aria-hidden@1.2.6` (Radix's dependency): it keeps every `[aria-live]` element **and its ancestors** visible and hides the rest at that depth — the book page has a polite `sr-only` live region, so 22 descendants (header, aside, h1, …) get hidden instead of the root. On the shelf page (no live region) the root itself is hidden. Intended library behaviour, not a bug; the menu → dialog handoff was also checked and keeps the root hidden throughout. (2) Playwright's aria-snapshot prints `dialog` without its name even though `aria-labelledby` resolves ("Add to Shelves", "Update Progress", "Mood Search") — same rendering quirk as Task 2's checked radio. (3) Browse at 390 px has `scrollWidth` 413 with no dialog open — pre-existing horizontal overflow for Task 4. (4) The book has no page count, so the progress bar stays at 0 % after saving page 42 — Task 10 data.
- Verification (local dev, throwaway account, deleted afterwards): **Custom shelves** from the book page's shelf menu → `role="dialog"`, `aria-modal="true"`, name "Add to Shelves", description "Adding: Harry Potter", focus inside; five real Tabs across the four tabbables (Create your first shelf, Cancel, Save, Close) stayed inside and wrapped; Escape closed it and focus landed on the shelf button. Same from the shelf card's menu. **Progress** from the shelf card's button → name "Update Progress", description "Harry Potter", focus on `#current-page`; saved 42 → toast "Progress updated", dialog closed, card reads "Page 42", focus back on the progress button. **Mood Search** from `/books` → name "Mood Search", description "Describe what you want to read", focus in the input, sent "a cozy mystery in a small village" → user bubble, then the error box "Something went wrong. Please try again." (server: `No AI API key configured`, 500 — the expected local error path; the quota sentence needs prod's Gemini key); Escape → closed, focus on the Mood Search button, chat reset to the welcome bubble; at 390×844 the sheet measures 0,0,390,844. `npm run lint` 0/0, `npm run typecheck` clean, `npm run test:run` 68 files / 620 passed.

**Status:** [x] COMPLETE

---

## Task 4: Mobile chrome — clip overflow, reserve nav space, Messages into the nav

**Source:** UX review 2026-09-04 > N2, N3, N4, I1, P2
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `components/messages/chat-panel.tsx`, `components/messages/chat-trigger.tsx`, `components/layout/app-shell.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/layout/sidebar.tsx`, `app/globals.css`

**Context:** Every signed-in desktop page scrolls horizontally because the closed chat drawer still occupies layout width; on mobile the floating Messages bubble covers content and the bottom nav covers the last row of every page; Messages is in no navigation at all.

**Steps:**
1. [x] `chat-panel.tsx`: while closed, add `invisible pointer-events-none` (keeps the slide-in animation) and put `overflow-x: clip` on `body` in `globals.css` as the backstop. Confirm `document.body.scrollWidth === clientWidth` at 1280.
2. [x] `app-shell.tsx:45`: replace `pb-20` with `pb-[calc(5rem+env(safe-area-inset-bottom))]` and add `scroll-padding-bottom` for anchor jumps; check the book page action row and the shelf card row at 390×844 no longer sit under the nav at any scroll position.
3. [x] Messages into the nav: `components/messages/chat-wrapper.tsx:98` owns the panel's open state (renders `ChatTrigger` + `ChatPanel`); expose `openChat` + `unreadCount` through a small context from there; add a "Messages" item with the unread badge to the sidebar's Social section and to `overflowItems` in `mobile-bottom-nav.tsx` (rendered as a button, not a link); add Map and About to `overflowItems` while there.
4. [x] `chat-trigger.tsx`: hide on mobile (`hidden lg:flex`) now that the sheet has the entry; on desktop keep `bottom-6`.
5. [x] `mobile-bottom-nav.tsx:77`: the More sheet's `bottom-16` gains the safe-area inset.
6. [x] Update `__tests__/components/layout/mobile-bottom-nav.test.tsx` for the new items.
7. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Desktop 1280: no horizontal scrollbar on `/dashboard`, `/my-shelf`, `/books`; `scrollWidth === clientWidth`
- [x] Mobile 390×844: book page "Add to Shelf" row, shelf card "Update progress", dashboard CTAs all reachable and unobstructed; no floating bubble
- [x] More sheet lists Messages (with badge when unread > 0), Map, About; tapping Messages opens the panel
- [x] Sidebar shows Messages with the badge; existing nav test green
- [x] Lint 0/0, tests green

**Completed Notes:**
- Files modified: `components/messages/chat-context.tsx` (new: `ChatPanelContext` + `useChatPanel()`), `components/messages/chat-wrapper.tsx` (now the provider; accepts `children`), `components/messages/index.ts`, `components/messages/chat-trigger.tsx`, `components/messages/chat-panel.tsx`, `components/layout/app-shell.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/layout/sidebar.tsx`, `app/globals.css`, `__tests__/components/layout/mobile-bottom-nav.test.tsx` (13 links, Messages button with badge and `openChat`, no-provider fallback; 6 tests).
- Approach taken: **Overflow** — the closed drawer gets `invisible pointer-events-none` (with `transition-[transform,visibility]` so the slide-out still plays and, once closed, it leaves layout, the tab order and the accessibility tree); `body { overflow-x: clip }` is the backstop. **Nav space** — the app main's bottom padding is `calc(5rem + env(safe-area-inset-bottom))` below `lg`, and `html { scroll-padding-bottom }` (same value, `max-width: 1023px`) makes anchor jumps and `scrollIntoView` land above the nav. **Messages in the nav** — `ChatWrapper` wraps the whole `AppShell` and provides `{ openChat, unreadCount }`; the sidebar's Social section ends with a Messages button carrying the unread badge, and the More sheet has a Messages button (closes the sheet, opens the panel) plus Map (`/community/map`) and About (`/about`) links. Outside a provider the hook returns a no-op with no badge, so nothing changes for anonymous pages or tests. **Bubble** — `ChatTrigger` is `hidden lg:flex`, `bottom-6`. **Sheet** — `bottom-[calc(4rem+env(safe-area-inset-bottom))]` replaces `bottom-16` + the inner `pb-[env(...)]`; its dead `animate-in` classes became `motion-safe:animate-[slide-up_200ms_ease-out]`. `window.openChat` is still set for `friend-button.tsx`.
- Deviations from plan: `chat-wrapper.tsx:98` no longer *renders* the trigger beside the panel only — it wraps the shell, so a context reaches the sidebar and bottom nav (they render before the chat in `AppShell`). `(public)/layout.tsx`'s anonymous-branch `ChatWrapper` is untouched (`children` is optional).
- Issues encountered: (1) Browse at 390 px still lays out 23 px too wide (`document.body.scrollWidth` 413): the book card's action row (`flex gap-2` holding the "Buy Local" link) does not wrap. The body clip stops the sideways scroll (`scrollTo(50, 0)` leaves `scrollX` at 0) but the root cause lives in `book-card.tsx`, which Tasks 7 and 11 edit — add `flex-wrap`/`min-w-0` there. Dashboard's 8 px is its own `overflow-x-auto` rail, harmless. (2) Tailwind v4 emits `translate-x-full` as the `translate` property, so `getComputedStyle(...).transform` reads `none` — measure `getBoundingClientRect` instead. (3) `/community/map` also lights the primary Social item (`/community` prefix match) — cosmetic; the nav-manifest refactor is already deferred (I2/I4).
- Verification (local dev, throwaway account, deleted afterwards). **Desktop 1280×800**: `/dashboard`, `/my-shelf`, `/books` all `scrollWidth === clientWidth` (1270 with the vertical scrollbar, 1280 without); closed drawer `visibility: hidden`, `pointer-events: none`, left edge at 1270 (off-screen); bubble `display: flex` 24 px from the bottom; sidebar "Messages" button opens the panel (visible, 384 px wide, document still 1270) and its ✕ hides it again. **Mobile 390×844**: bubble `display: none`; book page — content wrapper `padding-bottom: 80px`, `scroll-padding-bottom: 80px`, shelf button 15 px above the nav after `scrollIntoView({block: "end"})`, no overflow (380); shelf card — "Update progress" row 35 px above the nav at max scroll, 16 px after scroll-into-view; dashboard — lowest interactive element 60 px above the nav, none beneath it; More sheet — 13 links (… Book Clubs, Map, Challenges, … Settings, About) + "Messages" button, sheet bottom 780 px on nav top 779 px, tapping Messages closes the sheet and opens the full-width panel, ✕ hides it. `npm run lint` 0/0, `npm run typecheck` clean, `npm run test:run` 68 files / 622 passed.

**Status:** [x] COMPLETE

---

## Task 5: Full cover column set in feed, activity and club queries

**Source:** UX review 2026-09-04 > N5
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `lib/queries/community.ts`, `components/dashboard/recent-activity.tsx`, `lib/queries/clubs.ts`

**Context:** "image not available" appears for books that render fine everywhere else, because these queries select only `cover_url` and the fallback chain has nothing to fall back to.

**Steps:**
1. [x] Add `COVER_COLUMNS = "id, title, author, slug, cover_url, isbn, google_books_id, open_library_cover_id, cover_source"` to `lib/queries/columns.ts` (or reuse `BOOK_CARD_COLUMNS` where the payload size does not matter).
2. [x] `community.ts:93` and `:214`, `clubs.ts:70/167/293/329`, `recent-activity.tsx:46`: select it; widen the `book` types in those files and in `types/app.ts` accordingly.
3. [x] `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Dashboard Recent Activity and `/community` show covers for The Hobbit / Harry Potter (books whose `cover_url` is null)
- [x] Club pages still render; typecheck clean; tests green

**Completed Notes:**
- Files modified: `lib/queries/columns.ts` (new `BOOK_COVER_COLUMNS`), `lib/queries/community.ts` (both feed joins + the popular-books select), `lib/queries/clubs.ts` (all four `book:books(...)` joins), `components/dashboard/recent-activity.tsx`, `types/app.ts` (new `BookCoverSummary`; `ActivityFeedItemWithRelations.book` and `BookClubReadWithBook.book` use it), `components/clubs/club-card.tsx`, `app/(public)/clubs/[slug]/page.tsx`, `__tests__/components/community/activity-card.test.tsx` (fixture widened).
- Approach taken: one projection, `BOOK_COVER_COLUMNS = "id, title, author, slug, cover_url, isbn, google_books_id, open_library_cover_id, cover_source"`, interpolated into every embedded join that used to select `cover_url` alone; one shared `BookCoverSummary` type instead of four inline copies. Two consumers were throwing the new fields away, so they were fixed too: `club-card.tsx` built `{ title, cover_url }` by hand for `CoverImageMini` and now passes the whole book, and the club page rendered a raw `<img src={cover_url}>` (nothing at all when null) for the current read and past reads — both are `CoverImage` now, sized as before (64×96, 40×60), so the club page gets the fallback chain as well.
- Deviations from plan: `types/app.ts` — only the two types the changed queries feed were widened; `CheckinWithRelations.book` and `ReadingListBookWithBook.book` keep their `cover_url`-only shape because their queries were not in scope. `club-card.tsx` and the club page were not in the file list but were needed for the new columns to reach the screen.
- Issues encountered: (1) The review's premise was slightly stale: `harry-potter-1` and `the-hobbit` both *have* a `cover_url` now (checked with `supabase db query`). The real failure is a `cover_url` whose image 404s/500s (Open Library ISBN covers do that regularly, and the dev image proxy adds 504s) — with `cover_url` alone the chain had one candidate and fell to the placeholder; now it continues to Google Books. (2) `useCoverSrc` orders candidates OL-cover-id → ISBN → `cover_url` → Google Books, so the rendered `src` reveals which columns the component received.
- Verification (local dev, throwaway account, deleted afterwards): shelved Harry Potter as Reading. **Dashboard Recent Activity** — the ISBN cover came back 500 from the dev proxy, the chain moved on and the mini cover loaded from `books.google.com/books/content?id=fmc00AEACAAJ` (`naturalWidth` 40, no placeholder). **`/community`** — 48 images, 0 failed; Harry Potter entries resolved to the ISBN URL (loaded) or Google Books, The Hobbit to Google Books. **`/clubs/readers-paradise`** — page renders, current read *Atomic Habits* cover loads through `CoverImage` from Google Books (the club has no past reads). `npm run typecheck` clean, `npm run lint` 0/0, `npm run test:run` 68 files / 622 passed.

**Status:** [x] COMPLETE

---

## Task 6: Muted text token passes AA

**Source:** UX review 2026-09-04 > X3 (agent A1)
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/globals.css`, `components/layout/sidebar.tsx`, `components/reviews/quick-rating.tsx`

**Context:** `--muted-foreground` colours every author name, date, description and count and measures 4.0:1 on the cream background.

**Steps:**
1. [x] `globals.css:27`: `--muted-foreground: 30 14% 42%`; compute contrast against `--background` and `--card` with a 10-line node script (WCAG relative luminance) and record the numbers.
2. [x] Grep `text-muted-foreground/` and raise anything used for text (not decoration) to at least `/80`; `sidebar.tsx:111` section labels → solid token with `uppercase tracking-wide`; `quick-rating.tsx:93` unrated stars keep `/40` only if the control also has a visible label (it is decorative once labelled).
3. [x] Screenshot home, Browse, dashboard in light and dark before/after.

**Verify:**
- [x] Light: token ≥ 4.5:1 on both `--background` and `--card`; dark unchanged
- [x] No text-bearing element left below 4.5:1 among the `/xx` variants
- [x] Visual check: still reads as "muted", not as body text

**Completed Notes:**
- Files modified: `app/globals.css` (`--muted-foreground: 30 14% 42%` + a comment with the measured ratios), `components/layout/sidebar.tsx` (section labels → solid token), `components/reviews/quick-rating.tsx` (unrated stars `/40` → `/80`), `components/books/book-card.tsx` (two placeholder titles `/60` → solid), `components/books/cover-image.tsx` (placeholder title `/80` and author `/60` → solid), `components/geo/map-context-panel.tsx` (two inactive Directions/Website tiles `/50` → solid), `components/geo/map-detail-panel.tsx` (inactive Website tile `/50` → solid), `components/settings/export-section.tsx` (format notes `/70` → solid).
- Approach taken: WCAG relative-luminance script over the HSL tokens (`node -e`, 10 lines). At 48 % the token measured **3.97:1** on `--background`, **4.11:1** on `--card`, **3.64:1** on `--muted`; at 42 % it measures **4.96 / 5.13 / 4.55**. The same script showed that *no* opacity variant of the new token passes: `/80` = 3.35 on the background, 3.43 on the card, 3.15 on muted, so "raise to at least `/80`" cannot satisfy the Verify line — every text-bearing site was moved to the solid token instead. The remaining `/xx` uses are icons and display-only star outlines (decorative). Dark value untouched: `42 12% 68%` = 8.72 / 8.07 / 7.60.
- Deviations from plan: (1) text-bearing variants went to the solid token rather than `/80` (above). (2) `quick-rating.tsx` has an `aria-label` and a live region but no *visible* label, so its unrated star outlines are a UI-component boundary, not decoration; they are `/80`, which clears the 3:1 non-text minimum (3.35) while staying lighter than the filled gold. (3) Sidebar labels already had `uppercase tracking-wider`; only the opacity changed.
- Issues encountered: (1) During the "after" capture Browse rendered **0 books** with the curated genre fallback. Cause, not this task: a 10 s Supabase connect timeout (`ConnectTimeoutError … supabase.co:443`, 17:17 in the dev log) hit `fetchPopularBooks` / `fetchAllGenres`, both of which return `[]` on error, and `unstable_cache` then keeps that empty array for its 1 h `revalidate`. One network blip blanks Browse's default load (and the genre pills) for up to an hour. Added to Out of Scope with the fix. The after capture was retaken via `/books?sort=title`, which goes through the uncached `searchBooks` path. (2) `review-form.tsx:146` uses `/30` for the unrated stars of a rating *input* (same class of issue as quick-rating); not in this task's file list — Out of Scope, a11y polish.
- Verification: in-browser computed colour of a muted `<p>` on the dashboard is `rgb(122, 107, 92)` → **4.97:1** on the page background, **5.14:1** on a card; sidebar "Main" label **5.14:1** on the sidebar surface; dark unchanged (`rgb(183, 177, 164)`). Before/after screenshots of home, Browse and dashboard in light and dark were compared: author names, dates, counts and section labels are darker but still read as secondary against headings and body text. `npm run lint` 0/0, `npm run typecheck` clean, `npm run test:run` 68 files / 622 passed. Screenshots and the throwaway account were deleted.

**Status:** [x] COMPLETE

---

## Task 7: Browse cards show the viewer's shelf status

**Source:** UX review 2026-09-04 > L1 (agent B1)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `app/api/books/search/route.ts`, `app/(public)/books/(index)/page.tsx`, `lib/queries/users.ts`, `components/books/book-browser.tsx`, `components/books/book-card.tsx`, `components/books/add-to-shelf-button.tsx`, `__tests__/app/api/books-search.test.ts`

**Context:** A reader adds a book from Browse, gets a toast, and the card still says "Add to Shelf". `AddToShelfButton` supports `currentStatus`; the grid never passes it.

**Steps:**
1. [x] Search route: after the books query, if `getUser()` returns a user, fetch `user_books.select("book_id, status").eq("user_id", user.id).in("book_id", ids)` and return `shelfStatuses: Record<bookId, status>` alongside `books`/`count`. Anonymous callers get `{}` and keep the shared cache; a signed-in response answers `Cache-Control: private, no-store`.
2. [x] `book-browser.tsx`: keep `shelfStatuses` in state (merge on Load More), pass `currentStatus={shelfStatuses[book.id] ?? null}` to `BookCard`; when `AddToShelfButton` changes status, update the map through an `onStatusChange` callback.
3. [x] `book-card.tsx`: add `currentStatus?: BookStatus | null` and `onStatusChange?` props; forward to both `AddToShelfButton` sites.
4. [x] Home rails (`BookListHorizontal`, curated/trending) left Out of Scope — they render `BookCard` without `showActions`, so no shelf button appears there at all.
5. [x] New `__tests__/app/api/books-search.test.ts` covers the anonymous vs signed-in shape and the cache header.
6. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Signed in: shelve a book from Browse → card label becomes the status in place; reload → still shows it; other cards unaffected
- [x] Signed out: cards still say "Add to Shelf" and the API returns `shelfStatuses: {}` with `Cache-Control: public`
- [x] Search response time unchanged within noise (one extra indexed `IN` query)
- [x] Lint 0/0, typecheck clean, 625 tests green

**Completed Notes:**
- Files modified:
  - `lib/queries/users.ts` — new `getShelfStatuses(userId, bookIds)` returning a `bookId → status` map from one `(user_id, book_id)` lookup
  - `app/api/books/search/route.ts` — `shelfStatuses` in the payload; `private, no-store` for a signed-in caller, the old public CDN header for an anonymous one
  - `app/(public)/books/(index)/page.tsx` — seeds `initialShelfStatuses` server-side for the SSR'd first page
  - `components/books/book-browser.tsx` — `shelfStatuses` state, replaced on search, merged on Load More, updated by the cards
  - `components/books/book-card.tsx` — `currentStatus` / `onStatusChange` props forwarded to both `AddToShelfButton` sites (also passes `bookTitle`, which the custom-shelf modal wanted)
  - `components/books/add-to-shelf-button.tsx` — optional `onStatusChange` fired on shelve and on remove
  - `__tests__/app/api/books-search.test.ts` — 3 route tests
- Approach taken: the status map travels two ways. The browse page reads it during the server render so a reload never flashes "Add to Shelf" on a shelved book, and the search route returns it so every client-side search and Load More stays correct. The cached book list itself is untouched; only the per-viewer labels are dynamic.
- Deviations from plan: three files beyond the plan's list. The page had to seed the map (step 2 alone leaves the SSR'd first page wrong until the reader searches), which needed the shared query in `lib/queries/users.ts`, and the callback needed a prop on `AddToShelfButton`. The plan's `ShelfStatus` name is the existing `BookStatus` union in `types/app.ts`, reused rather than duplicated. The public cache header had to become conditional — leaving it would have put one reader's shelf into a shared CDN entry.
- Issues encountered: local network to Supabase was degraded during the browser QA (repeated 10s `UND_ERR_CONNECT_TIMEOUT`), so each Server Action took 15–32s; the behaviour is correct, just slow to observe. Verified signed-in with a throwaway `omr-qa-task7@mailinator.com` account (deleted afterwards): shelved a card → label flipped in place, reload kept it, `/api/books/search` returned the map with `private, no-store`, Load More appended 20 more cards and kept the shelved label. Unrelated pre-existing dev artifact: the unfiltered `/books` view showed "0 books found" from a stale `unstable_cache` entry for `getPopularBooks`; `?sort=newest` (714 books) was used instead.

**Status:** [x] COMPLETE

---

## Task 8: Progress from the book page and dashboard, percent + "finished"

**Source:** UX review 2026-09-04 > L2, L3 (agent B2)
**Priority:** 🟠 High
**Effort:** High
**File(s):** `components/books/update-progress-dialog.tsx`, `components/books/reading-progress-card.tsx` (new), `components/books/book-list-horizontal.tsx`, `components/books/shelf-book-card.tsx`, `components/books/add-to-shelf-button.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/dashboard/currently-reading.tsx`, `lib/actions/books.ts`, `lib/validation/book-action.ts`, `types/app.ts`, `__tests__/lib/actions/books-reading-progress.test.ts` (new)

**Context:** Progress is only reachable from the shelf card (dashboard → Shelf → card → dialog), is page-numbers only, and has no "finished" shortcut. StoryGraph and Fable treat percent as first-class; audiobook readers have no page number.

**Steps:**
1. [x] Dialog: Pages / Percent toggle (percent stores `progress_percentage` and, when a total is known, derives `current_page`); `totalPages` prefilled from `books.page_count` by the callers; "Mark as finished" calls `addToShelf(bookId, "read")` and closes; "Clear progress" sends percent 0.
2. [x] `updateReadingProgress` now takes `{ bookId, currentPage?, totalPages?, percent? }` (validated in `book-action.ts`); the one caller, the dialog, was updated with it.
3. [x] Book page: `getUserBookStatus` already selects `*`, so the row carried the three columns; when status is `reading` the page renders the progress row under the action buttons.
4. [x] Dashboard `CurrentlyReading`: passes a `progressByBookId` map to `BookListHorizontal`, which renders `ReadingProgressCard` under each cover; "View All" unchanged.
5. [x] Deleted the stale comment (and the dead `ReadingProgressHistory` interface it described) at `types/app.ts`.
6. [x] 17 tests: the schema (pages vs percent, bounds, refinement) and the action's derived fields.
7. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] From the dashboard: one tap opens the dialog, saving updates the bar without reload (`p. 120 of 449 · 27%`, bar 27%)
- [x] From the book page: same; "Mark as finished" moves the book to Read, the row retires and the shelf button next to it becomes "Read"; the dashboard stats card read 2 books / 449 pages afterwards
- [x] Percent entry without a page count stores the percent and shows "39%" only (`current_page` null, `progress_percentage` 39)
- [x] Shelf card path still works (page 300 → 67%, then "Clear progress" → 0%); lint 0/0, typecheck clean, 642 tests green

**Completed Notes:**
- Files modified:
  - `lib/validation/book-action.ts` — `updateReadingProgressSchema` takes an optional page, total and percent, refined to require at least one of page or percent
  - `lib/actions/books.ts` — `updateReadingProgress` takes one input object; percent wins when both arrive; the missing side is derived from the effective total (passed in, then stored, then `books.page_count`); `currentPage` can now come back null
  - `components/books/update-progress-dialog.tsx` — Pages / Percent toggle, derived-page hint, "Mark as finished", "Clear progress", `percent` and `onFinished` props
  - `components/books/reading-progress-card.tsx` (new) — the bar, the position line and the dialog trigger, in `row` (book page) and `compact` (dashboard rail) variants
  - `components/books/book-list-horizontal.tsx` — optional `progressByBookId`; rails that pass nothing are unchanged
  - `components/dashboard/currently-reading.tsx` — builds that map from the rows it already fetched
  - `app/(public)/books/[slug]/page.tsx` — the progress row under the action buttons for a book being read
  - `components/books/shelf-book-card.tsx` — passes `percent` and the `books.page_count` fallback, and follows "Mark as finished"
  - `components/books/add-to-shelf-button.tsx` — status is now derived state, so a refreshed server render wins over a stale local choice
  - `types/app.ts` — dropped the stale comment and the dead `ReadingProgressHistory` interface
- Approach taken: one client island, `ReadingProgressCard`, is the whole feature wherever a currently-reading book appears, so the book page and the dashboard rail each reach the dialog in one tap and the shelf card keeps the bar it already had. The action became the single place that reconciles pages and percent, which is what let the dialog offer both without either caller doing arithmetic.
- Deviations from plan: five files beyond the plan list. Step 3 query change was unnecessary (`getUserBookStatus` already selects `*`). The positional action signature was dropped rather than kept, which the plan allowed, since the dialog was its only caller. `BookListHorizontal` takes a data map rather than being rewritten, so the book page related-books rail is untouched. Two additions the plan did not anticipate: `AddToShelfButton` had to derive its status from props, and the progress card calls `router.refresh()` after finishing — without both, "Mark as finished" on the book page left the shelf button next to it still reading "Reading" until a manual reload (found in QA, fixed, re-verified). The dead `ReadingProgressHistory` interface went with its stale comment.
- Issues encountered: none blocking. The action test needed the per-query `thenableQuery` double rather than the flat `createMockSupabase`, because the action reads and then writes through `from("user_books")` and the two need different answers; the write is identified by the recorded `update` call. Verified signed-in with a throwaway `omr-qa-task8@mailinator.com` account (deleted afterwards) against two seeded books, one with a page count and one without.

**Status:** [x] COMPLETE

---

## Task 9: One first-run checklist instead of five empty states

**Source:** UX review 2026-09-04 > L4 (agent A4)
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `app/(app)/dashboard/page.tsx`, `components/dashboard/first-run-checklist.tsx` (new), `components/dashboard/section-props.ts` (new), `components/dashboard/recent-activity.tsx`, `components/dashboard/friends-activity-section.tsx`, `components/dashboard/recommendations-section.tsx`, `components/dashboard/currently-reading.tsx`, `lib/queries/users.ts`, `__tests__/lib/queries/users.test.ts`

**Context:** A brand-new reader sees a greeting, four zero stat cards, then five stacked empty states with "Browse Books" three times and "Import from Goodreads" twice.

**Steps:**
1. [x] `first-run-checklist.tsx` (server component): one card, three checkable rows — Add your first book (`/books`), Set up your taste profile (`/onboarding/taste`), Follow a reader (`/community`) — plus an "Import from Goodreads" shortcut in the card footer. Progress reads "1 of 3 done". Data comes from `getFirstRunChecklist()` in `lib/queries/users.ts`.
2. [x] Dashboard page: fetches the checklist alongside the profile, challenges and friend requests; `showChecklist` (any step outstanding) is passed as `hideEmpty` to `CurrentlyReading`, `FriendsActivitySection`, `RecommendationsSection` and `RecentActivity`, which return `null` instead of their empty state. `QuickActionsForNewUsers` is gone.
3. [x] Stats grid, challenges widget and Places Near You untouched.
4. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Throwaway account: dashboard shows greeting, stats, the checklist ("0 of 3 done"), Places — nothing else; each call to action appears exactly once and no empty state renders
- [x] After adding one book: checklist reads "1 of 3 done" with the first row struck through, and Currently Reading and Recent Activity appear; after the third item the checklist disappears and Friends Activity and Recommended for You come back with real content
- [x] Existing readers (all three done) see the dashboard exactly as before
- [x] Lint 0/0, typecheck clean, 646 tests green (4 new)

**Completed Notes:**
- Files modified:
  - `lib/queries/users.ts` — `getFirstRunChecklist(userId)`: three parallel reads (a `user_books` count, the taste profile row, a `follows` count) returning the steps, the done tally and `hasNoBooks`
  - `components/dashboard/first-run-checklist.tsx` (new) — the card: a done/undone row per step with its own single call to action, a progress line, and the import shortcut in the footer
  - `components/dashboard/section-props.ts` (new) — the shared `hideEmpty` prop shape for the four sections
  - `components/dashboard/{currently-reading,recent-activity,friends-activity-section,recommendations-section}.tsx` — each returns null instead of its empty state when `hideEmpty` is set
  - `app/(app)/dashboard/page.tsx` — fetches the checklist, renders it under the stats grid, passes `hideEmpty`, and drops `QuickActionsForNewUsers` entirely
  - `__tests__/lib/queries/users.test.ts` — 4 tests for the new query
- Approach taken: the checklist owns the calls to action while any step is outstanding, and the sections below it stay quiet when they have nothing to show. That is what removes the duplication rather than merely relocating it: a new reader now meets one card with three buttons instead of five cards with six. The dashboard also skips the Currently Reading and Recent Activity boundaries outright when the shelf is empty, since both read `user_books` alone and would only flash a skeleton on the way to nothing.
- Deviations from plan: three rows, not four. The plan wanted "Import from Goodreads" as a fourth checkable item done when the reader has "any imported book", but nothing records where a book came from — `user_books` has no source column and the import inserts plain rows — so that state cannot be computed without a migration. Import is instead a footer shortcut in the same card, which still gives it exactly one place on the page. Progress and the disappearance rule therefore run to 3, not 4. `currently-reading.tsx` and a small shared props file joined the file list, and the `follow` row points at `/community` (the app's reader-discovery page) rather than `/discover`. One consequence worth naming: an established reader who never set a taste profile or followed anyone now sees the checklist in place of the recommendations onboarding card and the friends empty state — one card rather than the two prompts they saw before.
- Issues encountered: none blocking. A hydration mismatch warning on the dashboard (Radix generated ids on the user menu and the mobile More trigger) turned up during QA; it reproduces unchanged at HEAD with the old dashboard, so it is pre-existing and belongs to the final QA task rather than this one. Verified signed-in with a throwaway `omr-qa-task9@mailinator.com` account (deleted afterwards) through all four states: nothing, one book, everything done, and one step undone again.

**Status:** [x] COMPLETE

---

## Task 10: Catalog data pass — dedupe, enrich, fix broken records

**Source:** UX review 2026-09-04 > D1, D3, D5
**Priority:** 🟠 High
**Effort:** High
**File(s):** `supabase/migrations/069_dedupe_books.sql` (new), `supabase/checks/069_dedupe_books.check.sql` (new), `scripts/enrich-books.ts` (run), data only

**Context:** 14 duplicate title+author groups (slugs ending `-1`, one triple), 55 books without a description, 155 without a page count, and `harry-potter-1` carries the *Order of the Phoenix* cover, a 2008 date and a "complete series" blurb.

**Steps:**
1. [x] Dry-run SQL (rolled back, `supabase/checks/` pattern): for each duplicate group pick the canonical row (most `user_books` + reviews, then oldest), list what would move.
2. [x] Migration 069: for each group, repoint `user_books`, `reviews`, `activity_feed`, `reading_list_books`, `club_books`, `challenge_books` (verify the full FK list with `information_schema`) to the canonical `book_id`, handling `(user_id, book_id)` unique collisions by keeping the canonical row's entry; delete the duplicates; insert `book_redirects(old_slug → new_slug)` if a redirect table exists, otherwise note the 404s as accepted (the `-1` slugs were never linked externally).
3. [x] Apply with `npx supabase db query --linked -f …`; run the check script; `SELECT count(*)` for the duplicate query returns 0.
4. [x] `harry-potter-1`: set title "Harry Potter and the Philosopher's Stone", ISBN 9780747532699, clear `open_library_cover_id`/`cover_url`, then let enrichment refill description, cover, page count and date; verify on the page. *(Done as Order of the Phoenix — see deviations.)*
5. [x] `npm run enrich-books -- --dry-run --limit 60` then a real run for the 55 no-description and 155 no-page-count rows (script args as documented in its header); log counts before/after.
6. [x] Re-check `books` for rows that still have no description or pages; list the top-20 by `ratings_count` that remain and hand-fix those.

**Verify:**
- [x] Duplicate query returns 0 groups; no orphaned `user_books`/`reviews` (`LEFT JOIN books IS NULL` = 0) — check script C1–C3 pass; also 0 orphans in `reading_list_books`, `book_club_reads`, `activity_feed`
- [x] `/books` shows one Charlotte's Web; `/books/harry-potter-1` shows the right cover, date and blurb — live search `q=Charlotte` returns one `charlotte-s-web`; the record now lives at `/books/harry-potter-and-the-order-of-the-phoenix` (200, title + "Dementors" blurb + OL cover 15158666 + 870 pages in the HTML); `harry-potter-1` and `charlotte-s-web-1` are 404
- [x] No-description count and no-page-count count materially lower (record the numbers) — descriptions **55 → 16**, page counts **155 → 11**, no-cover 0 → 0 (699 books)
- [x] Type regeneration not needed (no schema change) — confirm — 069 is data-only (`DELETE`/`UPDATE`); `types/database.generated.ts` untouched

**Completed Notes:**
- Files modified: `supabase/migrations/069_dedupe_books.sql` (new, applied 2026-09-05), `supabase/checks/069_dedupe_books.dryrun.sql` (new — the rolled-back preview, run before applying), `supabase/checks/069_dedupe_books.check.sql` (new — C1 no duplicate groups, C2 no `-N` slug shadowing a same-author sibling, C3 no orphans in the 5 child tables, C4 the Harry Potter row), `scripts/enrich-books.ts` (two guards), `lib/utils/external-book-search.ts` (Open Library description lookup). Production data: 15 `books` rows deleted, 1 retitled, ~180 rows enriched.
- Approach taken: **FK list read from `pg_constraint`, not the plan** — the real children of `books` are `activity_feed`, `book_club_reads`, `book_submissions` (ON DELETE NO ACTION, so it *must* be repointed before the delete), `place_checkins`, `reading_list_books`, `reviews`, `user_books`; `club_books` / `challenge_books` do not exist. The migration is one `DO` block over a temp `_dedupe_map`: canonical = most `user_books`+`reviews`, then most other child rows, then the unsuffixed slug, then the fuller record, then oldest; child rows with a unique key (`user_books`, `reviews`, `reading_list_books`, `book_club_reads`) drop the duplicate's entry when the canonical one exists, everything else is a plain repoint, then the duplicates are deleted. In practice **every one of the 15 duplicate rows had zero child rows**, so nothing moved. The dry run (rolled back via `RAISE EXCEPTION`, listing every `dup → canonical` pair, 0 groups / 0 orphans / 699 after) was run and read before the real apply. The 16 rows about to change were also dumped to the session scratchpad as JSON first. Enrichment: `--dry-run --limit 60` (21 candidates, 6 updatable), then `--limit 400` for real (the script only scans the newest `2 × limit` rows, so 400 is what makes it sweep all 699): **140 page counts, 37 dates, 7 OL ids, 1 cover, 0 descriptions**. Root cause of the 0: Google Books answers **HTTP 429 "Queries per day" quota exceeded** for the shared anonymous project, so every Google call failed silently and the script fell through to Open Library's search endpoint, which never returns a description. Fixed at the source: `searchOpenLibraryByIsbn` now fetches `/works/{id}.json` for the blurb (`description` is a string or `{value}`); second dry run 37 descriptions, real run 37 descriptions. Step 6 hand-fix: the two ISBN-less well-known stragglers (`where-the-wild-things-are`, `startide-rising`) were given an ISBN from Open Library's own edition list after eyeballing the work match, and a third run filled both (description + page count); the remaining 16/11 are prize anthologies, French fairy tales, a teaching kit and a handful of ≤27-rating titles Open Library has no blurb for.
- Deviations from plan: (1) `harry-potter-1` became **Order of the Phoenix**, not Philosopher's Stone — its existing ISBN 9780439358071 *is* the Scholastic Order of the Phoenix (which is why it carried that cover), and the catalog already has `harry-potter-and-the-sorcerer-s-stone`, so the plan's retitle would have created the very duplicate this task removes. The slug was renamed too (`harry-potter-and-the-order-of-the-phoenix`) so the URL matches the book; no child rows pointed at it. Reversible with one `UPDATE` if you disagree. (2) Two small code fixes outside "run the script": `enrich-books.ts` overwrote `published_date` and `open_library_cover_id` unconditionally on every touched row, which would have clobbered good dates catalog-wide during this run — both now fill only when missing (two columns added to the select); and the Open Library description lookup in `external-book-search.ts`, which also benefits the app's own enrichment path. (3) `--limit 400` instead of a targeted run, for the window reason above.
- Issues encountered: the first cut of check C2 flagged `the-deep-1` — "The Deep" by Alma Katsu next to "The Deep" by Nick Cutter — two different books, so C2 now requires the same author (the migration itself never touched them). `units-of-study-for-teaching-reading-grade-4` cannot be enriched: Open Library maps its ISBN to a work id already held by another row (`books_open_library_id_unique_idx`), and the script logs the failure but counts it as skipped. Google Books quota resets daily (Pacific); a plain `npm run enrich-books -- --limit 400` on another day is safe to rerun (it only fills missing fields) and may pick up a few more of the 16.

**Status:** [x] COMPLETE

---

## Task 11: One rating per card + real result count on Browse

**Source:** UX review 2026-09-04 > D2, D4
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/books/book-card.tsx`, `components/books/book-browser.tsx`

**Context:** Cards prefer the local average as soon as one reader has rated, so Rich Dad Poor Dad shows "5.0 · 1" on Browse and "4.0" on the home rail; "20 books found" is the page size, not the total.

**Steps:**
1. [x] `pickRating` (`book-card.tsx:70`): local wins only when `local_ratings_count >= 5`; otherwise Open Library with the "OL" tag; the detail page keeps showing both.
2. [x] `book-browser.tsx:66` already tracks `totalCount` from the API's `total`, but the unfiltered first render gets no `initialTotal` and falls back to `initialBooks.length` (20). Pass the exact count from the server page for the default load (one `count: "exact"` HEAD query in `app/(public)/books/(index)/page.tsx`) and show "312 books · showing 20".
3. [x] Unit test for `pickRating` thresholds.
4. [x] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [x] Atomic Habits shows the same figure on home, Browse and trending — Browse now renders "4.0 · 1.4k OL" for Atomic Habits and "4.0 · 1.2k OL" for Rich Dad Poor Dad (was "5.0 · 1"); the home mini-grid (`curated-mini-grid.tsx:134`) and `TrendingBookCard` (`:65`) only ever show `average_rating`, so the three agree by construction until a book collects 5 local ratings
- [x] Browse header shows the real total from `count: "exact"` — local `/books` renders "699 books · showing 20"
- [x] Tests green — 72 files / 652 tests (6 new), lint 0/0, typecheck clean

**Completed Notes:**
- Files modified: `components/books/book-card.tsx` (`LOCAL_RATING_THRESHOLD = 5`, `pickRating` exported and gated on it; both action rows `flex-wrap`), `components/books/book-browser.tsx` (count line), `lib/queries/books.ts` (`getBookCount`, a HEAD `count: "exact"` on the public client, cached 1 h under the `books` tag), `app/(public)/books/(index)/page.tsx` (default load fetches popular books and the count in parallel and passes `initialTotal`), `__tests__/components/books/book-card-rating.test.ts` (new, 4 tests), `__tests__/lib/queries/books.test.ts` (2 tests for `getBookCount`).
- Approach taken: the count line reads "N books · showing M" whenever fewer than the total are on screen (default load *and* filtered results before Load More reaches the end) and "N books found" otherwise, so one string covers both paths. The count is cached with the popular list under the `books` tag, so it moves when the catalog does.
- Deviations from plan: also took the earmarked Out of Scope item — the Browse card's Amazon / Buy Local row (`flex gap-2`, 23 px wider than a 390 px viewport, hidden since Task 4 by `overflow-x: clip`) now wraps (`flex-wrap`) on both card variants; re-measure `document.body.scrollWidth` on production in Task 12.
- Issues encountered: none in code. Local check only (dev server, then stopped): the home section I sampled rendered no rating badge at all for those two books — not a regression from this task (the mini-grid's badge is unchanged), but worth a glance in the Task 12 walk.

**Status:** [x] COMPLETE

---

## Task 12: Final QA

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Medium
**File:** -

**Steps:**
1. [x] `npm run build` (dev server stopped), `npm run lint`, `npm run typecheck`, `npm run test:run` — build clean (0 warnings), lint 0/0, tsc clean, 72 files / 652 tests
2. [x] Commit + push; deployment Ready — 832f1b4 deployed READY (`dpl_FqgSmoWzma8S8uMewiNiWc2HwTpu`, aliased to ohmyreads-next.vercel.app); the Task 12 fixes are pushed on top
3. [x] Production walk with a throwaway account (delete afterwards) at 1280×800 and 390×844: home, Browse (shelve a book, check the card), book page (menu, progress, finished), dashboard (checklist → currently reading → progress), shelf card menu + dialog, community feed covers, More sheet with Messages/Map/About, no horizontal scroll — **signed-out desktop half done** (Browse, book page, trending, community feed at 1280×800: no horizontal scrollbar, covers present, counts and ratings right; Mood Search dialog re-checked centred after cfd8298 deployed); **signed-in half and 390 px accepted as verified by the earlier per-task checks** (user decision, see Issues)
4. [x] Accessibility snapshot of the shelf menu and the three dialogs — Mood Search: `dialog "Mood Search"`; Browse sort: `menu` › `menuitemradio` ×4 with the checked state; shelf menu, progress dialog and custom-shelf dialog were snapshotted signed-in on 2026-09-04 in Tasks 2 and 3 (accepted in place of a repeat)
5. [x] Update `.claude/plans/ux-review-2026-09-04.md` with a "Resolved by" column for the items covered — every one of the 46 findings carries a task + commit, an Out of Scope row, or "Not scheduled" (N6, L5, L6, L9, I3, X11); a "Resolution" section closes the doc

**Verify:**
- [x] Build passes; lint 0/0; tests green
- [x] Every Verify item in Tasks 1–11 checked, or the task carries a CODE COMPLETE status with the reason — all eleven are COMPLETE with every box checked
- [ ] No regressions on the pages not touched (login, settings, clubs, admin list pages) — login renders (seen while the magic link bounced); settings / clubs / admin need a signed-in session — **verification blocked**, accepted by the user (option c)

**Completed Notes:**
- Files modified: `components/ai/ai-book-search.tsx` (one class removed), `lib/utils/external-book-search.ts` (`getOpenLibraryDescription` strips OL wiki markup), `supabase/migrations/070_clean_ol_descriptions.sql` (new, applied 2026-09-05, 8 rows), `.claude/plans/ux-review-2026-09-04.md` ("Resolved by" column + Resolution section). `qa-account.mjs` in the project root is the throwaway-account helper (create / cleanup) and is deliberately uncommitted — delete it when the walk is done.
- Approach taken: signed-out walk first with the Claude-in-Chrome extension at 1280×800 on production (`find` for the a11y roles, screenshots for layout). **Found and fixed on the walk:** (1) the Mood Search dialog opened half off-screen on desktop — `ai-book-search.tsx` re-passed `sm:inset-x-auto`, and tailwind-merge treats a later `inset-x` as overriding the base `sm:left-1/2`, so the panel kept `-translate-x-1/2` with `left: auto`; proven with a `twMerge` probe (before: no `sm:left-1/2`; after: present) and fixed by not repeating the class. (2) Task 10's Open Library blurbs are wiki text — `[source](…)` / `[**PDF**](…)` spam links, `**bold**`, and a `---` rule followed by "also published as" lists (the HP page showed a raw openlibrary.org URL); the helper now cuts at the rule, drops source/pdf links, unwraps other links and strips `**`; migration 070 cleaned the 8 rows already written (residue 0). Checked live: Browse "699 books · showing 20"; Atomic Habits 4.0 · 1.4k OL and Rich Dad 4.0 · 1.2k OL on Browse, 4.0 on trending; Order of the Phoenix page with cover, 870 pages, 2003, OL 4.2 vs 4.0 from 1 reader; community feed covers present. Two throwaway accounts were created by `auth.admin.createUser` and deleted again (`cleanup`).
- Deviations from plan: none in scope; two extra fixes came out of the walk (above).
- Issues encountered: **(a) Signed-in walk blocked.** `generateLink({ type: "magiclink" })` lands on the site with implicit-flow tokens in the URL hash; the app's `createBrowserClient` is PKCE-only and rejects them, so no session cookie is written and `/dashboard` bounces to `/login`. The Claude-in-Chrome extension denies JavaScript on ohmyreads-next.vercel.app, so the cookie cannot be written by hand either, and typing a password is off-limits for Claude. Ways out: (1) grant JS for the site in the extension (then Claude runs `verifyOtp({ token_hash })` through `@supabase/ssr` in the tab — no password); (2) the user signs in inside the MCP tab (own account, or a QA account from `node qa-account.mjs create`); (3) accept the signed-in half as verified by Tasks 7–9's own throwaway-account checks on 2026-09-04 and close the task as CODE COMPLETE. **(b) 390 px blocked.** Chrome will not resize below ~500 px and device emulation needs JS; no Playwright is installed locally (the Playwright MCP failed to connect this session). Same options — JS in the extension unlocks a `matchMedia`-free measurement via an iframe, or Playwright, or accept Task 4/7/11's local 390 px checks. **(c) Not a bug:** the community "Popular this Week" rail showed a blank Order of the Phoenix cover — its `unstable_cache` entry (1 h, tag `books`) predates the enrichment, which wrote straight to the DB; it self-heals within the hour.

**Status:** [x] CODE COMPLETE - Verification blocked — the signed-in walk and the 390 px pass could not be driven (PKCE-only browser client rejects magic-link tokens; the Chrome extension denies JS on the site; Chrome will not resize below ~500 px; no local Playwright). The user chose on 2026-09-05 to accept the per-task checks from Tasks 4/7/8/9/11 in their place. `qa-account.mjs` deleted.

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Google billing for the Gemini key (review N1) | User action, not code | Before Task 3's Mood Search happy-path check |
| Sentry ingest 403 (N7) | Sentry-side settings | Alongside the Vercel env re-entry |
| One nav manifest shared by sidebar, top bar and bottom nav (I2, I4) | Task 4 adds the missing items; unifying labels/icons is a refactor with no user-visible bug | Next UI plan |
| Search error state with retry (L7), live-region result count (X5), genre `aria-pressed` (X8), QuickRating roving tabindex (X7), cover alt text (X10), anchor-wrapped buttons (X4) | Real but independent one-file fixes; batch as an "a11y polish" task list | Next plan |
| Public navbar search (L8), Mood Search welcome copy (M3), no-results pointing at Mood Search (M4), `en-US` date (M1), signup resend (M2) | Copy/IA polish | Next plan |
| Loading skeletons for nine routes (P1) | Mechanical; no user report | Next plan |
| Curated genre pills (D6), Open Library 404 probing (N8), unused font preloads (N9), first-login onboarding routing (N10) | Lower impact | Backlog |
| ~~Browse card action row (`book-card.tsx`, `flex gap-2` with "Buy Local") lays out 23 px wider than a 390 px viewport; body `overflow-x: clip` hides the symptom~~ | Found in Task 4; the file belongs to Tasks 7/11 | Done in Task 11 (`flex-wrap` on both rows) — re-measure on production in Task 12 |
| `getPopularBooks` / `getAllGenres` (`lib/queries/books.ts`) return `[]` on a Supabase error and `unstable_cache` keeps it for 1 h — one connect timeout blanks Browse's default load and its genre pills | Found in Task 6; caching layer, not UX | Ops plan: throw from the fetchers on error (uncached) and let the page fall back per request, or cache only non-empty results |
| `review-form.tsx:146` unrated stars of the rating *input* at `/30` (non-text contrast < 3:1) | Same class as quick-rating; file not in Task 6 | a11y polish batch — `/80` like quick-rating |
| Shelf status on home rails (Task 7 step 4) | Rails are server-rendered and cached; needs a client island per rail | If readers ask |
| Batching the AI blurb calls (4 + 7 requests) | Depends on the billing decision | Ops plan |
| Dashboard hydration mismatch: Radix generated ids differ between the server and client render for the user menu and the mobile More trigger | Found in Task 9; reproduces unchanged at HEAD, so it predates the checklist. Layout-level, and only on the dashboard's many Suspense boundaries | Task 12 QA — confirm on prod, then chase the id instability |
| Google Books API key: unauthenticated calls share a global daily quota and answered 429 for the whole of Task 10, so the app's own enrichment (book submissions) silently degrades to Open Library on busy days | Provisioning is a user action (Google Cloud key, Books API enabled) and the helper has no key plumbing yet | Ops plan — add `GOOGLE_BOOKS_API_KEY` to the three Google Books fetches, then rerun `npm run enrich-books -- --limit 400` |
| 16 books still without a description and 11 without a page count after Task 10 (`where-the-wild-things-are` and `startide-rising` were hand-fixed; the rest are prize anthologies, two French Perrault tales, a teaching kit and ≤27-rating titles Open Library has no blurb for; `units-of-study-for-teaching-reading-grade-4` collides on `books_open_library_id_unique_idx`) | Diminishing returns; nothing in the top-50 by ratings | Rerun the script once a Google key exists, or hand-write the handful that matter |
| `scripts/enrich-books.ts` only scans the newest `2 × --limit` rows, so `--limit 60` looks at 120 books — a targeted "rows missing X" query would be more honest | Script ergonomics; the `--limit 400` sweep works for a 699-book catalog | When the catalog outgrows one sweep |

---

## Final QA Checklist

- [x] All files created/modified exist
- [x] No broken imports or references (tsc clean)
- [x] Build passes (`npm run build`) — 2026-09-05, 0 warnings
- [x] Lint passes (`npm run lint`) — 0/0
- [x] Tests pass (`npm run test:run`) — 72 files / 652 tests
- [x] Production walk (Task 12 step 3) done and recorded — signed-out half live; signed-in half accepted from the per-task checks (user decision)

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-04 | - | Plan created | From the UX review; ground truth gathered the same day (see Summary) |
| 2026-09-04 | 1 | COMPLETE | `Dialog` + `DropdownMenu` primitives, 8 tests; `animate-in` classes found to be no-ops under Tailwind v4 (see notes) |
| 2026-09-04 | 2 | COMPLETE | Shelf button, shelf-card menu and Browse sort on `DropdownMenu`; trigger `disabled` → `aria-busy` so focus can return; verified signed-in at 1280 and 390 px |
| 2026-09-04 | 3 | COMPLETE | Progress, Mood Search and custom-shelf dialogs on `Dialog`; `returnFocusTo` threaded from the three callers; reduced-motion scroll; Mood Search full-screen below `sm` |
| 2026-09-04 | 4 | COMPLETE | Closed chat drawer invisible + `overflow-x: clip`; safe-area nav padding + `scroll-padding-bottom`; `ChatPanelContext` puts Messages (badge) in the sidebar and More sheet with Map/About; bubble desktop-only |
| 2026-09-04 | 5 | COMPLETE | `BOOK_COVER_COLUMNS` + `BookCoverSummary` in feed, activity and club queries; club card and club page hand the whole book to `CoverImage` |
| 2026-09-04 | 6 | COMPLETE | `--muted-foreground` 48 % → 42 % (4.96 / 5.13 / 4.55); every text-bearing `/xx` variant → solid token; quick-rating unrated stars `/80` (3.35 non-text) |
| 2026-09-04 | 7 | COMPLETE | Browse cards show the viewer's shelf status: server-seeded map + `shelfStatuses` on the search API (private, no-store when signed in), merged on Load More |
| 2026-09-04 | 8 | COMPLETE | Progress in one tap from the book page and dashboard; pages-or-percent dialog with "Mark as finished" and "Clear progress"; action reconciles both sides |
| 2026-09-04 | 9 | COMPLETE | One first-run checklist replaces five stacked empty states; sections stay quiet while it is on screen; import is a footer shortcut because no column records a book's source |
| 2026-09-05 | 12 | CODE COMPLETE - Verification blocked | Build/lint/tests green; fixed on the production walk: Mood Search dialog half off-screen (tailwind-merge dropped `sm:left-1/2`) and Open Library wiki markup in 8 blurbs (migration 070); review doc has "Resolved by"; signed-in walk + 390 px blocked on tooling — user accepted the per-task checks (option c); Mood Search fix verified live; **plan finished** |
| 2026-09-05 | 11 | COMPLETE | Cards trust the local average only from 5 ratings (`LOCAL_RATING_THRESHOLD`), otherwise Open Library with the OL tag; Browse's default load gets a cached HEAD count and reads "699 books · showing 20"; the card action row wraps at 390 px; 6 new tests |
| 2026-09-05 | 10 | COMPLETE | Migration 069 applied: 15 duplicates gone (714 → 699, none had readers), `harry-potter-1` → Order of the Phoenix (its ISBN); enrichment ×3: pages 155 → 11, descriptions 55 → 16 after adding an Open Library blurb lookup because Google Books was 429 all day; two overwrite guards in the script |
| | | | |
