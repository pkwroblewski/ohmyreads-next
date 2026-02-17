# OhMyReads — UX/UI Design Assessment

**Date:** 2026-02-17
**Scope:** Full codebase review — layouts, page files, components, design system

---

## Executive Summary

OhMyReads has a coherent, warm design system and demonstrates good UI engineering practices: Suspense-driven progressive loading, polished skeletons, accessible form patterns, and a consistent component library. However, there are meaningful friction points in navigation (two separate nav systems for logged-in vs. public), weak information architecture (11 items in the sidebar, 5 in mobile nav with no overlap between them), and missing Suspense/loading coverage on several key pages. The app's strongest UX is on the book detail page and onboarding wizard; its weakest areas are mobile discoverability and the community/social feature surfaces.

---

## Strengths

### 1. Design System Coherence
- `tailwind.config.ts` defines a clean warm palette: `cream`, `brown`, `gold`, `forest`, `tan`, plus semantic CSS variables via HSL (`--background`, `--primary`, etc.).
- Dual font pairing: Inter (sans) + Merriweather (serif) applied consistently — serif for headings, sans for body.
- Custom warm shadows (`shadow-warm`, `shadow-warm-lg`) give book covers tactile depth.
- Dark mode handled cleanly with `darkMode: "class"` and CSS variable overrides.

### 2. Progressive Loading Architecture (Dashboard)
`app/(app)/dashboard/page.tsx` uses 6 independent `<Suspense>` boundaries, each with purpose-built skeletons in `components/dashboard/skeletons.tsx`. Skeletons match the visual shape of the real content (correct aspect ratios, icon placement). This is best-in-class for perceived performance.

### 3. Book Card Component Quality
`components/books/book-card.tsx` handles 4 concerns well:
- Client-side cover validation with `findFirstValidCoverUrl` and AbortController cleanup
- Graceful `BookOpen` icon placeholder when no cover found
- 2/3 aspect ratio enforced via inline style (avoids layout shift)
- `focus-visible:ring-2` focus rings on links

### 4. Onboarding Wizard
`components/onboarding/taste-onboarding-wizard.tsx` is a well-structured 4-step flow with:
- Progress bar with smooth CSS transition
- Optional steps clearly labeled ("Optional")
- Back/skip affordances present
- Completion summary review before save

### 5. Auth UX
`app/(auth)/login/page.tsx` demonstrates good auth UX: password show/hide toggle with `aria-label`, Google OAuth prominently first, "Forgot password" near the password field, disabled state propagation to both buttons during loading.

### 6. Empty States
`components/ui/empty-state.tsx` is a reusable, consistent pattern with icon, title, description, and up to two contextual actions. Used correctly across Bookshelves, Reviews, etc.

### 7. Error Boundaries
Multiple scoped error boundaries: root `app/error.tsx`, dashboard-specific `app/(app)/dashboard/error.tsx`, books-specific `app/(app)/books/error.tsx`. Each provides contextual retry actions and routes to Sentry.

---

## Issues

### Critical

#### C1. Dual Navigation Systems Create Inconsistent Mental Model
**Files:** `components/layout/sidebar.tsx`, `components/layout/app-top-bar.tsx`, `components/layout/navbar.tsx`

The app has **three** distinct navigation surfaces:
1. **Public Navbar** (`navbar.tsx`): 4 links (Browse, Community, Map, About) + auth buttons
2. **App Top Bar** (`app-top-bar.tsx`): Same 4 public links + avatar dropdown with only 4 items (Profile, Bookshelves, Friends, Settings)
3. **Sidebar** (`sidebar.tsx`): 11 items (Dashboard, Bookshelves, Friends, Stats, Challenges, Clubs, Lists, Browse, Profile, Settings, Import)

The **Top Bar avatar dropdown** exposes a different subset than the Sidebar. A user on desktop sees 11 items in sidebar and 4 in the dropdown — the same items exist in both but with no visual connection. This creates confusion about where canonical navigation lives.

**Mobile nav** (`mobile-bottom-nav.tsx`) has 5 items: Home, Shelf, Browse, Community, Profile. Of these, "Community" never appears in the sidebar at all, and "Dashboard" (sidebar item 1) is relabeled "Home" in mobile nav.

#### C2. No Breadcrumb Navigation Inside the App (Authenticated Routes)
**Files:** `app/(app)/*`

The public book detail page (`/books/[slug]`) has JSON-LD breadcrumbs but no visible breadcrumb UI. The authenticated app has no breadcrumbs at all. With 11 sidebar items and nested routes (`/my-shelf?status=reading&shelf=abc`), users can lose orientation. The sidebar has no visual indication of current section hierarchy.

---

### High

#### H1. Sidebar Has 11 Items — Exceeds Cognitive Load Threshold
**File:** `components/layout/sidebar.tsx:32-44`

The sidebar lists: Dashboard, Bookshelves, Friends, Reading Stats, Challenges, Book Clubs, Lists, Browse, Profile, Settings, Import. This is excessive. UX research consistently shows 5-7 primary navigation items is optimal. Items like "Import" and "Stats" are utility/secondary features that could be nested or moved.

The sidebar also mixes primary navigation (Dashboard, Bookshelves) with utility actions (Import) and tertiary features (Challenges, Lists) with no visual grouping or section dividers.

#### H2. Mobile Bottom Nav Omits Many Key Features
**File:** `components/layout/mobile-bottom-nav.tsx`

Mobile users have 5 bottom nav items, but 6 features visible in sidebar are inaccessible without knowing the URL:
- Reading Stats (`/stats`)
- Challenges (`/challenges`)
- Book Clubs (`/clubs`)
- Lists (`/lists`)
- Import (`/import`)
- Settings (`/settings`)

There is no overflow menu ("More") or alternative discovery path for these features on mobile. A user who signs up on mobile may never find Challenges or Book Clubs.

#### H3. Authenticated App Top Bar Is Only 48px Tall
**File:** `app/(app)/layout.tsx:91`, `components/layout/app-top-bar.tsx:96`

The top bar is `h-12` (48px). With a logo, 4 nav links, theme toggle, and avatar, this is extremely compressed. The sidebar starts at `lg:top-12` and the main content is offset `pt-12`. This creates a tight interface that may feel cramped, especially compared to the public navbar which is `h-16` (64px).

#### H4. Book Detail Page: Author Name Is Not a Link
**File:** `app/(public)/books/[slug]/page.tsx:248-250`

```tsx
<span className="text-foreground hover:text-primary transition-colors cursor-pointer">
  {book.author}
</span>
```

The author name has `hover:text-primary cursor-pointer` styling — implying it's interactive — but it's a plain `<span>`, not a link. The app has `/authors/[slug]` pages (`app/(public)/authors/[slug]/page.tsx`), so this is a clear missing link that will frustrate users trying to explore by author.

#### H5. Community Page: Mobile Sidebars Appended Below Feed
**File:** `app/(public)/community/page.tsx:107-114`

On mobile, the "My Shelf Panel" and "Community Sidebar" are rendered below the main feed using `div.lg:hidden mt-8 space-y-6`. This means users must scroll past an entire activity feed to reach discovery content. Twitter/Instagram solved this with a tab or drawer pattern; appending below a long feed is a known mobile UX anti-pattern.

#### H6. Friends Page Uses Full-Page Reload for Tab Navigation
**File:** `app/(app)/friends/page.tsx:77-79`

```tsx
<a href={`/friends?tab=${t.id}`} ...>
```

Tab navigation uses `<a>` (full page reload) instead of Next.js `<Link>` with shallow routing or client-side state. This causes a full server round-trip and visible page flash when switching between Friends/Requests/Sent tabs.

#### H7. Review Card: Custom Dropdown Menu Without Radix
**File:** `components/reviews/review-card.tsx:184-223`

The owner edit/delete menu uses a hand-rolled dropdown (`div` with absolute positioning, manual state management). It:
- Has no focus trap
- Has no click-outside handler for keyboard users
- Has no `aria-expanded` on the trigger button
- Dismisses only on item click, not Escape key

The app already uses Radix UI (from project dependencies); this should use `DropdownMenu` from Radix.

---

### Medium

#### M1. Onboarding: Pace Step Uses Emoji — Fails Dark Mode and Some Accessibility Contexts
**File:** `components/onboarding/taste-onboarding-wizard.tsx:349-357`

```tsx
{option === "slow" && "🐢"}
{option === "medium" && "🚶"}
{option === "fast" && "🚀"}
```

Emojis are rendered without `aria-label` or `role="img"`, making them invisible to screen readers. The `🚶` emoji also lacks directional clarity (Walking is not universally associated with "medium pace"). Consider replacing with Lucide icons and adding descriptive `aria-label`.

#### M2. Dashboard Loading Sequence Creates Visual "Popcorn Effect"
**File:** `app/(app)/dashboard/page.tsx`

6 independent Suspense boundaries all resolve at different times. The visible layout shift (sections "popping" in one by one) can feel disjointed. On slow connections, users see skeletons for Stats, then Currently Reading, then Places, then Friends Activity, then Recommendations, then Recent Activity — all in sequence. Consider grouping related sections under fewer Suspense boundaries, or staggering reveals with CSS animation.

#### M3. `QuickActionsForNewUsers` Makes a Duplicate Auth Call
**File:** `app/(app)/dashboard/page.tsx:152-158`

The inline `QuickActionsForNewUsers` server component calls `supabase.auth.getUser()` independently after the parent `DashboardPage` already called it. This is a redundant server request that could be eliminated by passing `user` as a prop.

#### M4. Book Cover Validation Happens Client-Side, Blocking Paint
**File:** `components/books/book-card.tsx:101-121`

Every BookCard fetches and validates cover URLs via `findFirstValidCoverUrl` on mount. With a grid of 20 books (`/books` page loads 20 by default), this means up to 20 concurrent fetch chains. The `isValidating` state shows an `animate-pulse` skeleton for every card. For users on slow connections, the entire grid shows pulsing placeholders for several seconds. Consider server-side cover URL resolution, or at minimum batching the validation.

#### M5. "Import from Goodreads" in Hero — Sends Unauthenticated Users to `/import`
**File:** `components/home/home-hero.tsx:87-95`

The hero has a prominent "Import from Goodreads" CTA visible to logged-out users. `/import` is an authenticated route that redirects to `/login`. Users clicking this CTA get bounced to login without explanation of why they can't access the feature. The button should either redirect with `?redirect=/import` pre-filled or show a tooltip explaining login is required.

#### M6. Stats Page Has Inconsistent Container Class
**File:** `app/(app)/stats/page.tsx:35, 41, 45, 50`

```tsx
<div className="min-h-screen">
  <div className="container max-w-6xl py-8">
  <div className="container max-w-6xl pb-8">
  <div className="container max-w-6xl pb-12">
```

Uses `.container` class (Tailwind's built-in container) while the rest of the authenticated app uses `max-w-6xl mx-auto` without `.container`. The `container` class applies responsive max-widths that may conflict with the sidebar layout (content area is already constrained by `lg:pl-64`).

#### M7. `<h1>` Used Multiple Times Per Page in Onboarding Steps
**File:** `components/onboarding/taste-onboarding-wizard.tsx:152, 213, 327, 407`

Each step renders `<h1>` for its heading. Since all steps are rendered via conditional visibility in a single React tree (not separate pages), there are potentially multiple `<h1>` elements in the DOM at once. Should use `<h2>` or manage heading level relative to page context.

#### M8. Spoiler Warning UX — "Show Review" Has No Visual Context
**File:** `components/reviews/review-card.tsx:105-122`

When a review contains spoilers, the card shows an amber warning and a "Show Review" button. The button has no confirmation dialog — one click immediately reveals spoilers with no "Are you sure?" step. Given the emotional impact of spoilers, a two-step reveal (click once to confirm intent, click again to reveal) is standard on comparable platforms (Goodreads, Letterboxd).

#### M9. Chat Panel: No Accessible Focus Management When Opening
**File:** `components/messages/chat-window.tsx`

The chat window renders in an overlay panel. There's no evidence of `autoFocus` on the input or focus return to trigger when the panel closes. ARIA `dialog` role and focus trap are missing.

---

### Low

#### L1. "Back to Homepage" Link Text Is Inconsistent
**File:** `app/(auth)/layout.tsx:33-36`

```tsx
<span className="hidden sm:inline">Back to homepage</span>
<span className="sm:hidden">Home</span>
```

"Back to homepage" implies you can only go back (from somewhere you were), but for new users arriving directly at `/signup`, they were never on the homepage. "Go to homepage" is more neutral.

#### L2. Sidebar Logo Links to Homepage (`/`) But App Top Bar Logo Links to Dashboard (`/dashboard`)
**Files:** `components/layout/sidebar.tsx:69`, `components/layout/app-top-bar.tsx:99`

This inconsistency means clicking the OhMyReads logo in the sidebar takes you to the public landing page, while clicking it in the top bar takes you to the dashboard. Both are in the authenticated layout. Logos should consistently link to the user's primary "home" — the dashboard.

#### L3. Feature Cards on Homepage Use `text-xs` for Descriptions on 2-Column Mobile Grid
**File:** `app/(public)/page.tsx:171, 198-200`

On mobile, the features grid is 2 columns. Each card has `text-xs` (10px rendered) description text inside a small card. This is below the WCAG-recommended minimum readable size (14px is generally considered minimum for body text).

#### L4. Auth Error Messages Shown in Both Toast and Inline Banner
**File:** `app/(auth)/login/page.tsx:95-97`

```tsx
setError(signInError.message);
toast.error(signInError.message || "Failed to sign in");
```

Errors display in both an inline red banner AND a Sonner toast simultaneously. This is redundant and visually noisy. Pick one: inline banners for form errors (better UX — they stay visible and don't auto-dismiss), toasts for transient success/action confirmations.

#### L5. Onboarding Does Not Guard Against Navigating Away Mid-Flow
**File:** `components/onboarding/taste-onboarding-wizard.tsx`

There's no `beforeunload` warning or router-level guard if the user navigates away at Step 2 or 3. Their genre selections are lost. Consider using Next.js App Router's upcoming navigation events or a simple prompt to warn about unsaved state.

#### L6. "Bookshelves" Label Inconsistency
**Files:** `components/layout/sidebar.tsx:33`, `components/layout/app-top-bar.tsx:31`, `app/(app)/my-shelf/page.tsx:119`

The sidebar calls it "Bookshelves", the top bar dropdown calls it "Bookshelves", but the page URL is `/my-shelf` and the page heading is "Bookshelves". This is acceptable but the URL slug "my-shelf" (singular) while the label is "Bookshelves" (plural) is a minor inconsistency.

---

## Recommendations (Prioritized)

### P1. Consolidate Navigation Architecture
Reduce the sidebar to 7 items max, grouped into sections (e.g., "Reading" / "Discover" / "Social"). Add a "More" or overflow pattern for secondary items on mobile. Ensure the App Top Bar dropdown and Sidebar surface the same items so users aren't confused about which is canonical.

### P2. Fix Author Link on Book Detail Page
Change `<span>` to `<Link href={/authors/${authorSlug}}>` on `app/(public)/books/[slug]/page.tsx:248`. This is a 2-line fix with significant discoverability impact.

### P3. Replace Hand-Rolled Review Dropdown with Radix DropdownMenu
`components/reviews/review-card.tsx:185-224` — use `@radix-ui/react-dropdown-menu` which is already available. Adds keyboard nav, focus trap, and Escape dismissal automatically.

### P4. Use `<Link>` for Friends Tab Navigation
Replace `<a href>` with Next.js `<Link>` in `app/(app)/friends/page.tsx:77` to avoid full page reloads on tab switch.

### P5. Add `aria-label` to Onboarding Emojis
Wrap emojis in `<span role="img" aria-label="slow pace">` in `taste-onboarding-wizard.tsx:349-357`.

### P6. Fix Import CTA for Unauthenticated Users
Change `href="/import"` in `home-hero.tsx:87` to `href="/login?redirect=/import"` or show a tooltip.

### P7. Deduplicate Auth Error Display
Remove one of the two error channels in `login/page.tsx:95-97` — keep only the inline banner for form errors.

### P8. Add Navigation Guards for Onboarding
Warn users before navigating away from the onboarding wizard mid-flow.

---

## Quick Wins

These can each be fixed in under 30 minutes:

| # | Fix | File | Impact |
|---|-----|------|--------|
| 1 | Make author name a `<Link>` to `/authors/[slug]` | `app/(public)/books/[slug]/page.tsx:248` | High discoverability |
| 2 | Change friends tab `<a>` to `<Link>` | `app/(app)/friends/page.tsx:77` | Eliminates full-page reload |
| 3 | Make sidebar logo link to `/dashboard` (not `/`) | `components/layout/sidebar.tsx:69` | Fixes confusing behavior |
| 4 | Remove toast duplicate of form error message | `app/(auth)/login/page.tsx:95-97` | Cleaner error UX |
| 5 | Add `aria-label` to emoji spans in onboarding | `components/onboarding/taste-onboarding-wizard.tsx:349-357` | Screen reader fix |
| 6 | Fix "Import from Goodreads" CTA redirect for guests | `components/home/home-hero.tsx:87` | Avoids confusing redirect |
| 7 | Replace `<h1>` with `<h2>` in onboarding step content | `components/onboarding/taste-onboarding-wizard.tsx:152, 213, 327, 407` | Fixes heading hierarchy |
| 8 | Add two-step confirm on spoiler reveal | `components/reviews/review-card.tsx:105-122` | Prevents accidental spoilers |
