# OhMyReads

Book tracking with shelves, reviews, reading challenges, friends, direct
messages and a map of nearby readers and bookish places. Next.js 16 (App
Router) on Vercel, Supabase (Postgres, Auth, Realtime, Storage), Vercel AI SDK
for the place-search assistant, Mapbox for the map.

## Setup

1. Install dependencies: `npm install` (Node 20+).
2. Copy `.env.example` to `.env.local` and fill in at least the Supabase keys.
   Every other variable is documented inline in `.env.example`, with what
   degrades when it is unset.
3. Link the Supabase CLI to the project so migrations and type generation
   work: `npx supabase link --project-ref bgczdbmqievfilvdzlgl`.
4. Generate the database types: `npm run types:gen`. This overwrites
   `types/database.generated.ts`, which is never edited by hand.
5. Start the dev server: `npm run dev` and open http://localhost:3000.

Local sign-in uses email + password. Google OAuth redirects to the production
Site URL configured in Supabase, so it does not land on localhost.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000. |
| `npm run build` | Production build. Do not run it while `next dev` is running: both write to `.next`. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint (`eslint.config.mjs`). CI requires 0 errors; warnings are tracked at 0. |
| `npm run typecheck` | `tsc --noEmit` with `noUnusedLocals` / `noUnusedParameters`. |
| `npm run test` | Vitest in watch mode. |
| `npm run test:run` | Vitest once (what CI runs). |
| `npm run test:coverage` | Vitest with coverage. |
| `npm run types:gen` | Regenerate `types/database.generated.ts` from the linked Supabase project. |
| `npm run enrich-books` | Fill missing book metadata from Google Books / Open Library. Accepts `-- --dry-run --limit 10 --verbose`. |
| `npm run import-ratings` | Refresh `average_rating` / `ratings_count` from Open Library. |

CI (`.github/workflows`) runs `typecheck`, `lint` and `test:run`.

## Database migrations

Migrations live in `supabase/migrations/NNN_name.sql` and are applied to the
linked project with the Supabase CLI:

```bash
npx supabase db query --linked -f supabase/migrations/068_example.sql
```

Only the last statement's result is printed. Checks that verify a migration
after the fact live in `supabase/checks/`. Pushing a migration does not need
Docker; `db dump` / `db diff` do.

Conventions: `SECURITY DEFINER` functions set `search_path = public`;
`current_role` is reserved in Postgres, use `db_role`; after a schema change
run `npm run types:gen` and commit the generated file.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Routes. `(app)` is signed-in, `(public)` is anonymous, `api/` holds route handlers (OG images, cron, webhooks, geo). |
| `components/` | UI, grouped by feature. Client components may use `console`; `lib/` and `app/` must log through `lib/utils/log.ts`. |
| `lib/actions/` | Server Actions (`"use server"`). Every action returns `ActionResult` and authenticates with `requireUser` / `requireAdmin`. |
| `lib/queries/` | Read-only data access called from Server Components. |
| `lib/validation/` | Zod schemas shared by actions and route handlers. |
| `hooks/` | Client hooks (covers, realtime messages, sign-out). |
| `supabase/` | Migrations and post-migration checks. |
| `types/` | `database.generated.ts` (generated), `database.ts` (alias shim), `app.ts` (app-only types). |
| `scripts/` | Maintenance scripts; already-applied one-offs are in `scripts/archive/`. |
| `__tests__/` | Vitest suites mirroring `lib/` and `app/api/`. |

`proxy.ts` at the repository root is the Next.js 16 request proxy (the file
that used to be `middleware.ts`). The build fails if both exist.

## Authentication setup

Supabase, Authentication → URL Configuration:

- Site URL: `https://ohmyreads-next.vercel.app`
- Redirect URLs: `https://ohmyreads-next.vercel.app/callback`

Supabase, Authentication → Providers → Google: enable it and paste the client
ID and secret from Google Cloud Console.

Google Cloud Console, APIs & Services → Credentials:

1. Create an OAuth 2.0 Client ID.
2. Add the authorised redirect URI
   `https://bgczdbmqievfilvdzlgl.supabase.co/auth/v1/callback`.
3. On the OAuth consent screen either publish the app or add test users.

## Deployment

Pushes to `main` deploy to Vercel. Production environment variables are
managed with `vercel env` (see `.env.example` for the full list and which
features each one gates).
