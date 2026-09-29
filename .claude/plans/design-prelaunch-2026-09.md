# OhMyReads - Shelf Design Build (Pre-Launch)

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
| 1 | Site-wide foundation: colours, "lights down" dark mode, fonts, remove gradients/glass/glow | 🔴 Critical | Medium | [x] COMPLETE | `app/globals.css`, `app/layout.tsx`, `components/ui/card.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/geo/map-*.tsx` |
| 2 | New logo and drop the tagline | 🔴 Critical | Medium | [x] COMPLETE | new `components/brand/logo.tsx`, `components/layout/{navbar,footer,app-top-bar}.tsx`, `app/{icon,apple-icon,opengraph-image}.tsx`, `app/icons/*`, `app/(public)/page.tsx`, `components/home/home-hero.tsx` |
| 3 | Replace sparkle icons (27 files) | 🟡 Medium | Medium | [x] COMPLETE | 27 files (listed in task) |
| 4 | Spine data: colour columns, pipeline hook, backfill | 🔴 Critical | Medium | [x] COMPLETE | `supabase/migrations/077_book_spine_colours.sql`, new `lib/covers/spine-colour.ts`, `lib/covers/pipeline.ts`, new `scripts/backfill-spine-colours.ts`, `package.json`, `types/database.generated.ts` (generated) |
| 5 | Shelf component in React | 🔴 Critical | High | [ ] PENDING | new `components/shelf/*` |
| 6 | Profile shelf by year, with the empty shelf | 🔴 Critical | Medium | [ ] PENDING | `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`, new query in `lib/queries/` |
| 7 | Goodreads import result as a wall of spines | 🟠 High | Medium | [ ] PENDING | `components/import/goodreads-import.tsx`, `lib/actions/import.ts` |
| 8 | Homepage: shelf hero and new copy | 🟠 High | Medium | [ ] PENDING | `components/home/home-hero.tsx`, `app/(public)/page.tsx`, new `lib/curated-picks.ts` |
| 9 | Homepage: pick 3 books before sign-up, keep them after | 🟡 Medium | High | [ ] PENDING | new `components/home/shelf-starter.tsx`, onboarding/signup flow |
| 10 | Share image of a year's shelf | 🟠 High | High | [ ] PENDING | new `app/api/og/shelf/route.tsx`, profile share button |
| 11 | Honest zero states and labels | 🟠 High | Medium | [ ] PENDING | `components/trending/trending-book-card.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/books/recommended-books-row.tsx`, `lib/queries/recommendations.ts` |
| 12 | Final QA | - | Medium | [ ] PENDING | - |

**Progress: 4/12 complete**

**Minimum before launch:** Tasks 1, 2, 4, 5, 6 and 11. The rest can ship after launch if launch day comes first.

**Status Options:**
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency

---

## Summary

The owner approved the shelf design direction on 2026-09-29 after a prototype (`.claude/docs/design-direction-2026-09.md`; prototype https://claude.ai/artifact/LyDCBVZABxZVXtWNjje6jA; source in `.claude/prototypes/shelf/`). The current site looks generic (shadcn cards, Lucide icons, Inter + Merriweather, stock hero photo) and depends on a community that won't exist on launch day. This plan moves the prototype into the app: first a site-wide foundation (paper-and-ink colours, ribbon-red accent, "lights down" dark mode, Literata + Archivo, new logo, no tagline, no sparkles or gradients), then stored spine colours, a React shelf component, the profile shelf, the Goodreads import wall, the homepage, and a share image. It also keeps the still-valid honesty fixes from the earlier review (Trending "+0", "Readers also enjoyed", curated picks, empty review block). Decision 2026-09-29: keep the name OhMyReads, drop "Independent Minds, Shared Stories". This plan replaces the earlier 8-task pre-launch design plan that lived in this file.

---

## Task 1: Site-wide foundation: colours, "lights down" dark mode, fonts, remove gradients/glass/glow

**Source:** Design direction doc > §4 rules 2–5, 8  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** `app/globals.css`, `app/layout.tsx`, `components/ui/card.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/geo/map-context-panel.tsx`, `components/geo/map-page-client.tsx`

**Context:** Every page gets the new look through the existing HSL tokens in `app/globals.css`, so most of the site changes without touching components. Light mode is paper and ink with a single bookmark-ribbon red accent; dark mode is the same room with the lights down (same hues, dimmer), not the current olive/copper/teal palette. Books supply colour, so the UI stays quiet. Fonts move from Inter + Merriweather (75 files reference `font-serif`/merriweather, but through the `--font-serif`/`--font-sans` tokens) to Literata (display/reading) and Archivo (UI and spines). Prototype token values are the starting point (`.claude/prototypes/shelf/shelf.template.html`, `:root`).

**Steps:**
1. [x] Read `node_modules/next/dist/docs/` on `next/font` before changing fonts (CLAUDE.md: this Next.js differs from training data)
2. [x] In `app/layout.tsx`, load Literata (variable, with `opsz`, italic) and Archivo (variable, with `wdth`) via `next/font/google`; keep the CSS variable names or rename them in one place
3. [x] Update `@theme inline` in `globals.css` so `--font-serif` → Literata and `--font-sans` → Archivo
4. [x] Replace the light and dark token values with the prototype palette (wall/paper/ink/rule/plank/ribbon), mapped onto the existing shadcn token names (`--background`, `--primary`, `--muted-foreground`, `--star`, …); recheck every contrast comment in the file and keep text at ≥ 4.5:1 and graphics at ≥ 3:1
5. [x] Add shelf tokens (`--plank`, `--plank-shadow`, `--ribbon`, `--book-filter`) for Task 5
6. [x] Delete `.gradient-primary`, `.gradient-text`, `.glass`, `.glow-primary`, `.glow-accent`, `.shadow-warm*` and fix their users (`components/ui/card.tsx`, book page, map files)
7. [x] Replace the gradient CTA band on the homepage (`app/(public)/page.tsx`) with a plain one
8. [x] Update `::selection` and scrollbar colours to the new tokens

**Verify:**
- [x] `npm run lint` clean; `npm run build` passes (dev server stopped first)
- [x] Playwright screenshots of `/`, `/books/a-game-of-thrones`, `/trending`, `/dashboard` (signed in, dev-login recipe) in light and dark at 1440 and 390: nothing unreadable, no leftover brown/gold/olive
- [x] `grep -r "gradient-text\|gradient-primary\|glow-\|shadow-warm\|\bglass\b" app components` returns nothing
- [x] Fonts load (no fallback flash in the network panel; `document.fonts` lists Literata and Archivo)

**Completed Notes:**
- Files modified: `app/globals.css`, `app/layout.tsx`, `components/ui/card.tsx`, `app/(public)/page.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/geo/map-context-panel.tsx`, `components/geo/map-page-client.tsx`, `app/global-error.tsx`, `public/site.webmanifest`, and star icons in `app/(app)/admin/analytics/page.tsx`, `app/(app)/admin/books/page.tsx`, `app/(app)/profile/page.tsx`, `app/(public)/users/[username]/page.tsx`, `components/home/community-feed.tsx`, `components/home/trending-now-list.tsx`, `components/recommendations/recommended-book-card.tsx`, `components/trending/trending-book-card.tsx`
- Approach taken: prototype palette mapped onto the existing shadcn token names, so components did not change. Light: paper/ink, ribbon red `--primary` (6.4:1 on background, white on it 7.5:1). `--accent` is a deeper ribbon (349 78% 27%) so the ~70 `accent` uses and primary→accent gradients stay one hue. Stars use `--star` (ink in light, 9.1:1; light ink in dark, 11.4:1). Dark "lights down": same hues, dimmer; dark `--destructive-foreground` uses the background colour because white on that red was 3.2:1. Added `--plank`, `--plank-shadow`, `--book-filter` and `--color-plank` for Task 5. `--radius` 0.75rem → 0.5rem. Fonts: Archivo (`wdth` axis) and Literata (`opsz` axis, italic) via `next/font/google` (read `01-app/03-api-reference/02-components/font.md` first); variables `--font-archivo`/`--font-literata`; H1–H3 get `text-wrap: balance` and optical sizing. Removed `.gradient-*`, `.glass`, `.glow-*`, `.shadow-warm*`; Card lost its warm shadow and hover lift; homepage CTA band is solid ribbon red in both modes.
- Deviations from plan: (1) star icons that used `fill-accent` (gold before) switched to `fill-star` in 8 files, otherwise they would have turned ribbon red; (2) also updated the manifest theme/background colour and the global error button, which hard-coded the old brown; (3) the CTA band became ribbon red, not ink, because an ink band turns into a bright stripe in dark mode.
- Issues encountered: none blocking. Left for later tasks: hero amber overlays and stock photo (Task 8), gold sparkle icons (Task 3), icons/OG images still brown (Task 2), Trending rank medals and flame icon are hard-coded gold/silver/bronze/orange (not scheduled; added to Out of Scope), semantic amber/orange warnings in ~40 files kept on purpose. Verified: lint 0/0, build passes; Playwright at 1440 light+dark (`/`, `/books/a-game-of-thrones`, `/trending`, signed-in `/dashboard` via a throwaway account, deleted afterwards) and 390 light (`/books/a-game-of-thrones`); fonts loaded (`document.fonts`: Archivo, Literata); no horizontal scroll.

**Status:** [x] COMPLETE

---

## Task 2: New logo and drop the tagline

**Source:** Design direction doc > §4 rule 6; owner decision 2026-09-29 (keep name, drop tagline)  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** new `components/brand/logo.tsx`; `components/layout/navbar.tsx` (L51), `components/layout/footer.tsx` (L57, L64), `components/layout/app-top-bar.tsx` (L55); `app/icon.tsx`, `app/apple-icon.tsx`, `app/icons/icon-192/route.tsx`, `app/icons/icon-512/route.tsx`, `app/opengraph-image.tsx`; `app/(public)/page.tsx` (L35, L49); `components/home/home-hero.tsx` (L80)

**Context:** The current logo is Lucide's `BookOpen` in a rounded brown square, used in three layout components. The new mark is three spines of different heights with the last one leaning, the middle one ribbon red (prototype SVG). The tagline appears in the homepage title and Open Graph title, the hero heading and the footer.

**Steps:**
1. [x] Create `components/brand/logo.tsx`: SVG mark (currentColor + ribbon token) and optional wordmark in Literata; `aria-label="OhMyReads"`
2. [x] Use it in navbar, footer and app top bar; remove the `BookOpen` brand imports
3. [x] Redraw the favicon, apple icon, PWA icons and default OG image with the new mark (read the `ImageResponse` docs in `node_modules/next/dist/docs/` first)
4. [x] Homepage metadata title → "OhMyReads — Every book you've read, on one shelf" (or similar, owner can adjust); remove the tagline from the footer
5. [x] Hero heading: temporary new copy ("Every book you've read, on one shelf."); Task 8 redesigns the hero
6. [x] `grep -r "Independent Minds" app components lib` returns nothing

**Verify:**
- [x] Logo renders in light and dark on navbar, footer, app top bar
- [x] `/icon`, `/apple-icon`, `/icons/icon-192`, `/icons/icon-512`, `/opengraph-image` return the new images (screenshot each)
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: new `components/brand/logo.tsx` (`LogoMark`, `Logo`, shared `LOGO_SPINES` geometry), new `lib/brand/app-icon.tsx` (`IconTile`, `BrandMark`, brand colour literals, `loadGoogleFont`); `components/layout/navbar.tsx`, `footer.tsx`, `app-top-bar.tsx`; `app/icon.tsx`, `app/apple-icon.tsx`, `app/icons/icon-192/route.tsx`, `app/icons/icon-512/route.tsx`, `app/opengraph-image.tsx`; `app/(public)/page.tsx` (title + OG title), `components/home/home-hero.tsx` (H1)
- Approach taken: one mark (three spines on a shelf; middle spine ribbon red; last spine leaning -10° and drawn first so the ribbon spine covers its corner) defined once and reused by the React logo and every generated image. App logo: mark in ink + Literata wordmark, no tile; the top bar hides the wordmark below `sm`. Icons: paper mark on an ink tile with the brighter dark-mode ribbon for contrast; favicon keeps a 6px radius, apple and PWA icons are square (iOS and maskable icons are shaped by the OS). OG image: wall background, mark + wordmark, "Every book you've read, / on one shelf." in Literata (fetched from Google Fonts as TTF subset to the text; falls back to the default font if the fetch fails), and 17 spines with colours from real catalog covers on a plank. Homepage title and OG title now "OhMyReads - Every book you've read, on one shelf"; hero H1 temporary copy with the italic half in ink (ribbon reserved for actions); footer tagline removed. Read `image-response.md` first.
- Deviations from plan: the OG headline is on two rows. Satori mis-measures upright and italic faces of the same family side by side, so the italic half overlapped "read," (proved with a temporary probe word; `&nbsp;`, margin and gap had no visible effect). Kept `runtime = "edge"` on the existing edge routes to keep the change minimal.
- Issues encountered: see deviation. Not touched: `app/api/og/{book,review,stats}` still use gold (#d4a853) stars and their own layouts; Task 10 covers share images. Verified: `/icon`, `/apple-icon`, `/icons/icon-192`, `/icons/icon-512`, `/opengraph-image` all 200 image/png and inspected; logo in navbar (light, dark), footer (dark, no tagline), app top bar (light, dark, 390 mark-only) via a throwaway account, deleted afterwards; `grep "Independent Minds"` empty; lint clean; build passes.

**Status:** [x] COMPLETE

---

## Task 3: Replace sparkle icons (27 files)

**Source:** Design direction doc > §4 rule 8  
**Priority:** 🟡 Medium  
**Effort:** Medium  
**File(s):** `app/(app)/admin/enrichment/page.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/settings/page.tsx`, `app/(public)/lists/page.tsx`, `app/(public)/pricing/page.tsx`, `app/(public)/recommendations/page.tsx`, `components/ai/ai-book-search.tsx`, `components/books/{book-browser,recommendation-reason,recommended-books-row}.tsx`, `components/challenges/{active-challenges-widget,challenge-card,create-challenge-form}.tsx`, `components/community/my-shelf-panel.tsx`, `components/dashboard/{first-run-checklist,recommendations-section}.tsx`, `components/discover/readers-like-you.tsx`, `components/geo/ai-place-search.tsx`, `components/home/{home-hero,reading-activity-panel}.tsx`, `components/layout/{mobile-bottom-nav,sidebar}.tsx`, `components/onboarding/taste-onboarding-wizard.tsx`, `components/recommendations/{recommendations-grid,recommended-book-card}.tsx`, `components/search/unified-search.tsx`, `components/social/suggested-follows.tsx`

**Context:** Sparkles are the 2024–26 shorthand for "AI" and contradict "real reader recommendations, not algorithms". Each use needs a meaning-based replacement, not a blanket swap: "For You" → a bookmark or ribbon, mood search → search/compass, challenges → target, onboarding → shelf. Admin pages can use anything plain.

**Steps:**
1. [x] For each file, decide the replacement by what the icon labels; list the mapping in Completed Notes
2. [x] Replace; remove unused `Sparkles` imports
3. [x] `grep -r "Sparkles" app components` returns nothing

**Verify:**
- [x] `npm run lint` clean
- [x] Spot-check sidebar, mobile bottom nav, `/recommendations`, homepage search in the browser

**Completed Notes:**
- Files modified: the 27 files listed above (no others).
- Approach taken: replaced by meaning, not one blanket icon. Mapping: "For You" / recommendations → `Bookmark` (sidebar, mobile nav, `/recommendations` header, dashboard recs, hero bullet, reason fallbacks); mood search → `Compass` (mood search button and dialog, "try mood search" links); taste profile → `SlidersHorizontal` (settings, first-run checklist, onboarding step, "Set up taste profile"); genre → `Tag` (reason `genre_match` in 2 files, genre challenges in 3 files); shelf / "more like this" / empty state → `Library` ("Get Started", "Start Tracking", recommended row header, recs empty state); curated collections → `BookMarked` (`/lists`); reader discovery → `Users` (Readers Like You) and `UserSearch` (Suggested Follows); map place search → `Search` (button) and `MapPin` ("Find Places" header); admin enrichment → `FilePenLine`; pricing "Most Popular" → `BadgeCheck`. Mood chips (Cozy, Thrilling, ...) lost their icon. `recommendation-reason.tsx` now types its map as `LucideIcon` instead of `typeof Sparkles`. Also removed two AI-style gradients next to these icons (`/recommendations` header box → `bg-primary`; mood search button `from-primary/5 to-purple-500/5` → `bg-primary/5`) and two amber icon colours (`/lists`, hero bullet → `text-primary`).
- Deviations from plan: the gradient and amber changes above were not listed but sat on the same elements.
- Issues encountered: my first replacement script dropped `Sparkles` from imports without adding the new icon in 13 files (12 lint errors, matching tsc errors); fixed with a second pass that adds any used-but-unimported icon and removed one duplicated `LucideIcon` type import. Final: `grep Sparkles app components` empty, lint 0/0, `tsc --noEmit` clean, build passes. Browser checks (throwaway account, deleted): homepage mood chips, `/recommendations` header, desktop sidebar, mobile "More" sheet, settings Taste Profile in dark mode. Noticed, not changed: the "curated pick" reason badges on recommendation cards use amber (`REASON_COLORS` in `recommended-book-card.tsx`); added to Out of Scope.

**Status:** [x] COMPLETE

---

## Task 4: Spine data: colour columns, pipeline hook, backfill

**Source:** Design direction doc > §5; prototype Task 1 notes  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** new `supabase/migrations/077_book_spine_colours.sql`; new `lib/covers/spine-colour.ts`; `lib/covers/pipeline.ts` (`processBook` ~L425, update ~L503); new `scripts/backfill-spine-colours.ts`; `package.json` (script entry); `types/database.generated.ts` (via `npm run types:gen`, never by hand)

**Context:** Spine colours must be stored, not computed in the browser. The prototype's algorithm (`.claude/prototypes/shelf/build-data.mjs`: saturation-weighted colour buckets from the cover's left third, plus a contrasting lettering colour) worked on 97 real covers. Covers are already processed server-side by `lib/covers/pipeline.ts` with `sharp`, so the colour is computed at the same point. Books with no cover get `null` and the component falls back to a genre colour.

**Steps:**
1. [x] Migration 077: `alter table books add column spine_color text, add column spine_ink text` (hex `#rrggbb`, check constraint on format); apply with `npx supabase db query --linked -f ...`
2. [x] `npm run types:gen`
3. [x] `lib/covers/spine-colour.ts`: port the prototype algorithm as `spineColours(buffer): { color, ink | null }`, returning hex
4. [x] Call it in the cover pipeline where the stored cover is written, and include both columns in that update
5. [x] `scripts/backfill-spine-colours.ts` (`--dry-run`, `--limit N`, only rows with `cover_url` and null `spine_color`); add `npm run covers:spines`
6. [x] Run on 20 books with `--dry-run`, check output, then run the full backfill
7. [x] Admin writes: the backfill uses the service-role client (see memory: counter freeze and admin RLS gap), and checks updated row counts

**Verify:**
- [x] `select count(*) filter (where spine_color is not null), count(*) filter (where cover_url is not null) from books` shows (nearly) all covered books filled
- [x] Spot-check 10 books against their covers
- [x] A newly processed cover (`npm run covers:process -- --ids <one id>`) gets spine colours
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: new `supabase/migrations/077_book_spine_colours.sql` (applied to prod), new `lib/covers/spine-colour.ts`, `lib/covers/pipeline.ts` (import + spine colours in the `processBook` update), new `scripts/backfill-spine-colours.ts`, `package.json` (`covers:spines`), `types/database.generated.ts` (regenerated), `__tests__/lib/covers/pipeline.test.ts` (update expectation includes the two new columns)
- Approach taken: `spine_color`/`spine_ink` text columns with `^#[0-9a-f]{6}$` checks. `spineColours(buffer)` is the prototype algorithm unchanged (left third → 24×72, 4-bit buckets, saturation-weighted score, ink = most prominent bucket ≥ 2 % with a luminance gap > 90), returning lowercase hex; EXIF orientation is applied first. The pipeline computes it from the winning candidate and writes it in the same update as `cover_url`; a colour failure is logged and does not lose the cover. Backfill uses the service-role client, checks each updated row count, 6 at a time, only sleeps for non-bucket hosts.
- Deviations from plan: none. Side effect of the Verify re-process: Misery's stored cover (a white blurb page) was replaced by the real jacket, because `--ids` implies `--force`.
- Issues encountered: none. Results: 5,216 of 5,216 covered books have `spine_color` (0 failures), 2,288 have `spine_ink`; 352 rows without a cover stay null (genre fallback in Task 5). Contact sheet of 10 random books: every swatch matches its cover's left edge. `npm run covers:process -- --ids <Misery> --keep-existing` after nulling its columns wrote `#b57a2a`/`#25160d`. Lint 0/0, tsc clean, cover tests 34/34.

**Status:** [x] COMPLETE

---

## Task 5: Shelf component in React

**Source:** Design direction doc > §2–4; prototype  
**Priority:** 🔴 Critical  
**Effort:** High  
**File(s):** new `components/shelf/shelf.tsx`, `components/shelf/spine.tsx`, `components/shelf/bookend.tsx`, `components/shelf/fit-spine-titles.ts`, `components/shelf/genre-lettering.ts`

**Context:** One component used by the profile, import result, homepage and (later) stats. The prototype's layout trick carries over: a flex-wrap container where every line is exactly one shelf tall and a repeating gradient draws the planks, so shelves wrap at any width without JS. Spines are server-rendered; a small client island fits titles after fonts load and handles pull-out. Prototype known issue: 23 of 88 spines truncated titles; fix here.

**Steps:**
1. [ ] `Spine`: width from page count (prototype formula), height by genre family plus a stable hash, `spine_color`/`spine_ink` with genre fallbacks and a contrast check, genre lettering family, `aria-label` with title, author, pages, finished date; a `<button>` or link to the book page
2. [ ] `Shelf`: wrap layout, planks, optional month labels, optional leaning last book, optional `Bookend`, empty state ("Room for your first book.")
3. [ ] Title fitting: shrink, then narrow (Archivo `wdth`), then allow two vertical lines on spines ≥ 34px wide, then drop a leading "The"/"A", and only then truncate; target ≤ 5 % truncated on the prototype's 88 books
4. [ ] Pull-out on hover/focus and a detail line (title, author, pages, date); keyboard reachable; `prefers-reduced-motion` respected
5. [ ] List view toggle (table) for accessibility
6. [ ] "Lights down": apply `--book-filter` in dark mode
7. [ ] A dev-only page or story is not needed; test through Task 6

**Verify:**
- [ ] Renders 0, 1, 20 and 300 books without layout breakage (use a temporary test route or the profile of the Playwright dev-login account; remove any temporary route)
- [ ] Truncated titles ≤ 5 % on a 90-book sample
- [ ] Keyboard: tab through spines, focused spine pulls out, detail readable
- [ ] No horizontal page scroll at 390px
- [ ] `npm run lint` clean

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 6: Profile shelf by year, with the empty shelf

**Source:** Design direction doc > §3 "Profile", "Empty states"  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`, new query in `lib/queries/` (e.g. `getShelfByYear`)

**Context:** The profile becomes the reader's bookcase: one shelf per year (by `user_books.finished_at`, status `read`), newest first, with the current book shown face out with a ribbon. The public profile currently lists 12 books by status (`getUserBooks`, L106). Migration 056 gates `user_books` reads on `discovery_visible`; keep that privacy behaviour.

**Steps:**
1. [ ] Query: read books with `finished_at` (fallback `updated_at` when null) plus spine columns, grouped by year; respect the existing visibility gate
2. [ ] Public profile: year shelves with book count and pages per year, currently-reading card with ribbon, want-to-read face out, and the empty shelf for a new reader
3. [ ] Own profile (`/profile`): same component, plus "Add a book you loved" on the empty shelf linking to search
4. [ ] Keep existing followers/following and friendship controls working

**Verify:**
- [ ] Profile with 0 books shows the empty shelf; with books shows year shelves (dev-login account, add a few books)
- [ ] A private (`discovery_visible = false`) profile shows no books to other users
- [ ] Mobile 390 and dark mode screenshots
- [ ] `npm run lint` clean; `npm run build` passes

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 7: Goodreads import result as a wall of spines

**Source:** Design direction doc > §3 "Goodreads import"  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/import/goodreads-import.tsx`, `lib/actions/import.ts`

**Context:** Importing is the moment people understand the product: years of reading appear at once. The import action should return (or the page should fetch) the imported read books with spine data so the result screen shows the whole wall, with a link to the profile.

**Steps:**
1. [ ] After a successful import, show the reader's full shelf by year (Task 5 component) with totals ("412 books, 118,000 pages since 2014")
2. [ ] Books without covers still get genre-fallback spines
3. [ ] Link to the profile and (after Task 10) the share image

**Verify:**
- [ ] Import a real Goodreads CSV with the dev-login account (owner's export if available, otherwise a generated sample CSV) and screenshot the result
- [ ] Large import (500+ books) renders without jank on mobile
- [ ] `npm run lint` clean

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 8: Homepage: shelf hero and new copy

**Source:** Design direction doc > §3 "Homepage"; earlier review (stock photo, curated picks, placeholder covers)  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/home/home-hero.tsx`, `app/(public)/page.tsx`, `components/home/reading-activity-panel.tsx`, new `lib/curated-picks.ts`

**Context:** Replace the stock "cozy reader" photo with a real shelf, and the generic copy ("Track Your Reading Life", "Ready to start your reading journey?") with specific copy. The hero shelf is a hand-picked "staff shelf" (the owner's picks, labelled honestly), which also replaces the most-rated "Curated for You" list. The gradient placeholder covers in the activity preview go away.

**Steps:**
1. [ ] ⚠️ Ask the owner for 20–30 hand-picked books (or propose a list for approval); store slugs in `lib/curated-picks.ts`
2. [ ] Hero: headline, one line of copy, the staff shelf, primary button "Build your shelf", secondary "Bring your Goodreads shelf"
3. [ ] Remove `public/images/hero.webp` usage and the four gradient overlay layers
4. [ ] Replace the features grid and CTA band copy with shelf-specific copy; remove the placeholder gradient covers in the activity preview
5. [ ] "Curated for You" fallback uses the staff picks (keep personalised recs for signed-in readers with signals)

**Verify:**
- [ ] Screenshots at 1440 and 390, light and dark; the first screen on mobile shows the shelf
- [ ] LCP not worse than before (Lighthouse mobile, before/after numbers in notes)
- [ ] `npm run lint` clean

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 9: Homepage: pick 3 books before sign-up, keep them after

**Source:** Design direction doc > §3 "Homepage" (value before sign-up)  
**Priority:** 🟡 Medium  
**Effort:** High  
**File(s):** new `components/home/shelf-starter.tsx`; signup/onboarding flow (`app/(auth)/signup`, `app/(app)/onboarding`, `lib/actions/shelves.ts`)

**Context:** A visitor types three books they loved and watches their shelf start, then signs up to keep it. The picks must survive sign-up (including Google OAuth, which from localhost lands on prod; see memory) and be added as "read" on first sign-in.

**Steps:**
1. [ ] Client island: search box (existing search endpoint), up to 3 picks placed on a small shelf with the Task 5 component
2. [ ] Store picks in `localStorage` (try/catch) and pass through the signup redirect
3. [ ] On first sign-in / onboarding, add the picks to the new reader's shelf as read (server action, validated ids), then clear them
4. [ ] "Keep your shelf" button → signup

**Verify:**
- [ ] Email signup path keeps the picks (Playwright dev-login recipe)
- [ ] Google OAuth path keeps the picks (verify on a deployed preview; may be verification-blocked locally)
- [ ] Invalid or tampered ids are rejected
- [ ] `npm run lint` clean

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 10: Share image of a year's shelf

**Source:** Design direction doc > §2 "No way to spread", §5 (Satori risk)  
**Priority:** 🟠 High  
**Effort:** High  
**File(s):** new `app/api/og/shelf/route.tsx`; share button on the profile (Task 6 files); existing patterns in `app/api/og/{book,review,stats}/route.tsx`

**Context:** "My 2026 shelf" as an image is how the product spreads. Open question from the direction doc: can Satori (`next/og`) draw sideways spine text? Spike first; if it can't, render spine titles as rotated SVG text or drop titles at share size (the prototype's 9:16 card uses tiny titles anyway).

**Steps:**
1. [ ] Read the `ImageResponse` docs in `node_modules/next/dist/docs/`; spike rotated text (CSS `transform: rotate(-90deg)` and SVG `<text transform>`) and pick what renders
2. [ ] `/api/og/shelf?user=<username>&year=2026&format=story|square`: 1080×1920 and 1200×1200, with the logo, year, shelf, books, pages
3. [ ] Respect profile privacy (no image for hidden profiles)
4. [ ] Share button on the profile: copy link, download image
5. [ ] Year page URL uses this image as its Open Graph image

**Verify:**
- [ ] Images render for 1, 20 and 80 books; screenshot each
- [ ] Hidden profile returns 404
- [ ] Response is cached (check headers) and renders under the function time limit
- [ ] `npm run lint` clean

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** [ ] PENDING

---

## Task 11: Honest zero states and labels

**Source:** Earlier design review 2026-09-29 (previous version of this plan, Tasks 2, 3, 4, 5)  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/trending/trending-book-card.tsx` (L95–113), `app/(public)/books/[slug]/page.tsx` (L475, L530), `components/books/recommended-books-row.tsx` (L75), `lib/queries/recommendations.ts` (L408)

**Context:** On launch day there is no activity, so these still show emptiness or overclaim: every Trending card reads "+0 reviews · +0 adds" (filler books from `getTrulyTrending`); book pages lead with a large "No reviews yet" block; "Readers also enjoyed" is a genre match; its ★ badges show Open Library ratings with no sample-size check (many ★5.0).

**Steps:**
1. [ ] Trending card: show each metric only when > 0; when both are 0, show `reason.label` ("1,411 ratings") instead
2. [ ] Book page: replace the empty-review `EmptyState` with one line and a sign-in link; hide "(0)" in the heading
3. [ ] Rename "Readers also enjoyed" / "Readers like you also enjoyed" to "More like this"
4. [ ] Show the ★ badge only when `ratings_count` ≥ 25 (check the column is in `BOOK_CARD_COLUMNS`)

**Verify:**
- [ ] `/trending`: no "+0"; a book with real activity still shows its counts
- [ ] `/books/a-game-of-thrones`: one-line empty state, "More like this", no ★5.0 on low-sample books
- [ ] `npm run lint` clean

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
**File(s):** -

**Context:** Check the whole redesign together on a production build before deploying.

**Steps:**
1. [ ] Stop `next dev`; `npm run build`; `npm run lint`
2. [ ] Playwright screenshots at 1440 and 390, light and dark: `/`, `/books/a-game-of-thrones`, `/trending`, `/users/<dev account>`, `/profile`, `/import` result, `/dashboard`
3. [ ] Keyboard pass over a shelf; screen-reader labels spot-checked
4. [ ] Lighthouse mobile on `/` and a profile: record performance and accessibility scores
5. [ ] ⚠️ Ask the owner before deploying to production

**Verify:**
- [ ] Build passes; lint 0 errors, 0 warnings
- [ ] No leftover brown/gold/olive, gradients, sparkles, tagline or stock photo
- [ ] Accessibility score not lower than before
- [ ] Production checked after the owner-approved deploy

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
| Delete the 6 test reviews | Pre-launch data cleanup, not design; belongs to the launch checklist (`.claude/plans/launch-2026-09.md`) and needs the owner's confirmation | Launch day |
| Stats page as a shelf | Needs Tasks 4–6 first | After launch |
| "On N shelves" on book pages | Needs real shelf data | After launch |
| Finish animation everywhere a book is marked read | Profile and homepage first | After launch |
| Cut the signed-in sidebar from 16 items to 4–5 places | Information-architecture decision | Next plan |
| Fix wrong primary genre labels in the catalog (e.g. *The Subtle Knife* = Horror) | Data work; only affects spine lettering style | After launch |
| Printed shelf poster (revenue) | Business decision | Later |
| Rename Trending to "Popular" while there is no activity | Task 11 covers the worst of it | After launch |
| Email templates and unsubscribe page restyle (`lib/email/templates/*`, `app/api/email/unsubscribe/route.ts` still use brown #8B5A2B) | Emails are not live yet (no Resend in prod) | With the Resend launch step |
| Trending page rank medals (gold/silver/bronze) and orange flame icon | Hard-coded colours outside the tokens; small | Next design pass |
| Amber "curated pick" and other reason badge colours on recommendation cards (`REASON_COLORS` in `components/recommendations/recommended-book-card.tsx`, `components/books/recommendation-reason.tsx`) | Hard-coded amber/rose/etc. per reason type; small restyle | With Task 11 or the next design pass |
| Reader feedback on the prototype | Optional, owner may share the prototype link; feed findings into open tasks | Any time |

---

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Migration 077 applied and types regenerated
- [ ] Shelf works with 0, 1 and hundreds of books, light and dark, desktop and mobile
- [ ] Keyboard and screen-reader access to every spine
- [ ] No console errors
- [ ] Memory updated (next migration number, design decisions)

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-09-29 | - | Created | First version: 8 pre-launch design fixes from the design review |
| 2026-09-29 | - | Rewritten | Shelf direction approved after prototype; name kept, tagline dropped; 12-task build plan replaces the earlier version |
| 2026-09-29 | 1 | ✅ Complete | Paper/ink + ribbon tokens, lights-down dark mode, Literata + Archivo, effects removed; lint and build pass |
| 2026-09-29 | 2 | ✅ Complete | Spine logo in navbar/footer/top bar; icons and default OG image redrawn; tagline removed |
| 2026-09-29 | 3 | ✅ Complete | Sparkles replaced by meaning in 27 files; two AI-style gradients removed; lint, tsc, build pass |
| 2026-09-29 | 4 | ✅ Complete | Migration 077 applied; spine colours in the cover pipeline; backfill filled 5,216/5,216 covered books |
| | | | |
