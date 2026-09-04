# Archived scripts

One-off catalog jobs that have already been run against production. They are
kept for reference and are **not** wired into `package.json`; re-running them
would duplicate or overwrite catalog data. Run one deliberately with
`npx --yes tsx scripts/archive/<name>.ts` after reading its header.

| Script | What it did | Status |
| --- | --- | --- |
| `seed-books.ts` | Initial ~2000-book seed from Open Library subjects. | Applied (Dec 2025). Superseded by `reseed-curated.ts`. |
| `reseed-curated.ts` | Replaced the seed with the curated ~1000-book list plus Google Books enrichment. | Applied (Jan 2026). |
| `fix-duplicate-books.ts` | Audited and merged duplicate titles (`--audit` / `--fix`). | Applied (Jan 2026). Safe to re-run with `--audit`. |
| `import-award-winners.ts` | Imported award-winning books with award tags. | Applied (Feb 2026). |

The live maintenance scripts (`enrich-books.ts`, `import-ratings.ts`) stay in
`scripts/` and are exposed as `npm run enrich-books` / `npm run import-ratings`.
