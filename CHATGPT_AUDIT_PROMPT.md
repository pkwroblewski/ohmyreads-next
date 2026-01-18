# OhMyReads Code Audit Request

## Instructions for GPT 5.2 Codex High

You are performing a **READ-ONLY code audit** of the OhMyReads project. Your task is to analyze the codebase thoroughly and produce a comprehensive assessment report in Markdown format.

**CRITICAL: Do NOT modify any code.** Only read, analyze, and report findings.

**IMPORTANT: For each finding, you MUST provide specific, actionable coding instructions with clear reasoning for why the change is recommended.**

---

## Project Overview

### What is OhMyReads?
A book tracking and reading community platform where users can:
- Track books they're reading, have read, or want to read
- Write and share book reviews with comments
- Follow other readers and discover new connections
- Track reading progress, statistics, and reading challenges
- Discover new books through community recommendations and AI-powered search
- Find reading spots (bookshops, libraries, cafes) on an interactive map
- Check in at reading places and share experiences
- Earn achievement badges for reading milestones
- Import reading history from Goodreads

### Target Audience
- Avid readers who want to organize their reading life
- Book clubs and reading communities
- People looking for book recommendations
- Readers wanting to discover local reading spots

### Business Model
- Free tier with core features
- Potential affiliate links (Amazon, Bookshop.org)
- Google AdSense for ad revenue

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| React | React 19 with React Compiler |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (Google OAuth, Email/Password) |
| Hosting | Vercel |
| Validation | Zod 4 |
| State Management | React hooks, TanStack Query |
| Book Data | Google Books API, Open Library API |
| Maps | Mapbox GL |
| AI | Vercel AI SDK with Anthropic/OpenAI/Google providers |
| Email | Resend |
| Error Tracking | Sentry |
| Caching | Vercel KV |

---

## Project Structure (Actual)

```
ohmyreads-next/
├── app/                          # Next.js App Router pages
│   ├── (app)/                    # Protected user routes (dashboard, settings, etc.)
│   │   ├── admin/                # Admin panel routes
│   │   ├── challenges/           # Reading challenges
│   │   ├── dashboard/            # User dashboard
│   │   ├── import/               # Goodreads import
│   │   ├── my-shelf/             # User's book shelf
│   │   ├── my-submissions/       # User's book submissions
│   │   ├── onboarding/           # User onboarding (taste profile)
│   │   ├── profile/              # Profile view and edit
│   │   ├── settings/             # User settings
│   │   ├── stats/                # Reading statistics
│   │   └── submit-book/          # Book submission form
│   ├── (auth)/                   # Authentication routes
│   │   ├── callback/             # OAuth callback
│   │   ├── forgot-password/      # Password reset request
│   │   ├── login/                # Login page
│   │   ├── reset-password/       # Password reset form
│   │   └── signup/               # Registration page
│   ├── (public)/                 # Public pages
│   │   ├── about/                # About page
│   │   ├── authors/              # Author pages
│   │   ├── books/                # Book catalog and details
│   │   ├── community/            # Community feed and map
│   │   ├── discover/             # Discover readers
│   │   ├── features/             # Features page
│   │   ├── lists/                # Curated reading lists
│   │   ├── pricing/              # Pricing page
│   │   ├── privacy/              # Privacy policy
│   │   ├── recommendations/      # AI recommendations
│   │   ├── terms/                # Terms of service
│   │   ├── trending/             # Trending books
│   │   └── users/                # Public user profiles
│   ├── api/                      # API routes
│   │   ├── ai/                   # AI-powered endpoints
│   │   ├── books/                # Book search APIs
│   │   ├── community/            # Community feed API
│   │   ├── cron/                 # Scheduled tasks
│   │   ├── discover/             # Discovery API
│   │   ├── export/               # Data export
│   │   ├── geo/                  # Geo/map APIs
│   │   ├── og/                   # OpenGraph image generation
│   │   ├── seed/                 # Database seeding
│   │   └── webhooks/             # Webhook handlers
│   └── icons/                    # Dynamic icon generation
├── components/
│   ├── admin/                    # Admin components
│   ├── ai/                       # AI search components
│   ├── badges/                   # Achievement badge components
│   ├── books/                    # Book-related components
│   ├── challenges/               # Reading challenge components
│   ├── community/                # Community feed components
│   ├── dashboard/                # Dashboard widgets
│   ├── discover/                 # Reader discovery components
│   ├── geo/                      # Map and location components
│   ├── home/                     # Homepage components
│   ├── import/                   # Import tool components
│   ├── layout/                   # Layout components (navbar, sidebar)
│   ├── onboarding/               # Onboarding wizard
│   ├── providers/                # React context providers
│   ├── recommendations/          # Recommendation components
│   ├── reviews/                  # Review and comment components
│   ├── settings/                 # Settings page components
│   ├── skeletons/                # Loading skeleton components
│   ├── social/                   # Social features (follow, links)
│   ├── stats/                    # Statistics components
│   ├── trending/                 # Trending components
│   └── ui/                       # Reusable UI primitives
├── hooks/                        # Custom React hooks
│   └── use-auth.ts               # Authentication hook
├── lib/
│   ├── actions/                  # Server actions
│   ├── ai/                       # AI tools and prompts
│   ├── data/                     # Static data (badges, lists, seeds)
│   ├── email/                    # Email templates and client
│   ├── queries/                  # Database query functions
│   ├── services/                 # External service integrations
│   ├── supabase/                 # Supabase clients (client, server, admin)
│   ├── utils/                    # Helper functions
│   └── validation/               # Zod schemas
├── scripts/                      # CLI scripts for seeding/importing
├── supabase/
│   └── migrations/               # Database migration files (001-018)
├── tasks/                        # Task tracking markdown files
├── types/                        # TypeScript type definitions
│   └── database.ts               # Supabase database types
└── public/                       # Static assets
```

---

## Audit Categories

Please analyze the codebase across these categories and provide detailed findings:

### 1. Code Quality & Maintainability
- [ ] Code organization and folder structure
- [ ] Naming conventions (files, functions, variables)
- [ ] Code duplication (DRY violations)
- [ ] Function/component size and complexity
- [ ] Comments and documentation quality
- [ ] Unused imports, variables, or dead code
- [ ] Consistent coding style

### 2. TypeScript & Type Safety
- [ ] Usage of `any` type (should be avoided)
- [ ] Missing type definitions
- [ ] Proper interface/type usage
- [ ] Generic type usage where appropriate
- [ ] Zod schema coverage for runtime validation
- [ ] Type errors or warnings
- [ ] Proper typing of API responses
- [ ] Database types alignment with actual schema

### 3. Security Audit
- [ ] Supabase Row Level Security (RLS) policies
- [ ] Authentication flow security (OAuth + email/password)
- [ ] Protected route implementation
- [ ] API route authorization
- [ ] Input sanitization and validation
- [ ] XSS vulnerability prevention
- [ ] CSRF protection
- [ ] Exposed secrets or sensitive data
- [ ] Secure cookie handling
- [ ] Admin route protection
- [ ] Rate limiting implementation

### 4. Performance Analysis
- [ ] Unnecessary re-renders in components
- [ ] Missing React.memo, useMemo, useCallback where beneficial
- [ ] Image optimization (next/image, cover image handling)
- [ ] Bundle size concerns
- [ ] Database query efficiency
- [ ] Proper use of React Server Components vs Client Components
- [ ] Data fetching patterns (streaming, suspense)
- [ ] Caching strategies (Next.js cache, Vercel KV, revalidation)
- [ ] Map/Mapbox performance optimization
- [ ] React 19 and React Compiler optimization opportunities

### 5. Database & Data Layer
- [ ] N+1 query problems
- [ ] Missing database indexes (check migrations)
- [ ] Inefficient Supabase queries
- [ ] Proper use of joins vs multiple queries
- [ ] Data validation before database operations
- [ ] Error handling for database operations
- [ ] Transaction usage where needed
- [ ] RLS policy completeness across all tables
- [ ] Migration file quality and organization

### 6. SEO & Metadata
- [ ] Page titles and meta descriptions
- [ ] OpenGraph tags for social sharing (OG image routes exist)
- [ ] Structured data (JSON-LD) for books and authors
- [ ] Sitemap generation (sitemap.ts exists)
- [ ] robots.txt configuration (robots.ts exists)
- [ ] Canonical URLs
- [ ] Dynamic metadata for book/author/user pages
- [ ] Alt text for images

### 7. Accessibility (a11y)
- [ ] Semantic HTML usage
- [ ] ARIA labels and roles
- [ ] Keyboard navigation support
- [ ] Focus management
- [ ] Color contrast ratios
- [ ] Screen reader compatibility
- [ ] Form labels and error messages
- [ ] Map accessibility considerations

### 8. Error Handling & User Feedback
- [ ] Try/catch blocks for async operations
- [ ] User-friendly error messages
- [ ] Loading states during operations (loading.tsx files)
- [ ] Empty states for lists
- [ ] Form validation feedback
- [ ] Toast/notification system (sonner is installed)
- [ ] Error boundaries for component failures (error.tsx, global-error.tsx)
- [ ] Sentry error tracking integration

### 9. UI/UX Consistency
- [ ] Design system adherence
- [ ] Consistent spacing and typography
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode implementation consistency
- [ ] Interactive element feedback (hover, active, focus)
- [ ] Consistent button/link styling
- [ ] Form input consistency
- [ ] Map UI/UX on mobile devices

### 10. Next.js 16 Best Practices
- [ ] Proper use of App Router features
- [ ] Server Components vs Client Components (proper separation)
- [ ] Server Actions usage
- [ ] Route handlers (API routes)
- [ ] Route groups ((app), (auth), (public))
- [ ] Dynamic routes and generateStaticParams
- [ ] Proper loading.tsx and error.tsx usage
- [ ] React 19 features usage
- [ ] React Compiler compatibility

### 11. AI Integration Review
- [ ] AI SDK usage patterns
- [ ] Prompt security (injection prevention)
- [ ] AI tool definitions and error handling
- [ ] Rate limiting for AI endpoints
- [ ] Cost optimization for AI calls
- [ ] Fallback behavior when AI fails

### 12. Geo/Map Features Review
- [ ] Mapbox integration quality
- [ ] Location data handling and privacy
- [ ] Place data validation
- [ ] Geospatial query efficiency
- [ ] Map state management
- [ ] Mobile map performance

---

## Output Requirements

Create a file called `CODE_AUDIT_REPORT.md` in the project root with the following structure:

```markdown
# OhMyReads Code Audit Report

**Audit Date:** [Current Date]
**Auditor:** GPT 5.2 Codex High
**Project Version:** 0.1.0 (from package.json)
**Next.js Version:** 16.0.10
**React Version:** 19.2.3

## Executive Summary
[2-3 paragraph overview of overall code health, major concerns, and highlights]

## Severity Ratings
- CRITICAL - Must fix before production
- HIGH - Should fix soon
- MEDIUM - Improve when possible
- LOW - Nice to have improvements

## Findings by Category

### 1. Code Quality & Maintainability

#### Issues Found
[List each issue with severity, file location, and description]

#### Coding Instructions
[For EACH issue, provide specific code changes with reasoning]

**Example format for each issue:**

---
**Issue:** [Brief description]
**Severity:** [CRITICAL/HIGH/MEDIUM/LOW]
**Location:** `path/to/file.ts:line_number`

**Current Code:**
```typescript
// The problematic code snippet
```

**Recommended Code:**
```typescript
// The fixed code snippet
```

**Reasoning:** [Explain WHY this change is recommended - what problem it solves, what best practice it follows, what risk it mitigates]

---

### 2. TypeScript & Type Safety
[Same format - issues with specific coding instructions and reasoning]

### 3. Security Audit
[Same format - issues with specific coding instructions and reasoning]

[Continue for all 12 categories...]

## Priority Action Items

### Immediate (Critical/High)
| # | Issue | File | Coding Instruction Summary | Reason |
|---|-------|------|---------------------------|--------|
| 1 | [Issue] | [File:line] | [Brief instruction] | [Brief reason] |
| 2 | ... | ... | ... | ... |

### Short-term (Medium)
| # | Issue | File | Coding Instruction Summary | Reason |
|---|-------|------|---------------------------|--------|
| 1 | ... | ... | ... | ... |

### Long-term (Low)
| # | Issue | File | Coding Instruction Summary | Reason |
|---|-------|------|---------------------------|--------|
| 1 | ... | ... | ... | ... |

## Positive Observations
[Things done well that should be maintained - be specific about files/patterns]

## Architecture Recommendations
[Higher-level suggestions for code organization or patterns - with reasoning]

## Conclusion
[Final thoughts and next steps recommendation]
```

---

## Specific Areas to Examine

### Authentication Flow
- Check `app/(auth)/` routes (login, signup, forgot-password, reset-password, callback)
- Review Supabase auth client usage in `lib/supabase/`
- Check for proper session handling in `use-auth.ts` hook
- Verify OAuth callback handling

### Book Management
- Review book submission/creation flow in `app/(app)/submit-book/`
- Check book detail page data fetching in `app/(public)/books/[slug]/`
- Review Google Books/Open Library API integration in `lib/utils/external-book-search.ts`
- Review user-book relationship handling in `lib/actions/books.ts`

### User Profiles & Social
- Check profile page implementation in `app/(app)/profile/` and `app/(public)/users/[username]/`
- Review reading stats calculation in `lib/queries/stats.ts`
- Verify social features in `lib/actions/follows.ts`
- Check follow system components in `components/social/`

### Reviews & Comments
- Review submission flow in `lib/actions/reviews.ts` and `lib/actions/comments.ts`
- Check for proper validation in `lib/validation/`
- Verify relationship to books/users
- Check edit/delete permissions

### Map & Geo Features
- Review Mapbox integration in `components/geo/`
- Check place submission and moderation in `app/(public)/community/map/`
- Verify geo API routes in `app/api/geo/`
- Review location privacy in `lib/actions/location.ts`

### AI Features
- Review AI SDK usage in `lib/ai/`
- Check AI API routes in `app/api/ai/`
- Verify AI components in `components/ai/`

### Admin Panel
- Review admin routes in `app/(app)/admin/`
- Check admin-specific actions in `lib/actions/admin-*.ts`
- Verify admin authorization

### Database Migrations
- Review all migrations in `supabase/migrations/` (001-018)
- Check for proper RLS policies
- Verify index definitions
- Check trigger implementations

---

## How Claude Code Will Use This Report

After you generate the audit report:
1. Claude Code will read `CODE_AUDIT_REPORT.md`
2. It will prioritize fixes based on severity
3. It will implement improvements systematically using the provided coding instructions
4. Each fix will be tested before moving to the next

**Your audit should be actionable** - specific enough that another AI can implement fixes without additional context.

**Every finding MUST include:**
1. The exact file path and line number(s)
2. The current problematic code
3. The recommended replacement code
4. A clear explanation of WHY this change improves the codebase

---

## Begin Audit

Please start by:
1. Reading the project structure
2. Examining package.json for dependencies (already provided above)
3. Reviewing the core files in order:
   - `app/layout.tsx`
   - `lib/supabase/` files (client.ts, server.ts, admin.ts)
   - `hooks/use-auth.ts`
   - Route handlers in `app/api/`
   - Server actions in `lib/actions/`
   - Database queries in `lib/queries/`
   - Page components in each route group
   - Reusable components
   - Database migrations in `supabase/migrations/`
4. Document all findings in the report format above with coding instructions

**Remember: READ ONLY - Do not modify any files.**

Generate the complete `CODE_AUDIT_REPORT.md` file when your analysis is complete.
