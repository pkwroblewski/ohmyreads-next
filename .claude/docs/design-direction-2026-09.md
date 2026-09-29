# Design Direction: "Your Reading Life as a Shelf"

Written 2026-09-29 from a strategic design review of production (ohmyreads-next.vercel.app). Status: **Approved by the owner on 2026-09-29** after the prototype (https://claude.ai/artifact/LyDCBVZABxZVXtWNjje6jA, private). Build plan: `.claude/plans/design-prelaunch-2026-09.md`. Reader feedback is optional and not a gate.

**Decision 2026-09-29:** keep the name OhMyReads; drop the tagline "Independent Minds, Shared Stories".

---

## 1. The problem this solves

The current design is clean, readable and accessible, but it is **generic and depends on a community that won't exist on launch day**.

- **Generic:** shadcn cards, Lucide icons, Inter + Merriweather, brown button, gold stars, a stock "cozy woman with book and coffee" hero photo, and a stock Lucide book icon as the logo. By 2030, AI tools will produce this look for free.
- **Cold start:** on launch day every real visitor sees zero reviews, zero trending, zero community. Community-first surfaces (Trending "+0" counters, Community Feed, "Reviews (0)" blocks) will show emptiness.
- **Brand contradictions:** "real reader recommendations, not algorithms" alongside a most-rated bestseller list labelled "Curated for You", a genre match labelled "Readers also enjoyed", and sparkle (AI) icons in 27 files.
- **Weak cover data:** 352 books have no cover, 313 kept NYT covers, Google placeholder images can't be detected client-side. Cover-first designs expose this.
- **Tone mismatch:** "OhMyReads" is playful; "Independent Minds, Shared Stories" in italic serif is solemn.
- **Light and dark look like two brands:** brown/gold vs olive/copper/teal-sage.

**Constraint for any new design:** it must look good with one reader and zero others.

---

## 2. The idea

Make **the book spine on a shelf** the organising visual idea of the whole product, not a feature in a tab.

Every book you finish is placed spine-out on your shelf:
- **Width** = page count
- **Colour** = taken from the cover
- **Lettering** = chosen by genre

A year of reading becomes a recognisable shelf; ten years becomes a wall. Readers already photograph and post their physical shelves; this uses that habit.

### Why this idea

| Failure risk (5 years) | How the shelf answers it |
|---|---|
| Cold start: a community site looks dead without a community | A shelf is built from one person's reading, so it is full and personal on day one |
| Looks like every other tracker | A spine shelf is recognisable in a screenshot without a logo, and is built from the user's own data |
| No way to spread | "My 2026 shelf" is an image people want to post; share-image routes already exist (`app/api/og/book`, `review`, `stats`) |
| No habit to return | Finishing a book = placing it on the shelf; a satisfying moment beats a streak counter |
| Weak cover data | Spines are generated from title/author/genre, so missing or bad covers stop showing |
| "Independent" is no longer a differentiator | The shelf is yours and exportable; a printed poster of your reading life is ad-free revenue that fits the promise |

---

## 3. Page by page

- **Homepage (signed out):** a real shelf instead of the stock photo. Hero asks for three books you loved and builds your shelf before sign-up. Button: **"Keep your shelf"**, not "Get Started Free".
- **Goodreads import:** the "aha" moment. Upload a CSV → ten years of reading appear as a wall of spines. Most design effort goes here; it's the screenshot people share.
- **Profile:** one shelf row per year; a wall view for everything.
- **Stats:** the shelf is the chart (sorted by month, coloured by genre, thickness = pages). Regular charts as a second view.
- **Empty states:** an empty shelf with two bookends, "Room for your first book." Handles every zero state.
- **Book page:** spine next to the cover; "On 12 shelves" instead of "Reviews (0)".

---

## 4. Visual rules

1. **Covers face out for books you're considering; spines for books you've read.** Browse, search, want-to-read = covers. Your shelf = spines. (Bookstores display face-out to sell.)
2. **The books provide the colour.** UI is paper and ink. Remove brand brown/gold, gradient text, glass effects. Dark mode = the same room with the lights down, not a separate palette.
3. **One accent: bookmark-ribbon red.** Marks the current book (a ribbon hanging from its spine), the progress bar and primary buttons.
4. **Fonts chosen by job:**
   - Display/reading serif: **Literata** (designed for e-reading; not trend-driven)
   - Spine titles: a variable sans with a width axis, e.g. **Archivo**, so long titles narrow to fit
   - Plain sans for UI
   - Replaces Inter + Merriweather
5. **Shelves instead of cards.** Books sit on a thin shelf line; structure from shelves and type, not bordered boxes.
6. **Logo:** three spines of different heights, the last one leaning.
7. **One signature animation:** a finished book slides onto the shelf and neighbours settle; hovering a spine tips it out to show the cover. Reduced motion: it just appears.
8. **Remove:** stock photo, gradient text, glass, sparkle icons. AI should feel like a quiet librarian.
9. **Specific copy:** "Every book you've read, on one shelf" instead of "Track Your Reading Life".

**Tone decision (confirmed 2026-09-29):** keep the name, drop the tagline; warm and slightly playful suits the shelf.

---

## 5. Risks and cheap validation

- **Generated spines can look fake and cheap** (biggest risk). Needs real rules: lettering by genre, colour from cover, height variation, subtle texture. **Test: one-day prototype rendering a real shelf. If you don't want to screenshot it, drop the idea.**
- **Sideways text is hard to read:** hover/focus shows the title horizontally, screen-reader labels, a list view always available.
- **Share images:** test whether Satori (`next/og`) can draw rotated spine text before relying on it.
- **Shelf views exist in some apps:** the difference is using the shelf site-wide, plus the import moment and sharing.
- **Real reactions:** show the prototype to 5–10 real readers and ask "Would you post this?"

---

## 6. Scope before launch

Don't redesign everything before launch. Apply the direction to the three surfaces that decide first impressions:
1. Homepage hero and the Goodreads import result
2. Profile shelf and its share image
3. New colours, fonts and logo applied site-wide (inner pages restyled, not rebuilt)

Everything else moves over after launch. The earlier `.claude/plans/design-prelaunch-2026-09.md` will be reworked once the prototype decides the direction (its Task 1, deleting test reviews, is just pre-launch cleanup).
