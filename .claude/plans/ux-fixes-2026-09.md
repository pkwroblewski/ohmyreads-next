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
| 2 | Migrate the three menus: shelf dropdown, shelf-card actions, Browse sort | 🔴 Critical | Medium | [ ] PENDING | `components/books/add-to-shelf-button.tsx`, `components/books/shelf-book-card.tsx`, `components/books/book-browser.tsx` |
| 3 | Migrate the three dialogs: progress, Mood Search, custom shelves | 🔴 Critical | Medium | [ ] PENDING | `components/books/update-progress-dialog.tsx`, `components/ai/ai-book-search.tsx`, `components/shelves/add-to-shelf-modal.tsx` |
| 4 | Mobile chrome: clip horizontal overflow, reserve nav space, Messages into the nav | 🟠 High | Medium | [ ] PENDING | `components/messages/chat-panel.tsx`, `components/messages/chat-trigger.tsx`, `components/layout/app-shell.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/layout/sidebar.tsx`, `app/globals.css` |
| 5 | Full cover column set in feed, activity and club queries | 🟠 High | Low | [ ] PENDING | `lib/queries/community.ts`, `components/dashboard/recent-activity.tsx`, `lib/queries/clubs.ts` |
| 6 | Muted text token passes AA | 🟠 High | Low | [ ] PENDING | `app/globals.css`, `components/layout/sidebar.tsx`, `components/reviews/quick-rating.tsx` |
| 7 | Browse cards show the viewer's shelf status | 🔴 Critical | Medium | [ ] PENDING | `app/api/books/search/route.ts`, `components/books/book-browser.tsx`, `components/books/book-card.tsx` |
| 8 | Progress from the book page and dashboard, percent + "finished" | 🟠 High | High | [ ] PENDING | `components/books/update-progress-dialog.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/dashboard/currently-reading.tsx`, `lib/actions/books.ts`, `lib/validation/book-action.ts` |
| 9 | One first-run checklist instead of five empty states | 🟡 Medium | Medium | [ ] PENDING | `app/(app)/dashboard/page.tsx`, `components/dashboard/first-run-checklist.tsx` (new), `components/dashboard/recent-activity.tsx`, `components/dashboard/friends-activity-section.tsx`, `components/dashboard/recommendations-section.tsx` |
| 10 | Catalog data pass: dedupe, enrich, fix broken records | 🟠 High | High | [ ] PENDING | `supabase/migrations/069_dedupe_books.sql` (new), `scripts/enrich-books.ts`, data only |
| 11 | One rating per card + real result count on Browse | 🟡 Medium | Low | [ ] PENDING | `components/books/book-card.tsx`, `components/books/book-browser.tsx` |
| 12 | Final QA | - | Medium | [ ] PENDING | - |

**Progress: 1/12 complete**

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
1. [ ] `add-to-shelf-button.tsx`: replace the `isOpen`/`focusedIndex`/click-outside code with `DropdownMenu` + `DropdownMenuRadioGroup` (value = status) for Want to Read / Reading / Read, a separator, "Manage Shelves…" item, and, when shelved, a destructive "Remove from shelf" item. Keep the props (`bookId`, `bookTitle`, `currentStatus`), the optimistic status, the toasts, and the `AddToShelfModal` hand-off.
2. [ ] `shelf-book-card.tsx:266`: the actions menu → `DropdownMenu`; trigger keeps `aria-label="Book options for {title}"`.
3. [ ] `book-browser.tsx:250`: sort → `DropdownMenu` with `DropdownMenuRadioGroup`; trigger shows the current sort and gets `aria-expanded` from Radix.
4. [ ] Delete the dead `handleClickOutside` / keyboard handlers.
5. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Keyboard: Tab to the shelf button, Enter opens, ArrowDown/Up moves, Enter selects, Escape closes and focus returns to the button
- [ ] Screen-reader tree (Playwright snapshot): `button [expanded]` → `menu` → `menuitemradio` entries, no `listbox`
- [ ] Mobile 390×844 on the book page: the menu opens *above* the trigger when there is no room below, never under the bottom nav
- [ ] Choosing a status still toasts "Book marked as …" and the button label updates without reload
- [ ] Lint 0/0, tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 3: Migrate the three dialogs

**Source:** UX review 2026-09-04 > X1, X9 (agent C1, C6)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `components/books/update-progress-dialog.tsx`, `components/ai/ai-book-search.tsx`, `components/shelves/add-to-shelf-modal.tsx`

**Context:** Three plain `fixed` divs: no `role="dialog"`, no focus trap, no Escape, page behind stays tabbable and readable by assistive tech.

**Steps:**
1. [ ] `update-progress-dialog.tsx`: wrap in `Dialog`/`DialogContent`; keep the form, `currentPage`/`totalPages` props and `onUpdated`. Pass the caller's trigger ref as `returnFocusTo` (the shelf card's "Update progress" button).
2. [ ] `ai-book-search.tsx:163`: the panel becomes `DialogContent` (`sm:max-w-3xl`, full-height on mobile); `DialogTitle` "Mood Search" (one name for the feature, see Out of Scope for the rest of the copy); the two `scrollIntoView({behavior:"smooth"})` calls check `matchMedia("(prefers-reduced-motion: reduce)")` and use `"auto"` when set; focus lands in the input on open (`onOpenAutoFocus`).
3. [ ] `shelves/add-to-shelf-modal.tsx`: same wrap; it is opened from the shelf menu, so `returnFocusTo` is the shelf button.
4. [ ] Remove the hand-rolled overlay/close-button/Escape code from all three.
5. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Each dialog: `role="dialog"` + `aria-modal="true"` in the snapshot, Tab cycles inside, Escape closes, focus returns to the opener
- [ ] Mood Search: opens from "Mood Search" on `/books`, sends a query, shows either results or the calm quota sentence (Google billing may still be off — the error path is enough to verify the dialog)
- [ ] Progress dialog from a shelf card saves a page and the card's bar updates
- [ ] Lint 0/0, tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 4: Mobile chrome — clip overflow, reserve nav space, Messages into the nav

**Source:** UX review 2026-09-04 > N2, N3, N4, I1, P2
**Priority:** 🟠 High
**Effort:** Medium
**File(s):** `components/messages/chat-panel.tsx`, `components/messages/chat-trigger.tsx`, `components/layout/app-shell.tsx`, `components/layout/mobile-bottom-nav.tsx`, `components/layout/sidebar.tsx`, `app/globals.css`

**Context:** Every signed-in desktop page scrolls horizontally because the closed chat drawer still occupies layout width; on mobile the floating Messages bubble covers content and the bottom nav covers the last row of every page; Messages is in no navigation at all.

**Steps:**
1. [ ] `chat-panel.tsx`: while closed, add `invisible pointer-events-none` (keeps the slide-in animation) and put `overflow-x: clip` on `body` in `globals.css` as the backstop. Confirm `document.body.scrollWidth === clientWidth` at 1280.
2. [ ] `app-shell.tsx:45`: replace `pb-20` with `pb-[calc(5rem+env(safe-area-inset-bottom))]` and add `scroll-padding-bottom` for anchor jumps; check the book page action row and the shelf card row at 390×844 no longer sit under the nav at any scroll position.
3. [ ] Messages into the nav: `components/messages/chat-wrapper.tsx:98` owns the panel's open state (renders `ChatTrigger` + `ChatPanel`); expose `openChat` + `unreadCount` through a small context from there; add a "Messages" item with the unread badge to the sidebar's Social section and to `overflowItems` in `mobile-bottom-nav.tsx` (rendered as a button, not a link); add Map and About to `overflowItems` while there.
4. [ ] `chat-trigger.tsx`: hide on mobile (`hidden lg:flex`) now that the sheet has the entry; on desktop keep `bottom-6`.
5. [ ] `mobile-bottom-nav.tsx:77`: the More sheet's `bottom-16` gains the safe-area inset.
6. [ ] Update `__tests__/components/layout/mobile-bottom-nav.test.tsx` for the new items.
7. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Desktop 1280: no horizontal scrollbar on `/dashboard`, `/my-shelf`, `/books`; `scrollWidth === clientWidth`
- [ ] Mobile 390×844: book page "Add to Shelf" row, shelf card "Update progress", dashboard CTAs all reachable and unobstructed; no floating bubble
- [ ] More sheet lists Messages (with badge when unread > 0), Map, About; tapping Messages opens the panel
- [ ] Sidebar shows Messages with the badge; existing nav test green
- [ ] Lint 0/0, tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 5: Full cover column set in feed, activity and club queries

**Source:** UX review 2026-09-04 > N5
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `lib/queries/community.ts`, `components/dashboard/recent-activity.tsx`, `lib/queries/clubs.ts`

**Context:** "image not available" appears for books that render fine everywhere else, because these queries select only `cover_url` and the fallback chain has nothing to fall back to.

**Steps:**
1. [ ] Add `COVER_COLUMNS = "id, title, author, slug, cover_url, isbn, google_books_id, open_library_cover_id, cover_source"` to `lib/queries/columns.ts` (or reuse `BOOK_CARD_COLUMNS` where the payload size does not matter).
2. [ ] `community.ts:93` and `:214`, `clubs.ts:70/167/293/329`, `recent-activity.tsx:46`: select it; widen the `book` types in those files and in `types/app.ts` accordingly.
3. [ ] `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Dashboard Recent Activity and `/community` show covers for The Hobbit / Harry Potter (books whose `cover_url` is null)
- [ ] Club pages still render; typecheck clean; tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 6: Muted text token passes AA

**Source:** UX review 2026-09-04 > X3 (agent A1)
**Priority:** 🟠 High
**Effort:** Low
**File(s):** `app/globals.css`, `components/layout/sidebar.tsx`, `components/reviews/quick-rating.tsx`

**Context:** `--muted-foreground` colours every author name, date, description and count and measures 4.0:1 on the cream background.

**Steps:**
1. [ ] `globals.css:27`: `--muted-foreground: 30 14% 42%`; compute contrast against `--background` and `--card` with a 10-line node script (WCAG relative luminance) and record the numbers.
2. [ ] Grep `text-muted-foreground/` and raise anything used for text (not decoration) to at least `/80`; `sidebar.tsx:111` section labels → solid token with `uppercase tracking-wide`; `quick-rating.tsx:93` unrated stars keep `/40` only if the control also has a visible label (it is decorative once labelled).
3. [ ] Screenshot home, Browse, dashboard in light and dark before/after.

**Verify:**
- [ ] Light: token ≥ 4.5:1 on both `--background` and `--card`; dark unchanged
- [ ] No text-bearing element left below 4.5:1 among the `/xx` variants
- [ ] Visual check: still reads as "muted", not as body text

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 7: Browse cards show the viewer's shelf status

**Source:** UX review 2026-09-04 > L1 (agent B1)
**Priority:** 🔴 Critical
**Effort:** Medium
**File(s):** `app/api/books/search/route.ts`, `components/books/book-browser.tsx`, `components/books/book-card.tsx`

**Context:** A reader adds a book from Browse, gets a toast, and the card still says "Add to Shelf". `AddToShelfButton` supports `currentStatus`; the grid never passes it.

**Steps:**
1. [ ] Search route: after the books query, if `getUser()` returns a user, fetch `user_books.select("book_id, status").eq("user_id", user.id).in("book_id", ids)` and return `shelfStatuses: Record<bookId, status>` alongside `books`/`count`. Anonymous callers get `{}`; the response stays cacheable per-user only via the existing dynamic route (no `Cache-Control: public`).
2. [ ] `book-browser.tsx`: keep `shelfStatuses` in state (merge on Load More), pass `currentStatus={shelfStatuses[book.id] ?? null}` to `BookCard`; when `AddToShelfButton` changes status, update the map through an `onStatusChange` callback.
3. [ ] `book-card.tsx`: add `currentStatus?: ShelfStatus | null` and `onStatusChange?` props; forward to both `AddToShelfButton` sites (`:218`, `:317`).
4. [ ] Home rails (`BookListHorizontal`, curated/trending) are Out of Scope unless trivial — note the decision.
5. [ ] Extend `__tests__/app/api/route-gates.test.ts` (or a new search test) for the anonymous vs signed-in shape.
6. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Signed in: shelve a book from Browse → card label becomes the status immediately; reload → still shows it; other cards unaffected
- [ ] Signed out: cards still say "Add to Shelf" and the API returns `shelfStatuses: {}`
- [ ] Search response time unchanged within noise (one extra indexed `IN` query)
- [ ] Lint 0/0, tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 8: Progress from the book page and dashboard, percent + "finished"

**Source:** UX review 2026-09-04 > L2, L3 (agent B2)
**Priority:** 🟠 High
**Effort:** High
**File(s):** `components/books/update-progress-dialog.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/dashboard/currently-reading.tsx`, `components/books/book-list-horizontal.tsx` or a new `components/books/reading-progress-card.tsx`, `lib/actions/books.ts`, `lib/validation/book-action.ts`

**Context:** Progress is only reachable from the shelf card (dashboard → Shelf → card → dialog), is page-numbers only, and has no "finished" shortcut. StoryGraph and Fable treat percent as first-class; audiobook readers have no page number.

**Steps:**
1. [ ] Dialog: add a Pages / Percent toggle (percent stores `progress_percentage` and, when `total_pages` is known, derives `current_page`); prefill `totalPages` from `books.page_count`; add a "Mark as finished" button that calls `addToShelf(bookId, "read")` and closes; "Clear progress" resets to 0.
2. [ ] `updateReadingProgress`: accept `{ currentPage?, totalPages?, percent? }` (validation in `book-action.ts`); keep the old positional signature working for the shelf card or update that caller.
3. [ ] Book page: the `userBookStatus` query also selects `current_page, total_pages, progress_percentage`; when status is `reading`, render a slim progress row under the action buttons (bar + "p. 120 of 310 · 39%" + "Update progress" opening the dialog). Client island; the page stays server-rendered.
4. [ ] Dashboard `CurrentlyReading`: the card shows the bar and an "Update progress" button (new `ReadingProgressCard` client component receiving the `user_books` row); "View All" unchanged.
5. [ ] Delete the stale comment at `types/app.ts:135` that says the columns do not exist.
6. [ ] Tests: validation schema (pages vs percent, bounds) and the action's derived fields.
7. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] From the dashboard: one tap opens the dialog, saving updates the bar without reload
- [ ] From the book page: same; "Mark as finished" moves the book to Read, toast confirms, stats card increments after refresh
- [ ] Percent entry without a page count stores the percent and shows "39%" only
- [ ] Shelf card path still works; lint 0/0, tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 9: One first-run checklist instead of five empty states

**Source:** UX review 2026-09-04 > L4 (agent A4)
**Priority:** 🟡 Medium
**Effort:** Medium
**File(s):** `app/(app)/dashboard/page.tsx`, `components/dashboard/first-run-checklist.tsx` (new), `components/dashboard/recent-activity.tsx`, `components/dashboard/friends-activity-section.tsx`, `components/dashboard/recommendations-section.tsx`, `components/dashboard/currently-reading.tsx`

**Context:** A brand-new reader sees a greeting, four zero stat cards, then five stacked empty states with "Browse Books" three times and "Import from Goodreads" twice.

**Steps:**
1. [ ] `first-run-checklist.tsx` (server component): one card, four rows with done/undone state — Add your first book (`/books`), Set up your taste profile (`/onboarding/taste` or settings), Follow a reader (`/discover`), Import from Goodreads (`/import`); done = `user_books` count > 0, taste profile row exists, `follows` count > 0, any imported book. Progress "1 of 4".
2. [ ] Dashboard page: compute `isFirstRun = user_books count === 0` once (one HEAD count query) and pass `hideEmpty` to `CurrentlyReading`, `FriendsActivitySection`, `RecommendationsSection`, `RecentActivity`; they return `null` instead of their `EmptyState` when told to. Replace `QuickActionsForNewUsers` with the checklist.
3. [ ] Keep the stats grid (zeros are fine) and Places Near You.
4. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Throwaway account: dashboard shows greeting, stats, the checklist, Places — nothing else; no duplicate CTAs
- [ ] After adding one book: checklist shows 1 of 4 and Currently Reading appears; after the fourth item the checklist disappears
- [ ] Existing readers (books > 0) see no change
- [ ] Lint 0/0, tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 10: Catalog data pass — dedupe, enrich, fix broken records

**Source:** UX review 2026-09-04 > D1, D3, D5
**Priority:** 🟠 High
**Effort:** High
**File(s):** `supabase/migrations/069_dedupe_books.sql` (new), `supabase/checks/069_dedupe_books.check.sql` (new), `scripts/enrich-books.ts` (run), data only

**Context:** 14 duplicate title+author groups (slugs ending `-1`, one triple), 55 books without a description, 155 without a page count, and `harry-potter-1` carries the *Order of the Phoenix* cover, a 2008 date and a "complete series" blurb.

**Steps:**
1. [ ] Dry-run SQL (rolled back, `supabase/checks/` pattern): for each duplicate group pick the canonical row (most `user_books` + reviews, then oldest), list what would move.
2. [ ] Migration 069: for each group, repoint `user_books`, `reviews`, `activity_feed`, `reading_list_books`, `club_books`, `challenge_books` (verify the full FK list with `information_schema`) to the canonical `book_id`, handling `(user_id, book_id)` unique collisions by keeping the canonical row's entry; delete the duplicates; insert `book_redirects(old_slug → new_slug)` if a redirect table exists, otherwise note the 404s as accepted (the `-1` slugs were never linked externally).
3. [ ] Apply with `npx supabase db query --linked -f …`; run the check script; `SELECT count(*)` for the duplicate query returns 0.
4. [ ] `harry-potter-1`: set title "Harry Potter and the Philosopher's Stone", ISBN 9780747532699, clear `open_library_cover_id`/`cover_url`, then let enrichment refill description, cover, page count and date; verify on the page.
5. [ ] `npm run enrich-books -- --dry-run --limit 60` then a real run for the 55 no-description and 155 no-page-count rows (script args as documented in its header); log counts before/after.
6. [ ] Re-check `books` for rows that still have no description or pages; list the top-20 by `ratings_count` that remain and hand-fix those.

**Verify:**
- [ ] Duplicate query returns 0 groups; no orphaned `user_books`/`reviews` (`LEFT JOIN books IS NULL` = 0)
- [ ] `/books` shows one Charlotte's Web; `/books/harry-potter-1` shows the right cover, date and blurb
- [ ] No-description count and no-page-count count materially lower (record the numbers)
- [ ] Type regeneration not needed (no schema change) — confirm

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 11: One rating per card + real result count on Browse

**Source:** UX review 2026-09-04 > D2, D4
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `components/books/book-card.tsx`, `components/books/book-browser.tsx`

**Context:** Cards prefer the local average as soon as one reader has rated, so Rich Dad Poor Dad shows "5.0 · 1" on Browse and "4.0" on the home rail; "20 books found" is the page size, not the total.

**Steps:**
1. [ ] `pickRating` (`book-card.tsx:70`): local wins only when `local_ratings_count >= 5`; otherwise Open Library with the "OL" tag; the detail page keeps showing both.
2. [ ] `book-browser.tsx:66` already tracks `totalCount` from the API's `total`, but the unfiltered first render gets no `initialTotal` and falls back to `initialBooks.length` (20). Pass the exact count from the server page for the default load (one `count: "exact"` HEAD query in `app/(public)/books/(index)/page.tsx`) and show "312 books · showing 20".
3. [ ] Unit test for `pickRating` thresholds.
4. [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`

**Verify:**
- [ ] Atomic Habits shows the same figure on home, Browse and trending
- [ ] Browse header shows the real total from `count: "exact"`
- [ ] Tests green

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

---

## Task 12: Final QA

**Source:** Plan > Final verification
**Priority:** -
**Effort:** Medium
**File:** -

**Steps:**
1. [ ] `npm run build` (dev server stopped), `npm run lint`, `npm run typecheck`, `npm run test:run`
2. [ ] Commit + push; deployment Ready
3. [ ] Production walk with a throwaway account (delete afterwards) at 1280×800 and 390×844: home, Browse (shelve a book, check the card), book page (menu, progress, finished), dashboard (checklist → currently reading → progress), shelf card menu + dialog, community feed covers, More sheet with Messages/Map/About, no horizontal scroll
4. [ ] Accessibility snapshot of the shelf menu and the three dialogs
5. [ ] Update `.claude/plans/ux-review-2026-09-04.md` with a "Resolved by" column for the items covered

**Verify:**
- [ ] Build passes; lint 0/0; tests green
- [ ] Every Verify item in Tasks 1–11 checked, or the task carries a CODE COMPLETE status with the reason
- [ ] No regressions on the pages not touched (login, settings, clubs, admin list pages)

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
| Google billing for the Gemini key (review N1) | User action, not code | Before Task 3's Mood Search happy-path check |
| Sentry ingest 403 (N7) | Sentry-side settings | Alongside the Vercel env re-entry |
| One nav manifest shared by sidebar, top bar and bottom nav (I2, I4) | Task 4 adds the missing items; unifying labels/icons is a refactor with no user-visible bug | Next UI plan |
| Search error state with retry (L7), live-region result count (X5), genre `aria-pressed` (X8), QuickRating roving tabindex (X7), cover alt text (X10), anchor-wrapped buttons (X4) | Real but independent one-file fixes; batch as an "a11y polish" task list | Next plan |
| Public navbar search (L8), Mood Search welcome copy (M3), no-results pointing at Mood Search (M4), `en-US` date (M1), signup resend (M2) | Copy/IA polish | Next plan |
| Loading skeletons for nine routes (P1) | Mechanical; no user report | Next plan |
| Curated genre pills (D6), Open Library 404 probing (N8), unused font preloads (N9), first-login onboarding routing (N10) | Lower impact | Backlog |
| Shelf status on home rails (Task 7 step 4) | Rails are server-rendered and cached; needs a client island per rail | If readers ask |
| Batching the AI blurb calls (4 + 7 requests) | Depends on the billing decision | Ops plan |

---

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm run test:run`)
- [ ] Production walk (Task 12 step 3) done and recorded

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-04 | - | Plan created | From the UX review; ground truth gathered the same day (see Summary) |
| 2026-09-04 | 1 | COMPLETE | `Dialog` + `DropdownMenu` primitives, 8 tests; `animate-in` classes found to be no-ops under Tailwind v4 (see notes) |
| | | | |
