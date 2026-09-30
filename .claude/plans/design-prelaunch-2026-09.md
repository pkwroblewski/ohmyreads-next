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
| 5 | Shelf component in React | 🔴 Critical | High | [x] COMPLETE | new `components/shelf/*` |
| 6 | Profile shelf by year, with the empty shelf | 🔴 Critical | Medium | [x] COMPLETE | `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`, new query in `lib/queries/` |
| 7 | Goodreads import result as a wall of spines | 🟠 High | Medium | [x] COMPLETE | `components/import/goodreads-import.tsx`, `lib/actions/import.ts` |
| 8 | Homepage: shelf hero and new copy | 🟠 High | Medium | [x] COMPLETE | `components/home/home-hero.tsx`, `app/(public)/page.tsx`, new `lib/curated-picks.ts` |
| 9 | Homepage: pick 3 books before sign-up, keep them after | 🟡 Medium | High | [x] CODE COMPLETE - Verification blocked | new `components/home/shelf-starter.tsx`, onboarding/signup flow |
| 10 | Share image of a year's shelf | 🟠 High | High | [x] COMPLETE | new `app/api/og/shelf/route.tsx`, profile share button |
| 11 | Honest zero states and labels | 🟠 High | Medium | [x] COMPLETE | `components/trending/trending-book-card.tsx`, `app/(public)/books/[slug]/page.tsx`, `components/books/recommended-books-row.tsx`, `lib/queries/recommendations.ts` |
| 12 | Final QA | - | Medium | [ ] PENDING | `app/globals.css`, `app/(public)/page.tsx` |

**Progress: 11/12 complete** (Task 9 code complete; Google OAuth check pending a deploy)

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
1. [x] `Spine`: width from page count (prototype formula), height by genre family plus a stable hash, `spine_color`/`spine_ink` with genre fallbacks and a contrast check, genre lettering family, `aria-label` with title, author, pages, finished date; a `<button>` or link to the book page
2. [x] `Shelf`: wrap layout, planks, optional month labels, optional leaning last book, optional `Bookend`, empty state ("Room for your first book.")
3. [x] Title fitting: shrink, then narrow (Archivo `wdth`), then allow two vertical lines on spines ≥ 34px wide, then drop a leading "The"/"A", and only then truncate; target ≤ 5 % truncated on the prototype's 88 books
4. [x] Pull-out on hover/focus and a detail line (title, author, pages, date); keyboard reachable; `prefers-reduced-motion` respected
5. [x] List view toggle (table) for accessibility
6. [x] "Lights down": apply `--book-filter` in dark mode
7. [x] A dev-only page or story is not needed; test through Task 6

**Verify:**
- [x] Renders 0, 1, 20 and 300 books without layout breakage (use a temporary test route or the profile of the Playwright dev-login account; remove any temporary route)
- [x] Truncated titles ≤ 5 % on a 90-book sample
- [x] Keyboard: tab through spines, focused spine pulls out, detail readable
- [x] No horizontal page scroll at 390px
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: new `components/shelf/genre-lettering.ts` (family by genre, width/height, colours with 3:1 ink check and genre fallbacks, first-guess title size), `components/shelf/spine.tsx` (`Spine`, `ShelfBook` type, date/description helpers), `components/shelf/bookend.tsx`, `components/shelf/shelf.tsx` (`Shelf`: wrap layout, planks, month labels, lean, bookend, empty state, list table), `components/shelf/shelf-client.tsx` (client island), `components/shelf/fit-spine-titles.ts`, `components/shelf/shelf.module.css`. No existing files changed.
- Approach taken: `Shelf` and `Spine` are server components; each spine is a link to `/books/[slug]` with a full `aria-label` (title, author, pages, finished date). Genre = `books.genres[0]` (callers map it into `ShelfBook`). `ShelfClient` wraps the server-rendered `<ul>`: after `document.fonts.ready` it runs the fitter, hides colliding month labels, re-fits at the 640px breakpoint, shows the hovered/focused spine in a fixed detail bar (above the mobile bottom nav, `aria-hidden` because the aria-label already says it), and toggles Shelf/List (`listView` prop, table with swatch, title link, author, genre, pages, finished). The fitter works in rounds over all titles (read every overflow, then write every change), so 300 spines cost a few dozen layouts. Pull-out is CSS `:hover`/`:focus-visible`; reduced motion removes the transition. Dark mode uses `--book-filter` from globals.
- Deviations from plan: (1) One extra fitting step before truncation: hide the author surname on that spine (it stays in the aria-label and detail bar); the title box was only ~76px of a 162px spine on narrow books. (2) Two vertical lines from 24px wide, not 34px: two 6.5px lines fit in ~14px, and 34px left the target out of reach (5.7%). (3) Added `shelf-client.tsx` and `shelf.module.css` (first CSS module in the repo; the plank gradient, spine pseudo-elements and per-genre lettering are unwieldy as utilities).
- Issues encountered: (1) Prototype sample (88 books, desktop): 4 truncated = 4.5% (prototype 23/88); 16 use two lines, 8 hide the author, 3 drop "The". First 300 catalog books: 0 truncated at 1280px, 20 (6.7%) at 390px, where shelves are shorter and spines 0.8x. (2) Testing traps: the PWA service worker served stale client chunks in the Playwright browser (unregistered it), and Turbopack's `.next` cache served pre-Task-1 `globals.css` (fixed with `rm -rf .next`). (3) Full `vitest run`: 789 pass, `quick-rating.test.tsx` failed once under load and passes alone (4/4); it does not import shelf code. Checked through a temporary `/shelf-test` route (0, 1, 20, 300 books and the prototype sample; removed): no horizontal scroll at 390px, Tab reaches spines, focused spine lifts 14px and the detail bar shows it, List shows all rows, dark filter `brightness(0.84) saturate(0.92)`. Lint 0/0, tsc clean, build passes.

**Status:** [x] COMPLETE

---

## Task 6: Profile shelf by year, with the empty shelf

**Source:** Design direction doc > §3 "Profile", "Empty states"  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`, new query in `lib/queries/` (e.g. `getShelfByYear`)

**Context:** The profile becomes the reader's bookcase: one shelf per year (by `user_books.finished_at`, status `read`), newest first, with the current book shown face out with a ribbon. The public profile currently lists 12 books by status (`getUserBooks`, L106). Migration 056 gates `user_books` reads on `discovery_visible`; keep that privacy behaviour.

**Steps:**
1. [x] Query: read books with `finished_at` (fallback `updated_at` when null) plus spine columns, grouped by year; respect the existing visibility gate
2. [x] Public profile: year shelves with book count and pages per year, currently-reading card with ribbon, want-to-read face out, and the empty shelf for a new reader
3. [x] Own profile (`/profile`): same component, plus "Add a book you loved" on the empty shelf linking to search
4. [x] Keep existing followers/following and friendship controls working

**Verify:**
- [x] Profile with 0 books shows the empty shelf; with books shows year shelves (dev-login account, add a few books)
- [x] A private (`discovery_visible = false`) profile shows no books to other users
- [x] Mobile 390 and dark mode screenshots
- [x] `npm run lint` clean; `npm run build` passes

**Completed Notes:**
- Files modified: new `lib/queries/shelf.ts` (`getProfileShelf`), new `components/shelf/profile-shelves.tsx` (`ProfileShelves`), `app/(public)/users/[username]/page.tsx`, `app/(app)/profile/page.tsx`
- Approach taken: `getProfileShelf(userId)` reads the reader's `user_books` (read, reading, want_to_read) with the book's spine columns and cover fields through the session client, 1,000 rows a page (PostgREST cap), up to 10,000. Read books are grouped by year of `finished_at` (fallback `updated_at`), newest year first, oldest book first. `ProfileShelves` shows reading-now cards (cover face out with the ribbon, progress bar, "Page X of Y"), one `Shelf` per year with "N books · X pages" ("· so far", bookend and no lean for the current year; the last book leans on finished years), month labels, and "Up next": up to 12 want-to-read covers face out on a plank. With no read books it shows the empty shelf; on your own profile it adds "Add a book you loved" → `/books`. Both profile pages replace their 12-book grid with it. The section heading is now "Shelves"; `/profile` keeps "View all →" to `/my-shelf`.
- Deviations from plan: the public profile's All/Reading/Read/Want tabs (`?tab=`) are gone, because the bookcase shows all of them at once; nothing else linked to `?tab=`. "Add a book you loved" links to `/books` (browse with search) because there is no `/search` page. The Shelf/List toggle is per year, which is fine for a few years; worth revisiting for a 10-year Goodreads import (Task 7).
- Issues encountered: none in the code. Checked with two throwaway accounts (created and deleted by a temporary script): reader A with 30 read books (2025 and 2026), 1 reading and 6 want-to-read; reader B with none. Signed out: A shows the 2026 and 2025 shelves, reading card and Up next; B shows the empty shelf without the add button. A set to `discovery_visible = false`: signed out and signed in as B, A's profile shows "Shelves are private" and 0 spines; A's own `/profile` still shows all 30 spines. B's own `/profile` shows the empty shelf with "Add a book you loved". Friend/Follow buttons still render on another reader's profile. Screenshots at 1280 light and 390 dark: no horizontal scroll, and the lights-down filter applies to spines and covers. Lint 0/0, tsc clean, 790 tests pass, build passes.

**Status:** [x] COMPLETE

---

## Task 7: Goodreads import result as a wall of spines

**Source:** Design direction doc > §3 "Goodreads import"  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/import/goodreads-import.tsx`, `lib/actions/import.ts`

**Context:** Importing is the moment people understand the product: years of reading appear at once. The import action should return (or the page should fetch) the imported read books with spine data so the result screen shows the whole wall, with a link to the profile.

**Steps:**
1. [x] After a successful import, show the reader's full shelf by year (Task 5 component) with totals ("412 books, 118,000 pages since 2014")
2. [x] Books without covers still get genre-fallback spines
3. [x] Link to the profile and (after Task 10) the share image

**Verify:**
- [x] Import a real Goodreads CSV with the dev-login account (owner's export if available, otherwise a generated sample CSV) and screenshot the result
- [x] Large import (500+ books) renders without jank on mobile
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: `lib/actions/import.ts` (returns `shelf`; shelf-check chunk fix), `components/import/goodreads-import.tsx` (wall, totals, profile link; the 50-row "Successfully imported" list removed), `app/(app)/import/page.tsx` (`max-w-2xl` → `max-w-4xl` so the wall has room), `__tests__/lib/actions/import.test.ts` (mocks `getProfileShelf`, asserts the shelf is returned), `lib/queries/shelf.ts` (undated shelf), `components/shelf/profile-shelves.tsx` (`YearShelves` extracted and exported), `components/shelf/shelf-client.tsx`, `components/shelf/fit-spine-titles.ts`, `components/shelf/shelf.module.css` (performance, below)
- Approach taken: after a successful insert, `importFromGoodreads` returns `shelf: getProfileShelf(user.id).years`. The result screen leads with "Your shelf: 521 books, 182,191 pages since 2014" and `YearShelves` (the same component as the profile), then the existing counts, errors and not-in-catalog list, then "Import another file" / "See your profile". The shelf components are server-safe but have no server-only code, so they render inside this client component unchanged. Coverless books get genre spines from Task 5 (checked: all 20 coverless books in the test use fallback colours).
- Deviations from plan: (1) Read books without a finish date now go on one "No date" shelf after the years, not into the year of `updated_at` (Task 6's fallback). The app always sets `finished_at`, so a null only comes from imports without "Date Read", and the fallback piled them all into 2026 ("412 books · so far"). (2) Step 3's share-image link moved to Task 10 step 6. (3) Fixed a pre-existing import bug found while testing: the "already on shelf" check sent 500 UUIDs per request (~18 KB URL; 300 work, 500 fail with "fetch failed") and ignored the error, so re-importing any library with more than ~300 matched books counted every book as new and the batch insert failed on the unique key. Now chunks of 100, and a failed check stops the import with a message. (4) Performance work for large walls (next point).
- Issues encountered: a 521-book import froze the page on a 4x-throttled CPU (longest task 5.9 s; 12.9 s from response to wall). Tracing showed layout, not React: 284 layouts, because each year shelf ran its own fitter (every round re-laid out the whole page), the fitter's setup and `tidyMonthLabels` interleaved reads and writes, and every shelf mounted a hidden 521-row list table. Fixes: one shared fitting pass for all shelves on a page (`scheduleFit`), read-then-write in setup and month tidying, the list table mounted only when chosen, and `content-visibility: auto` on shelves with fitting deferred until a shelf is within 600px of the viewport (so the top padding is now 16px, with planks positioned from the content box so they still line up). Result at 4x throttle: 2.6 s from response to wall, longest task 0.79 s, scrolling the whole wall stays at 0.5 s tasks or less. Disabling Link prefetch was tried and made no difference (reverted). Mobile truncation on this wall: 43/521 (8.3%); the ≤5% target in Task 5 was for desktop. Verified with a throwaway account and a generated 530-row Goodreads CSV (dates 2014-2026, 1 in 9 read rows without Date Read, 20 coverless books) on a production build (`next start`) at 390px: 13 year shelves plus "No date", no horizontal scroll, pulled-out spine not clipped, detail bar above the mobile nav; re-importing the same file reports 530 already on shelf with no errors. Account and CSV deleted. Lint 0/0, tsc clean, 790 tests pass, build passes.

**Status:** [x] COMPLETE

---

## Task 8: Homepage: shelf hero and new copy

**Source:** Design direction doc > §3 "Homepage"; earlier review (stock photo, curated picks, placeholder covers)  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/home/home-hero.tsx`, `app/(public)/page.tsx`, `components/home/reading-activity-panel.tsx`, new `lib/curated-picks.ts`

**Context:** Replace the stock "cozy reader" photo with a real shelf, and the generic copy ("Track Your Reading Life", "Ready to start your reading journey?") with specific copy. The hero shelf is a hand-picked "staff shelf" (the owner's picks, labelled honestly), which also replaces the most-rated "Curated for You" list. The gradient placeholder covers in the activity preview go away.

**Steps:**
1. [x] ⚠️ Ask the owner for 20–30 hand-picked books (or propose a list for approval); store slugs in `lib/curated-picks.ts`
2. [x] Hero: headline, one line of copy, the staff shelf, primary button "Build your shelf", secondary "Bring your Goodreads shelf"
3. [x] Remove `public/images/hero.webp` usage and the four gradient overlay layers
4. [x] Replace the features grid and CTA band copy with shelf-specific copy; remove the placeholder gradient covers in the activity preview
5. [x] "Curated for You" fallback uses the staff picks (keep personalised recs for signed-in readers with signals)

**Verify:**
- [x] Screenshots at 1440 and 390, light and dark; the first screen on mobile shows the shelf
- [x] LCP not worse than before (Lighthouse mobile, before/after numbers in notes)
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: new `lib/curated-picks.ts` (24 approved slugs, `inStaffOrder`), `lib/queries/shelf.ts` (`getStaffShelf`, cached 1 h on the public client, tag `books`), `lib/queries/recommendations.ts` (curated fallback leads with staff picks; the old rating-based list, now `fetchRatedFallback`, only tops it up), `components/home/home-hero.tsx` (rewritten), `app/(public)/page.tsx` (staff shelf instead of `getHomeCounts`, new features and closing-band copy), `components/home/reading-activity-panel.tsx` (gradient covers removed, "Build your shelf"), `components/home/home-feed.tsx` (anonymous panel title "Staff picks"), `next.config.ts` (comment only), `public/images/hero.webp` (deleted), `__tests__/lib/queries/recommendations.test.ts` (staff-first test), `components/shelf/shelf.module.css` (plank fix, below)
- Approach taken: the owner approved the proposed 24-book draft (AskUserQuestion, 2026-09-30): Dune, Nineteen Eighty-four, The Road, A Game of Thrones, Things Fall Apart, The Shining, And Then There Were None, The Kite Runner, Sapiens, Fahrenheit 451, Maus I, The Hunger Games, Le Comte de Monte-Cristo, The Diary of a Young Girl, Brave New World, The Silent Patient, Thinking Fast and Slow, The Seven Husbands of Evelyn Hugo, Matilda, The Odyssey of Homer, The Giver, Watchmen, On Writing, Northern Lights. The hero is headline, one line ("Start with one book you loved, or bring your whole Goodreads history. Independent, and your data is yours to export any time." — the CSV/JSON export exists at `/api/export`), "Build your shelf" → `/signup` and "Bring your Goodreads shelf" → `/login?redirect=/import` (signed in: "Go to your shelf" → `/profile`, "Browse books"), then the "Staff shelf · Picked by hand, not by an algorithm" shelf (no list toggle, last book leaning). The photo, four overlays, two blur blobs, the pills and the social-proof row are gone. Features: "Every book, spine out", "One shelf per year", "Bring your Goodreads years", "Yours to take with you"; section "Your reading life, as a shelf"; closing band "What was the last book you loved?" with "Build your shelf".
- Deviations from plan: (1) Buttons sit above the shelf, not below: below three rows of spines they would fall off the first mobile screen. (2) `getHomeCounts` is no longer called (the hero has no social-proof row); the function and its test stay for when counts are worth showing. (3) The anonymous "Curated for You" panel is now titled "Staff picks" and shows the first four picks, which repeat the start of the hero shelf. Signed-in readers without taste signals also get staff picks under the existing "Personalized Recommendations" title (deferred, see Out of Scope). (4) Fixed a Task 7 regression found in the 1440 screenshot: `background-origin: content-box` made the plank gradient's tile only as tall as the rows, so the plank under the last row never painted on any shelf. Now the gradient is offset with `background-position: 0 var(--pad-top)` from the padding box.
- Issues encountered: Lighthouse mobile (13.5, production build via `next start`, 3 runs each, median): before LCP 6,970 ms (element: the hero `<img>`), score 69, FCP 1,225, TBT 340, CLS 0; after LCP 6,835 ms (element: the `<h1>`), score 67, FCP 1,229, TBT 411, CLS 0.001. LCP is not worse; TBT is up ~70 ms (spine-fitting script). The text LCP still lands late under Lighthouse's simulated slow 4G because it waits on the Literata web font (deferred). Screenshots at 1440 and 390 in light and dark: no horizontal scroll; the first mobile screen shows the headline, both buttons and the first shelf row (first spine at 559px of 844). Truncated hero titles: 0/24 at 1440, 2/24 at 390. Lint 0/0, tsc clean, 791 tests pass, build passes.

**Status:** [x] COMPLETE

---

## Task 9: Homepage: pick 3 books before sign-up, keep them after

**Source:** Design direction doc > §3 "Homepage" (value before sign-up)  
**Priority:** 🟡 Medium  
**Effort:** High  
**File(s):** new `components/home/shelf-starter.tsx`; signup/onboarding flow (`app/(auth)/signup`, `app/(app)/onboarding`, `lib/actions/shelves.ts`)

**Context:** A visitor types three books they loved and watches their shelf start, then signs up to keep it. The picks must survive sign-up (including Google OAuth, which from localhost lands on prod; see memory) and be added as "read" on first sign-in.

**Steps:**
1. [x] Client island: search box (existing search endpoint), up to 3 picks placed on a small shelf with the Task 5 component
2. [x] Store picks in `localStorage` (try/catch) and pass through the signup redirect
3. [x] On first sign-in / onboarding, add the picks to the new reader's shelf as read (server action, validated ids), then clear them
4. [x] "Keep your shelf" button → signup

**Verify:**
- [x] Email signup path keeps the picks (Playwright dev-login recipe)
- [ ] Google OAuth path keeps the picks (verify on a deployed preview; may be verification-blocked locally)
- [x] Invalid or tampered ids are rejected
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: new `components/home/shelf-starter.tsx` (the island), new `components/home/starter-picks-claim.tsx` (claims picks after sign-in), new `lib/starter-picks.ts` (localStorage store: key, max 3, guarded reads/writes, `useSyncExternalStore` subscribe/snapshot with an in-memory fallback), `components/home/home-hero.tsx` (two columns on lg; starter beside the copy, signed out only), `components/layout/app-shell.tsx` (mounts the claim), `app/api/books/instant-search/route.ts` (adds `pageCount`, `spineColor`, `spineInk`; the route had no other callers), `lib/actions/books.ts` (new `addStarterPicks`), `lib/validation/book-action.ts` (`starterPicksSchema`: 1-3 `z.uuidv4()`), new `__tests__/lib/actions/books-starter-picks.test.ts` (10 tests)
- Approach taken: the visitor searches (debounced 250 ms, stale answers dropped by keying results to their query), clicks a result, and it goes on a small `Shelf` with a bookend (the last spine leans once all three are in); chips under the shelf remove a pick; "Keep your shelf" → `/signup` appears after the first pick. Picks are stored as `ShelfBook` objects so the shelf re-renders on reload without a fetch. `StarterPicksClaim` sits in `AppShell` (both route-group layouts), so it runs wherever a new reader lands after email confirmation or OAuth; it sends only the ids to `addStarterPicks`, which checks auth, the 20/min shelf rate limit, the schema, then keeps only ids that exist in `books`, and upserts `status: read` with `ignoreDuplicates: true` (never changes a book already on the shelf). On success, or on "Invalid book IDs", storage is cleared; on network failure it retries next page load. Toast: "Your 3 books from the homepage are on your shelf."
- Deviations from plan: (1) No `finished_at` is set: a book loved at some unknown time goes on the "No date" shelf, same rule as an import without "Date Read" (Task 7), rather than being filed under this year. (2) Picks are not passed through the signup redirect URL: localStorage already carries them across the email-confirm and OAuth round trips in the same browser, and a URL param would need the callback allowlist changed for no gain. Confirming the email on another device loses the picks (see Out of Scope). (3) The claim runs on any signed-in page, not only first sign-in; a returning reader with leftover picks just gets them added (existing rows untouched). (4) On mobile the starter card now sits between the buttons and the staff shelf, so the first 390px screen shows the starter's shelf, not the staff shelf.
- Issues encountered: Verified with Playwright against `next dev`: at 1440 three picks (Dune, The Hobbit, Beloved) render on the starter shelf with "3 of 3" and "Keep your shelf"; "Keep your shelf" → real `/signup` form with a throwaway `omr-qa-*@mailinator.com` account → confirmed via `auth.admin` → signed in on `/login` in the same browser → landed on `/dashboard`, toast shown, 3 `user_books` rows (`read`, `finished_at` null), storage cleared. Tamper check: a random v4 UUID plus an injection string in storage while signed in → rejected, storage cleared, no rows. 390px: no horizontal scroll. Only console error is the known dev-mode `eval()`/CSP notice. Throwaway account deleted. Lint 0/0, tsc clean, 801 tests pass, build passes. Google OAuth path not verified: OAuth from localhost lands on prod, where this code is not deployed.

**Status:** [x] CODE COMPLETE - Verification blocked (Google OAuth path needs a deployed build; owner approved 2026-09-30)

---

## Task 10: Share image of a year's shelf

**Source:** Design direction doc > §2 "No way to spread", §5 (Satori risk)  
**Priority:** 🟠 High  
**Effort:** High  
**File(s):** new `app/api/og/shelf/route.tsx`; share button on the profile (Task 6 files); existing patterns in `app/api/og/{book,review,stats}/route.tsx`

**Context:** "My 2026 shelf" as an image is how the product spreads. Open question from the direction doc: can Satori (`next/og`) draw sideways spine text? Spike first; if it can't, render spine titles as rotated SVG text or drop titles at share size (the prototype's 9:16 card uses tiny titles anyway).

**Steps:**
1. [x] Read the `ImageResponse` docs in `node_modules/next/dist/docs/`; spike rotated text (CSS `transform: rotate(-90deg)` and SVG `<text transform>`) and pick what renders
2. [x] `/api/og/shelf?user=<username>&year=2026&format=story|square`: 1080×1920 and 1200×1200, with the logo, year, shelf, books, pages
3. [x] Respect profile privacy (no image for hidden profiles)
4. [x] Share button on the profile: copy link, download image
5. [x] Year page URL uses this image as its Open Graph image
6. [x] Goodreads import result (`components/import/goodreads-import.tsx`): add the share link next to "See your profile" (moved here from Task 7 step 3)

**Verify:**
- [x] Images render for 1, 20 and 80 books; screenshot each
- [x] Hidden profile returns 404
- [x] Response is cached (check headers) and renders under the function time limit
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: new `app/api/og/shelf/route.tsx`, `lib/queries/shelf.ts` (new `getYearShelf`), new `components/shelf/share-shelf.tsx`, `components/shelf/profile-shelves.tsx` (`shareAs` prop on `ProfileShelves`/`YearShelves`), `app/(app)/profile/page.tsx`, `app/(public)/users/[username]/page.tsx` (share menu on own profile; `?year=` Open Graph + Twitter image), `app/(app)/import/page.tsx` + `components/import/goodreads-import.tsx` (share menus on the result wall), new `__tests__/app/api/og-shelf.test.ts` (8 tests)
- Approach taken: Spike answer: Satori *does* rotate text (`transform: rotate(90deg)` on an absolutely placed box sized spine-height × spine-width), with two traps, both commented in the route: (1) Satori clips children to the parent *before* the transform, so the spine must not have `overflow: hidden` (otherwise only the middle of each title shows); (2) a flex-centred line that overflows loses its first letters, so the title is centred with `text-align` inside a full-width block that carries the ellipsis. `pack()` picks the largest scale (≤ 2) at which all books fit the area in rows, so 1 book gets a wide spine and hundreds get thin ones; widths/heights/colours/lettering family come from the same `genre-lettering.ts` as the page. Fonts: Literata 600 + Archivo 800/500 via `loadGoogleFont`, subset to the characters on the card. `getYearShelf` uses the public (anon) client only, so an owner's session can never widen a CDN-cached image, and returns null for unknown, disabled or `discovery_visible = false` readers. Response: `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`. Share menu per dated year (not "No date"): Copy link (`/users/<name>?year=2026#shelf-2026`), Square image, Story image (9:16), as same-origin `download` links. The profile page's `generateMetadata` reads `?year=` and swaps the Open Graph/Twitter image to the 1200×630 shelf.
- Deviations from plan: (1) Added a third format, `og` (1200×630, the default), for link previews; `square` (1200×1200) and `story` (1080×1920) are the downloads. (2) There is no separate year page; the "year page URL" is the profile URL with `?year=` (step 5). (3) The Share menu appears only on the reader's own profile and only when they are discoverable (a hidden reader's image 404s). (4) Step 6: instead of one link beside "See your profile", every dated year on the import result wall gets the same Share menu (the wall already renders `YearShelves`); the import page passes the username. (5) The first book leaning and the month labels are not drawn in the image (kept simple).
- Issues encountered: Found and fixed: passing `fonts: []` when every Google Fonts fetch fails switches off next/og's bundled font and the image fails mid-stream; the route now omits `fonts` when none loaded (covered by the test, which runs with fonts mocked to fail). Verified with a seeded throwaway reader (20 books in 2025, 80 in 2026) plus a real 1-book shelf: og/square/story screenshots all correct, titles readable, no clipped first letters. Hidden reader → 404, and 200 again once made visible, unknown user → 404, empty year → 404, bad year/format → 400. Headers: `image/png` and the cache header above. Timing on `next build` + `next start` (3 runs): 80-book story 4.8–5.5 s, 80-book og 2.3–2.4 s, 20-book square 1.1–1.3 s, 1-book og 0.3–0.5 s, all far under the 300 s function limit, and cached for an hour after the first hit. Signed-in Playwright check on `/profile`: one Share button per year ("Share your 2026 shelf", "…2025…"), menu items Copy link / Square image / Story image (9:16), both downloads 200 `image/png`, clipboard got `http://localhost:3000/users/omrqashelf?year=2026#shelf-2026`; `?year=2026` page renders `og:image` = the shelf route, 1200×630, and `twitter:card` summary_large_image. Throwaway account deleted. Lint 0/0, tsc clean, 809 tests pass, build passes.

**Status:** [x] COMPLETE

---

## Task 11: Honest zero states and labels

**Source:** Earlier design review 2026-09-29 (previous version of this plan, Tasks 2, 3, 4, 5)  
**Priority:** 🟠 High  
**Effort:** Medium  
**File(s):** `components/trending/trending-book-card.tsx` (L95–113), `app/(public)/books/[slug]/page.tsx` (L475, L530), `components/books/recommended-books-row.tsx` (L75), `lib/queries/recommendations.ts` (L408)

**Context:** On launch day there is no activity, so these still show emptiness or overclaim: every Trending card reads "+0 reviews · +0 adds" (filler books from `getTrulyTrending`); book pages lead with a large "No reviews yet" block; "Readers also enjoyed" is a genre match; its ★ badges show Open Library ratings with no sample-size check (many ★5.0).

**Steps:**
1. [x] Trending card: show each metric only when > 0; when both are 0, show `reason.label` ("1,411 ratings") instead
2. [x] Book page: replace the empty-review `EmptyState` with one line and a sign-in link; hide "(0)" in the heading
3. [x] Rename "Readers also enjoyed" / "Readers like you also enjoyed" to "More like this"
4. [x] Show the ★ badge only when `ratings_count` ≥ 25 (check the column is in `BOOK_CARD_COLUMNS`)

**Verify:**
- [x] `/trending`: no "+0"; a book with real activity still shows its counts
- [x] `/books/a-game-of-thrones`: one-line empty state, "More like this", no ★5.0 on low-sample books
- [x] `npm run lint` clean

**Completed Notes:**
- Files modified: `components/trending/trending-book-card.tsx`, `app/(public)/books/[slug]/page.tsx` (also dropped the now-unused `EmptyState`/`Star` imports), `components/books/recommended-books-row.tsx`, `lib/queries/recommendations.ts`, `lib/curated-picks.ts` (`STAFF_PICK_REASON`), `app/(public)/page.tsx`, `components/home/home-feed.tsx` (`personalised` prop), new `__tests__/components/books/recommended-books-row.test.tsx`
- Approach taken: (1) Trending card: each metric renders only when > 0 (singular "review"/"add" at 1); when both are 0 the card shows `reason.label` ("1,411 ratings"). (2) Book page: heading is "Reviews" with the count only when > 0; the empty state is one line, "No reviews yet. Sign in to write the first one." (link only when signed out). (3) "Readers also enjoyed" / "Readers like you also enjoyed" → "More like this". (4) The ★ badge on that row needs `ratings_count` ≥ 25 (`MIN_RATINGS_FOR_BADGE`; the column is in `BOOK_CARD_COLUMNS`). Also took the Out of Scope item parked for this task: the homepage panel says "Personalized Recommendations" only when at least one book is not a staff pick, so a signed-in reader without taste signals now sees "Staff picks".
- Deviations from plan: (1) The rated top-up in the curated fallback labelled books with no rating "Staff pick" although they are not hand-picked; now "Popular". (2) On trending filler cards "1,411 ratings" repeats the count already shown beside the star; kept as the plan specified.
- Issues encountered: Verified in the browser (`next dev`, signed out): `/trending` week and month have no activity, so every card shows its ratings label and there is no "+0"; `?period=all` has real activity and shows "+2 reviews", "+1 review", "+2 adds" with no "+0". `/books/a-game-of-thrones`: one-line empty state, "More like this", no ★ on its six similar books, all of which have 1–2 Open Library ratings at 5.00 (checked in the DB). Dune and Nineteen Eighty-four rows likewise showed no badges (their books have 1–16 ratings), so the positive case (≥ 25 shows the badge, 25 exactly included) is covered by the new component test. Signed-in throwaway account with no taste signals: homepage panel reads "Staff picks" (account deleted afterwards). Lint 0/0, tsc clean, 810 tests pass, build passes. Finding: "More like this" favours obscure books with one or two 5-star ratings; the badge threshold hides the misleading ★5.0, but the ranking itself is added to Out of Scope.

**Status:** [x] COMPLETE

---

## Task 12: Final QA

**Source:** Plan > Final verification  
**Priority:** -  
**Effort:** Medium  
**File(s):** `app/globals.css`, `app/(public)/page.tsx` (contrast fixes found here)

**Context:** Check the whole redesign together on a production build before deploying.

**Steps:**
1. [x] Stop `next dev`; `npm run build`; `npm run lint`
2. [x] Playwright screenshots at 1440 and 390, light and dark: `/`, `/books/a-game-of-thrones`, `/trending`, `/users/<dev account>`, `/profile`, `/import` result, `/dashboard`
3. [x] Keyboard pass over a shelf; screen-reader labels spot-checked
4. [x] Lighthouse mobile on `/` and a profile: record performance and accessibility scores
5. [ ] ⚠️ Ask the owner before deploying to production

**Verify:**
- [x] Build passes; lint 0 errors, 0 warnings
- [x] No leftover brown/gold/olive, gradients, sparkles, tagline or stock photo (on the redesigned pages; leftovers elsewhere listed below)
- [x] Accessibility score not lower than before
- [ ] Production checked after the owner-approved deploy

**Completed Notes:**
- Files modified: `app/globals.css` (dark `--primary` and `--ring` 350 71% 61% → 66%, comment updated), `app/(public)/page.tsx` (closing CTA band: the two dimmed lines `text-primary-foreground/80` and `/60` → full `text-primary-foreground`)
- Approach taken: production build (`next start`) with a throwaway account (`auth.admin.createUser`, deleted afterwards along with its rows) and a 90-row Goodreads CSV built from real catalog ISBNs (84 read across 2024–2026 plus 8 undated, 6 to-read). Screenshots of all 7 pages at 1440/390 in light/dark: no horizontal page scroll anywhere (the dashboard carousel bleeds past the edge on purpose; `scrollX` stays 0), no console errors. Import wall: 90 imported, year shelves + "No date" shelf, Share on each year. Keyboard: every spine is a Tab stop with a 2px focus ring, lifts and shows the detail bar; labels read "To Kill a Mockingbird, Harper Lee, 346 pages, finished 10 Mar 2026"; each year is a labelled region ("2026 shelf" … "Undated shelf"). Lighthouse mobile 13.x, 3 runs, median, same database, local build vs production (`1f6d3bf`) as "before": **`/`** perf 63–64 (prod 60), a11y **95** light and dark (prod 95), LCP ~7.3 s, TBT ~450–510 ms, CLS 0.019; **`/users/wrobboz49`** perf 72 (prod 64), a11y **100** light and dark (prod 100), LCP 6.2 s, TBT ~270 ms, CLS 0. Before the fixes the local scores were `/` 91 and profile 96 in dark: ribbon red `#e2556c` was 4.46:1 on `--card` and 4.0–4.2:1 on `primary/10` tints (profile "Reading now" label, small red labels on the homepage panels), and the CTA band's dimmed text was 3.5:1 (light) / 4.4:1 (dark). Lightening the dark primary to 66% gives 5.8:1 on the background, 5.2:1 on cards and 4.6:1 on tints. `--primary-foreground` is the dark background colour, so button text contrast also goes up. lint 0/0, tsc clean, 810 tests pass, build passes after the fixes.
- Deviations from plan: (1) Fixed the three contrast failures above instead of only recording them (a11y would otherwise have dropped below the baseline). (2) Lighthouse ran in dark mode by default on this machine (OS setting); both themes were measured with `--blink-settings=preferredColorScheme=0|1`.
- Issues encountered: (1) **Production does not show Tasks 1–4.** `ohmyreads-next.vercel.app` runs deployment `dpl_EUsSYUqU` (commit `1f6d3bf`, the right one), and its HTML has the new logo and headline. But its stylesheet has the old brown `--primary: 28 75% 31%` and Inter/Merriweather, and the hero photo is still there. The committed `app/globals.css` has ribbon red, and a clean local build produces ribbon red. Likely cause: Vercel restored a stale Turbopack build cache, the same trap memory records for local `.next` and `globals.css`. The next deploy should use **Redeploy without build cache** (or `VERCEL_FORCE_NO_BUILD_CACHE=1`), then check that `--primary` on prod reads `350 81% 36%`. (2) Remaining Lighthouse a11y items (all also on prod or design-inherent): `heading-order` (homepage panel `h3`, was on prod too), `target-size` (spines narrower than 24px on the homepage staff shelf; profile shelves have the List view as the equivalent control, the homepage shelf does not), `label-content-name-mismatch` (weight 0; the spine's accessible name is the full sentence, not the visible surname). (3) Signed-in homepage: "Your Reading Activity" shows "Add your first book" to a reader with 84 finished books, because it only counts a goal or currently-reading books (`components/home/reading-activity-panel.tsx:137-139`). The same logic was there before; the import wall makes it much more visible. (4) Full-page screenshots showed blank shelves and covers below the fold (`content-visibility: auto`, lazy images); viewport screenshots after scrolling show them correctly, so this is a capture artifact. (5) Gradients and amber remain outside the redesigned pages: stats, challenges, badges, map, avatar fallbacks, trending medals and flame, reason badges. Most were already deferred.

**Status:** [ ] PENDING (steps 1–4 done; step 5 and the production check wait on the owner)

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
| Homepage LCP waits on the Literata web font (6.8 s simulated slow 4G; the `<h1>` is the LCP element) | Not worse than before; needs a font-loading decision (subset, `display: optional`, or a system serif for the hero headline) | Next performance pass |
| Homepage picks survive email confirmation on another device (store them in `signUp` `options.data` and claim from user metadata) | Same-browser covers the common case; Google OAuth cannot carry metadata anyway | After launch |
| "More like this" ranks obscure books with one or two 5-star Open Library ratings first (similar-book scoring in `lib/queries/recommendations.ts`) | Ranking change, not a label; Task 11 hid the misleading ★5.0 badges | After launch |
| "N★ curated pick" label on the rated top-up in the curated fallback (not hand-picked) | Rarely shown (24 staff picks cover every current list size) | With the reason badge restyle |
| Homepage "Your Reading Activity" says "Add your first book" to readers with finished books (only goal / currently-reading count) | Found in Task 12; logic predates this plan; needs a count in `getHomeReadingActivity` | Before launch if cheap |
| Spine target size under 24px on the homepage staff shelf (Lighthouse `target-size`) | Design-inherent (spine width = page count); options: min width, or a List toggle on the homepage shelf as on profiles | Next design pass |
| Remaining gradients/amber on stats, challenges, badges, map, avatar fallbacks | Outside the redesigned pages; one hue or status colours | Next design pass |
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
- [ ] Task 9: Google sign-in keeps the homepage picks (deployed preview or prod)
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
| 2026-09-30 | 5 | ✅ Complete | `components/shelf/*`: server-rendered spines, client fitter, list view; 4/88 titles truncated (prototype 23/88); lint, tsc, build pass |
| 2026-09-30 | 6 | ✅ Complete | Both profiles show year shelves, reading-now card with ribbon, Up next face out, empty shelf; privacy gate verified with two throwaway accounts |
| 2026-09-30 | 7 | ✅ Complete | Import result shows the whole wall with totals; undated books on a "No date" shelf; re-import bug (500-UUID URL) fixed; large-wall layout cost cut (shared fitter, content-visibility) |
| 2026-09-30 | 8 | ✅ Complete | Staff shelf hero (24 owner-approved picks), new copy, photo and placeholder covers removed; curated fallback = staff picks; last-row plank regression fixed; LCP 6.97 → 6.84 s |
| 2026-09-30 | 9 | ✅ Code complete | Homepage starter (3 picks on a shelf, "Keep your shelf"), picks claimed after sign-in as read with no date; email path and tamper check verified; Google path blocked until deploy |
| 2026-09-30 | 10 | ✅ Complete | Shelf share image (og/square/story) with rotated spine titles; Share menu per year on own profile and import wall; `?year=` link unfurls as the image; 404 for hidden readers; empty-fonts crash fixed |
| 2026-09-30 | 11 | ✅ Complete | No "+0" on Trending, one-line review empty state, "More like this", ★ badge needs ≥ 25 ratings, "Staff picks" label for readers without taste signals |
| 2026-09-30 | 12 | 🟡 In progress | Build/lint/tests pass; 7 pages screenshotted (1440/390, light/dark); keyboard pass OK; dark primary lightened + CTA text fixed so a11y = baseline (95 / 100); prod found serving pre-Task-1 CSS (stale build cache suspected); deploy waits on owner |
| | | | |
