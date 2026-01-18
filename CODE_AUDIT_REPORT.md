# OhMyReads Code Audit Report

**Audit Date:** 2026-01-03
**Auditor:** GPT 5.2 Codex High
**Project Version:** 0.1.0 (from package.json)
**Next.js Version:** 16.0.10
**React Version:** 19.2.3

## Executive Summary
The codebase is well-structured for a feature-rich Next.js app: route groups are organized, server actions are used consistently, and there is evidence of thoughtful security (RLS enabled broadly, safe JSON-LD serialization, rate limiting via KV). However, several security and data-integrity gaps need attention before production. The most urgent issues are in RLS policy design (book submissions can be self-approved due to a missing WITH CHECK), open write access to the `books` table for any authenticated user, and a webhook endpoint that fails open if no secret is configured while also using the wrong client for admin APIs.

Performance and data-layer risks are also present. Some operations re-scan entire tables per action (book rating recalculation, Goodreads imports) and in-memory caches are used in serverless endpoints without eviction or persistence. There are also mismatches between database RLS policies and code (places cache marked server-only but read with a public client), which will cause missing data at runtime.

Finally, there are several quality and UX issues that should be addressed: caching invalidation uses bracketed dynamic routes, canonical metadata is missing for dynamic pages, admin views ship with empty `alt` text, and badge icon strings appear corrupted. These are not blockers but will degrade SEO, accessibility, and overall polish.

## Severity Ratings
- CRITICAL - Must fix before production
- HIGH - Should fix soon
- MEDIUM - Improve when possible
- LOW - Nice to have improvements

## Findings by Category

### 1. Code Quality & Maintainability

#### Issues Found
- ?? Duplicate slug generation logic is copied across multiple actions — `lib/actions/books.ts:22` (also `lib/actions/admin-books.ts:30`, `lib/actions/admin-import.ts`, `lib/actions/book-submissions.ts`).

#### Coding Instructions
---
**Issue:** Duplicate slug generation logic is copied across multiple actions.
**Severity:** ?? Low
**Location:** `lib/actions/books.ts:22`

**Current Code:**
```typescript
// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}
```

**Recommended Code:**
```typescript
// lib/utils/slug.ts
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// lib/actions/books.ts
import { generateSlug } from "@/lib/utils/slug";

// ...
const baseSlug = generateSlug(externalBook.title);
```

**Reasoning:** Centralizing slug logic avoids drift between admin and user flows and makes future changes consistent across the codebase.

---

### 2. TypeScript & Type Safety

#### Issues Found
- ?? `addToShelf` accepts `status: string`, bypassing the `ShelfStatus` union — `lib/actions/books.ts:60`.
- ?? Unsafe `as unknown as` casting hides type mismatches — `lib/queries/books.ts:125`.

#### Coding Instructions
---
**Issue:** `addToShelf` accepts `status: string` and relies on runtime arrays instead of the `ShelfStatus` union.
**Severity:** ?? Medium
**Location:** `lib/actions/books.ts:60`

**Current Code:**
```typescript
export async function addToShelf(bookId: string, status: string) {
  // Validate status
  const validStatuses = ["want_to_read", "reading", "read"];
  if (!validStatuses.includes(status)) {
    return { error: "Invalid status" };
  }
```

**Recommended Code:**
```typescript
const validStatuses: ShelfStatus[] = ["want_to_read", "reading", "read"];

export async function addToShelf(bookId: string, status: ShelfStatus) {
  if (!validStatuses.includes(status)) {
    return { error: "Invalid status" };
  }
```

**Reasoning:** Using the union type prevents invalid values at compile time and reduces runtime branching.

---
**Issue:** `as unknown as` casting masks type mismatches in review aggregation.
**Severity:** ?? Medium
**Location:** `lib/queries/books.ts:125`

**Current Code:**
```typescript
const reviewsWithProfiles = reviews.map((review) => ({
  ...review,
  profile: profileMap.get(review.user_id) || null,
}));

return reviewsWithProfiles as unknown as ReviewWithUser[];
```

**Recommended Code:**
```typescript
const reviewsWithProfiles: ReviewWithUser[] = (reviews ?? []).map((review) => ({
  ...review,
  profile: profileMap.get(review.user_id) ?? null,
}));

return reviewsWithProfiles;
```

**Reasoning:** Explicit typing keeps TypeScript honest and avoids accidental shape drift when schemas or selects change.

---

### 3. Security Audit

#### Issues Found
- ?? RLS update policy for `book_submissions` lacks `WITH CHECK`, allowing users to approve their own submissions — `supabase/migrations/002_book_submissions_structured_reviews.sql:59`.
- ?? `books` table allows any authenticated user to insert records, bypassing moderation — `supabase/migrations/001_initial_schema.sql:63`.
- ?? Webhook verification fails open without a secret and uses anon client for admin API — `app/api/webhooks/supabase/route.ts:6`, `app/api/webhooks/supabase/route.ts:47`.

#### Coding Instructions
---
**Issue:** Users can update pending submissions without a `WITH CHECK`, which lets them change `status` to approved.
**Severity:** ?? Critical
**Location:** `supabase/migrations/002_book_submissions_structured_reviews.sql:59`

**Current Code:**
```sql
CREATE POLICY "Users can update their pending submissions"
  ON public.book_submissions FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending');
```

**Recommended Code:**
```sql
DROP POLICY IF EXISTS "Users can update their pending submissions" ON public.book_submissions;

CREATE POLICY "Users can update their pending submissions"
  ON public.book_submissions
  FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending')
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');
```

**Reasoning:** `WITH CHECK` enforces the new row state, preventing users from changing `status` to `approved` or writing moderator fields.

---
**Issue:** Any authenticated user can insert directly into `books`, bypassing moderation.
**Severity:** ?? High
**Location:** `supabase/migrations/001_initial_schema.sql:63`

**Current Code:**
```sql
CREATE POLICY "Authenticated users can insert books" ON public.books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

**Recommended Code:**
```sql
DROP POLICY IF EXISTS "Authenticated users can insert books" ON public.books;

CREATE POLICY "Admins can insert books"
  ON public.books
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
```

**Reasoning:** This aligns the database with the moderation flow and prevents unreviewed content from entering the catalog.

---
**Issue:** Webhook secret verification fails open and the admin API is called using the anon client.
**Severity:** ?? High
**Location:** `app/api/webhooks/supabase/route.ts:6`

**Current Code:**
```typescript
if (!expectedSecret) {
  console.warn("SUPABASE_WEBHOOK_SECRET not configured");
  return true;
}

// ...
const supabase = await createClient();
const { data: userData } = await supabase.auth.admin.getUserById(userId);
```

**Recommended Code:**
```typescript
import { createAdminClient } from "@/lib/supabase/admin";

if (!expectedSecret && process.env.NODE_ENV === "production") {
  return false;
}

// ...
const supabase = createAdminClient();
const { data: userData } = await supabase.auth.admin.getUserById(userId);
```

**Reasoning:** Webhooks should fail closed in production, and admin endpoints require a service-role client to succeed and avoid unauthorized access.

---

### 4. Performance Analysis

#### Issues Found
- ?? Book rating recalculation scans all reviews every time — `lib/actions/reviews.ts:451`.
- ?? Goodreads import loads the entire books table into memory — `lib/actions/import.ts:102`.
- ?? In-memory caches in serverless AI routes are unbounded and non-persistent — `app/api/ai/curated-picks/route.ts:8`, `app/api/ai/trending-insights/route.ts:7`.

#### Coding Instructions
---
**Issue:** `updateBookRating` fetches all reviews for every update, causing O(n) scans.
**Severity:** ?? Medium
**Location:** `lib/actions/reviews.ts:451`

**Current Code:**
```typescript
const { data: reviews } = await supabase
  .from("reviews")
  .select("rating")
  .eq("book_id", bookId);

const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
const average = Math.round((sum / reviews.length) * 10) / 10;

await supabase
  .from("books")
  .update({
    average_rating: average,
    ratings_count: reviews.length,
  })
  .eq("id", bookId);
```

**Recommended Code:**
```typescript
const { error } = await supabase.rpc("recalculate_book_rating", {
  book_id: bookId,
});
if (error) {
  console.error("Error recalculating rating:", error);
}
```

```sql
CREATE OR REPLACE FUNCTION recalculate_book_rating(book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.books
  SET
    average_rating = sub.avg_rating,
    ratings_count = sub.review_count
  FROM (
    SELECT
      ROUND(AVG(rating)::numeric, 1) AS avg_rating,
      COUNT(*) AS review_count
    FROM public.reviews
    WHERE book_id = recalculate_book_rating.book_id
  ) sub
  WHERE id = recalculate_book_rating.book_id;
END;
$$;
```

**Reasoning:** Aggregating in SQL eliminates repeated full-table scans and keeps latency stable as reviews grow.

---
**Issue:** Goodreads import fetches all books, which scales poorly.
**Severity:** ?? Medium
**Location:** `lib/actions/import.ts:102`

**Current Code:**
```typescript
const { data: allBooks, error: booksError } = await supabase
  .from("books")
  .select("id, title, author, isbn");
```

**Recommended Code:**
```typescript
const isbnList = rows
  .flatMap((r) => [r.isbn, r.isbn13])
  .filter((v): v is string => !!v);

const { data: booksByIsbn } = await supabase
  .from("books")
  .select("id, title, author, isbn, isbn13")
  .in("isbn", isbnList);
```

**Reasoning:** Querying only relevant identifiers reduces memory usage and improves import time on large catalogs.

---
**Issue:** In-memory caches in AI routes are unbounded and non-persistent in serverless.
**Severity:** ?? Medium
**Location:** `app/api/ai/curated-picks/route.ts:8`

**Current Code:**
```typescript
const curatedCache = new Map<string, { data: CuratedPick[]; timestamp: number }>();
```

**Recommended Code:**
```typescript
import { kv } from "@vercel/kv";

const cacheKey = user ? `curated:${user.id}` : "curated:anonymous";
const cached = await kv.get<CuratedPick[]>(cacheKey);
if (cached) {
  return NextResponse.json({ picks: cached, cached: true });
}

// ... after generating picks
await kv.set(cacheKey, picks, { ex: 60 * 60 });
```

**Reasoning:** KV-backed caching avoids memory leaks and works consistently across serverless instances.

---

### 5. Database & Data Layer

#### Issues Found
- ?? `places_cache` is marked server-only in RLS but is queried with a public client — `lib/queries/geo.ts:135`, `supabase/migrations/007_user_locations_and_places.sql:157`.
- ?? Book approval creates a book and updates the submission in separate calls (no transaction) — `lib/actions/book-submissions.ts:492`, `lib/actions/book-submissions.ts:519`.

#### Coding Instructions
---
**Issue:** `places_cache` is server-only per RLS, but the code uses `createPublicClient`.
**Severity:** ?? Medium
**Location:** `lib/queries/geo.ts:135`

**Current Code:**
```typescript
const supabase = createPublicClient();

const { data, error } = await supabase
  .from("places_cache")
  .select("data, expires_at")
  .eq("geohash_prefix", geohashPrefix)
  .eq("place_type", placeType)
  .single();
```

**Recommended Code:**
```typescript
import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createAdminClient();

const { data, error } = await supabase
  .from("places_cache")
  .select("data, expires_at")
  .eq("geohash_prefix", geohashPrefix)
  .eq("place_type", placeType)
  .single();
```

**Reasoning:** RLS explicitly blocks public access to `places_cache`, so reads must use a service-role client or a `SECURITY DEFINER` RPC that is called from a server-only route.

---
**Issue:** Book approval is non-atomic (book insert and submission update can diverge).
**Severity:** ?? Medium
**Location:** `lib/actions/book-submissions.ts:492`

**Current Code:**
```typescript
const { data: book } = await supabase
  .from("books")
  .insert({ ... })
  .select()
  .single();

const { error: updateError } = await supabase
  .from("book_submissions")
  .update({
    status: "approved",
    moderated_by: user.id,
    moderated_at: new Date().toISOString(),
    book_id: book.id,
  })
  .eq("id", submissionId);
```

**Recommended Code:**
```typescript
const { data: bookId, error } = await supabase.rpc(
  "approve_book_submission",
  {
    submission_id: submissionId,
    moderator_id: user.id,
  }
);

if (error) {
  return { error: "Failed to approve submission" };
}
```

```sql
CREATE OR REPLACE FUNCTION approve_book_submission(
  submission_id uuid,
  moderator_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_book_id uuid;
BEGIN
  INSERT INTO public.books (...)
  SELECT ... FROM public.book_submissions
  WHERE id = submission_id AND status = 'pending'
  RETURNING id INTO new_book_id;

  UPDATE public.book_submissions
  SET status = 'approved',
      moderated_by = moderator_id,
      moderated_at = now(),
      book_id = new_book_id
  WHERE id = submission_id;

  RETURN new_book_id;
END;
$$;
```

**Reasoning:** Atomic approval prevents orphaned books if the submission update fails.

---

### 6. SEO & Metadata

#### Issues Found
- ?? Dynamic profile pages lack canonical URLs, allowing duplicate indexing with query params — `app/(public)/users/[username]/page.tsx:50`.
- ?? Auth pages are in the sitemap while robots disallows `/auth/` (which is not the actual route), risking unwanted indexing — `app/robots.ts:11`, `app/sitemap.ts:65`.

#### Coding Instructions
---
**Issue:** Missing canonical URLs for dynamic profile pages.
**Severity:** ?? Low
**Location:** `app/(public)/users/[username]/page.tsx:50`

**Current Code:**
```typescript
return {
  title: `${name} (@${profile.username})`,
  description: profile.bio || `See what ${name} is reading on OhMyReads`,
  openGraph: {
    title: `${name} on OhMyReads`,
    description: profile.bio || `Check out ${name}'s reading list`,
    images: profile.avatar_url ? [profile.avatar_url] : [],
  },
};
```

**Recommended Code:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

return {
  title: `${name} (@${profile.username})`,
  description: profile.bio || `See what ${name} is reading on OhMyReads`,
  alternates: {
    canonical: `${baseUrl}/users/${profile.username}`,
  },
  openGraph: {
    title: `${name} on OhMyReads`,
    description: profile.bio || `Check out ${name}'s reading list`,
    images: profile.avatar_url ? [profile.avatar_url] : [],
  },
};
```

**Reasoning:** Canonicals prevent duplicate indexing for `?tab=` variations and strengthen SEO signals.

---
**Issue:** Auth pages are listed in the sitemap but not excluded by robots (the `/auth/` disallow does not match actual routes).
**Severity:** ?? Low
**Location:** `app/robots.ts:11`

**Current Code:**
```typescript
disallow: [
  "/dashboard",
  "/my-shelf",
  "/profile",
  "/profile/edit",
  "/settings",
  "/api/",
  "/auth/",
],
```

**Recommended Code:**
```typescript
disallow: [
  "/dashboard",
  "/my-shelf",
  "/profile",
  "/profile/edit",
  "/settings",
  "/api/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
],
```

**Reasoning:** This aligns robots rules with actual auth routes and prevents indexing of login/signup pages that are also present in `app/sitemap.ts:65`.

---

### 7. Accessibility (a11y)

#### Issues Found
- ?? Book cover images in admin views have empty `alt` text — `app/(app)/admin/reviews/page.tsx:309` (also `app/(app)/admin/analytics/page.tsx:223`, `app/(app)/admin/books/page.tsx:237`).

#### Coding Instructions
---
**Issue:** Admin book cover images use empty `alt` text, reducing screen-reader context.
**Severity:** ?? Low
**Location:** `app/(app)/admin/reviews/page.tsx:309`

**Current Code:**
```tsx
<img
  src={review.book.cover_url}
  alt=""
  className="w-12 h-18 rounded object-cover bg-muted"
/>
```

**Recommended Code:**
```tsx
<img
  src={review.book.cover_url}
  alt={`Cover of ${review.book.title}`}
  className="w-12 h-18 rounded object-cover bg-muted"
/>
```

**Reasoning:** Meaningful alt text improves admin accessibility without changing layout.

---

### 8. Error Handling & User Feedback

#### Issues Found
- ?? UI allows star-only reviews but the schema enforces a 50-character minimum, causing unexpected errors — `components/reviews/review-form.tsx:54`, `lib/validation/review.ts:36`.

#### Coding Instructions
---
**Issue:** The UI allows rating-only reviews, but the validation requires 50+ characters.
**Severity:** ?? Medium
**Location:** `lib/validation/review.ts:36`

**Current Code:**
```typescript
.refine(
  (data) => {
    const totalLength =
      (data.summary?.length || 0) +
      (data.liked?.length || 0) +
      (data.disliked?.length || 0) +
      (data.takeaway?.length || 0);
    return totalLength >= 50;
  },
  { message: "Review must be at least 50 characters total across all fields" }
);
```

**Recommended Code:**
```typescript
.refine(
  (data) => {
    const totalLength =
      (data.summary?.length || 0) +
      (data.liked?.length || 0) +
      (data.disliked?.length || 0) +
      (data.takeaway?.length || 0);

    return totalLength === 0 || totalLength >= 50;
  },
  { message: "Add 50+ characters or submit a rating-only review" }
);
```

**Reasoning:** Aligns server validation with the UI’s “rating-only” flow and avoids confusing errors on submit.

---

### 9. UI/UX Consistency

#### Issues Found
- ?? Badge icons appear as garbled strings, likely due to encoding — `lib/data/badges.ts:64`.

#### Coding Instructions
---
**Issue:** Badge icons render as garbled strings (mojibake) instead of emoji.
**Severity:** ?? Low
**Location:** `lib/data/badges.ts:64`

**Current Code:**
```typescript
export const CATEGORY_INFO: Record<BadgeCategory, { label: string; icon: string }> = {
  reading: { label: "Reading", icon: "dY"s" },
  pages: { label: "Pages", icon: "dY"-" },
  // ...
};
```

**Recommended Code:**
```typescript
export const CATEGORY_INFO: Record<BadgeCategory, { label: string; icon: string }> = {
  reading: { label: "Reading", icon: "\uD83D\uDCD6" },
  pages: { label: "Pages", icon: "\uD83D\uDCC4" },
  // ...
};
```

**Reasoning:** Replace corrupted icon strings with known-good Unicode escapes (or verified UTF-8 emoji) to keep badge visuals consistent across the UI.

---

### 10. Next.js 16 Best Practices

#### Issues Found
- ?? `revalidatePath` uses bracketed dynamic routes, which does not invalidate the actual page — `lib/actions/reviews.ts:222`, `lib/actions/comments.ts:74`.
- ?? Public data fetches use `createClient` (cookie-bound), which forces dynamic rendering and reduces cacheability — `lib/queries/books.ts:9`.

#### Coding Instructions
---
**Issue:** `revalidatePath("/books/[slug]")` does not target a real path.
**Severity:** ?? Medium
**Location:** `lib/actions/reviews.ts:222`

**Current Code:**
```typescript
revalidatePath(`/books/[slug]`, "page");
```

**Recommended Code:**
```typescript
const { data: book } = await supabase
  .from("books")
  .select("slug")
  .eq("id", review.book_id)
  .single();

if (book?.slug) {
  revalidatePath(`/books/${book.slug}`);
}
```

**Reasoning:** Revalidating the concrete path ensures ISR cache invalidation actually occurs for the book page.

---
**Issue:** Public book reads use `createClient`, which makes the route dynamic.
**Severity:** ?? Low
**Location:** `lib/queries/books.ts:9`

**Current Code:**
```typescript
export async function getBookBySlug(slug: string): Promise<Book | null> {
  const supabase = await createClient();
  // ...
}
```

**Recommended Code:**
```typescript
export async function getBookBySlug(slug: string): Promise<Book | null> {
  const supabase = createPublicClient();
  // ...
}
```

**Reasoning:** Using a public client for anonymous data allows caching and avoids accidental dynamic rendering.

---

### 11. AI Integration Review

#### Issues Found
- ?? Curated picks query uses a non-existent table name and wrong column names — `app/api/ai/curated-picks/route.ts:57`.
- ?? Trending insights send raw review content to the AI without redaction — `app/api/ai/trending-insights/route.ts:96`.

#### Coding Instructions
---
**Issue:** Curated picks read from `taste_profiles`, but the schema uses `user_taste_profiles`.
**Severity:** ?? Medium
**Location:** `app/api/ai/curated-picks/route.ts:57`

**Current Code:**
```typescript
const { data: profile } = await publicClient
  .from("taste_profiles")
  .select("favorite_genres, favorite_vibes, reading_speed, preferred_length")
  .eq("user_id", user.id)
  .single();
```

**Recommended Code:**
```typescript
const { data: profile } = await supabase
  .from("user_taste_profiles")
  .select("preferred_genres, preferred_vibes, preferred_pace, preferred_length")
  .eq("user_id", user.id)
  .single();
```

**Reasoning:** This fixes a schema mismatch that otherwise yields null profiles and degraded recommendations.

---
**Issue:** Raw review content is sent to the AI without redaction or PII minimization.
**Severity:** ?? Medium
**Location:** `app/api/ai/trending-insights/route.ts:96`

**Current Code:**
```typescript
const reviewContext = bookReviews
  .slice(0, 5)
  .map((r) => `Rating: ${r.rating}/5. "${r.content?.slice(0, 200) || "No content"}". Vibes: ${r.vibe_tags?.join(", ") || "none"}`)
  .join("\n");
```

**Recommended Code:**
```typescript
const reviewContext = bookReviews
  .slice(0, 5)
  .map((r) => {
    const safeText = (r.summary || "").slice(0, 140);
    return `Rating: ${r.rating}/5. "${safeText}". Vibes: ${r.vibe_tags?.join(", ") || "none"}`;
  })
  .join("\n");
```

**Reasoning:** Minimizing user-generated content reduces privacy risk and keeps prompt sizes smaller and cheaper.

---

### 12. Geo/Map Features Review

#### Issues Found
- ?? Disabling location sharing does not clear location data; profiles are publicly readable — `lib/actions/location.ts:175`, `supabase/migrations/001_initial_schema.sql:27`.
- ?? Overpass requests do not set timeouts, risking hung API calls — `app/api/geo/places/route.ts:166`.

#### Coding Instructions
---
**Issue:** Disabling location sharing does not clear geohash or label, which remain publicly readable.
**Severity:** ?? High
**Location:** `lib/actions/location.ts:175`

**Current Code:**
```typescript
await supabase
  .from("profiles")
  .update({
    location_enabled: enabled,
    location_updated_at: new Date().toISOString(),
  })
  .eq("id", user.id);
```

**Recommended Code:**
```typescript
const now = new Date().toISOString();

await supabase
  .from("profiles")
  .update(
    enabled
      ? { location_enabled: true, location_updated_at: now }
      : {
          location_enabled: false,
          location_geohash: null,
          location_label: null,
          location_precision: 6,
          location_updated_at: now,
        }
  )
  .eq("id", user.id);
```

**Reasoning:** Clearing location fields prevents stale data from being exposed when users opt out, especially given the public SELECT policy on `profiles`.

---
**Issue:** Overpass API calls lack timeouts, which can hang serverless requests.
**Severity:** ?? Medium
**Location:** `app/api/geo/places/route.ts:166`

**Current Code:**
```typescript
const response = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: `data=${encodeURIComponent(osmQuery)}`,
});
```

**Recommended Code:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

const response = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `data=${encodeURIComponent(osmQuery)}`,
  signal: controller.signal,
});

clearTimeout(timeout);
```

**Reasoning:** Timeouts protect API routes from long-running external calls and reduce cold-start pressure.

---

## Priority Action Items

### Immediate (Critical/High)
| # | Issue | File | Coding Instruction Summary | Reason |
|---|-------|------|---------------------------|--------|
| 1 | RLS update policy allows self-approval | supabase/migrations/002_book_submissions_structured_reviews.sql:59 | Add `WITH CHECK` and keep status `pending` for user updates | Prevents users from approving their own submissions |
| 2 | Books table open inserts | supabase/migrations/001_initial_schema.sql:63 | Restrict inserts to admins/service role only | Blocks bypass of moderation and catalog pollution |
| 3 | Webhook secret fails open + wrong client | app/api/webhooks/supabase/route.ts:6 | Fail closed in production and use admin client | Prevents unauthorized webhook execution and ensures admin API works |
| 4 | Location opt-out keeps geohash | lib/actions/location.ts:175 | Clear location fields when disabled | Prevents leakage of location data |

### Short-term (Medium)
| # | Issue | File | Coding Instruction Summary | Reason |
|---|-------|------|---------------------------|--------|
| 1 | Recalculate ratings via full scan | lib/actions/reviews.ts:451 | Move to SQL aggregate RPC | Scales rating updates with review count |
| 2 | places_cache RLS mismatch | lib/queries/geo.ts:135 | Use service role or RPC for cache reads | Prevents empty cache results at runtime |
| 3 | Goodreads import loads all books | lib/actions/import.ts:102 | Query by ISBNs/ids in chunks | Avoids large memory usage |
| 4 | AI in-memory caches | app/api/ai/curated-picks/route.ts:8 | Use KV with TTL | Prevents memory bloat and improves cache hit rate |
| 5 | Dynamic path revalidation | lib/actions/reviews.ts:222 | Revalidate actual slug path | Ensures ISR cache is invalidated properly |

### Long-term (Low)
| # | Issue | File | Coding Instruction Summary | Reason |
|---|-------|------|---------------------------|--------|
| 1 | Missing canonicals | app/(public)/users/[username]/page.tsx:50 | Add canonical metadata | Reduces duplicate indexing |
| 2 | Empty alt text in admin | app/(app)/admin/reviews/page.tsx:309 | Provide descriptive alt text | Improves accessibility |
| 3 | Badge icon mojibake | lib/data/badges.ts:64 | Replace corrupted icons | Restores UI polish |
| 4 | Slug generation duplication | lib/actions/books.ts:22 | Centralize slug utility | Easier maintenance |

## Positive Observations
- `lib/utils/jsonld.ts` safely escapes JSON-LD to prevent script injection and is used consistently in public pages.
- `lib/utils/rate-limit.ts` provides a KV-backed rate limiter with graceful in-memory fallback and is applied to expensive endpoints (AI, geo, comments).
- RLS is enabled across core tables, with indexed columns for common queries (books, reviews, follows, places).

## Architecture Recommendations
- Centralize Supabase access in typed query helpers to eliminate `as unknown as` casts and keep schemas aligned with `types/database.ts`.
- Move multi-step write workflows (approval/moderation, rating recalculation) into SQL functions to guarantee atomicity and reduce round trips.
- Standardize caching with Next.js tags or Vercel KV to avoid ad-hoc in-memory caches in serverless routes.

## Conclusion
The project shows strong foundational practices but has a few critical RLS and webhook security gaps that should be addressed immediately. After those are fixed, focus on data-layer atomicity and caching strategy to improve reliability and performance. With these changes, the codebase will be in a much better position for production scale and maintainability.
