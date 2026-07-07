# OhMyReads - CI Pipeline & Repo Hygiene

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

## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 1 | Repo hygiene: remove junk files, update .gitignore | 🟡 Medium | Low | [x] Complete | `.gitignore`, root PNGs, `nul` |
| 2 | Verify all CI commands pass locally | 🔴 Critical | Low | [x] Complete | `package.json` |
| 3 | Create GitHub Actions CI workflow | 🔴 Critical | Low | [x] Complete | `.github/workflows/ci.yml` |
| 4 | Final QA: push and confirm green run | 🔴 Critical | Low | [ ] Pending | - |

**Progress: 3/4 complete**

## Summary

The repo has `lint`, `test:run`, and `build` scripts but **no `.github/workflows/` directory** — nothing gates pushes or PRs. Every past regression was caught by manual audits. This plan adds a single GitHub Actions workflow running typecheck + lint + tests + build on every push/PR to `main`, and cleans committed/stray junk files first so the repo is tidy. As of 2026-07-07, `npm run lint` reports **0 errors / 25 warnings** — so lint passes today; do NOT add `--max-warnings=0` (that would fail CI; warning cleanup is deferred).

## Task 1: Repo hygiene — remove junk files, update .gitignore

**Source:** Code-quality audit 2026-07-07 (committed `nul` artifact, ~6 MB of root screenshot PNGs)
**Priority:** 🟡 Medium
**Effort:** Low
**File(s):** `.gitignore`, `browse-page-after-fix.png`, `homepage-after-csp-fix-attempt1.png`, `homepage-after-csp-fix-final.png`, `homepage-covers.png`, `nul` (if tracked)

**Context:** Four debugging screenshots (~6 MB total) sit untracked in the repo root, and a Windows `nul` redirect artifact may be tracked in git. These pollute the repo and would bloat history if ever committed.

**Steps:**
1. [x] Run `git ls-files | grep -i "^nul$"` — if it outputs `nul`, run `git rm --cached nul`. Then delete it from disk with PowerShell: `Remove-Item "\\.\$((Get-Location).Path)\nul" -Force` (the `\\.\` prefix is REQUIRED — `nul` is a reserved Windows name; plain `Remove-Item nul` fails). If the file does not exist on disk, skip deletion.
2. [x] Delete the four PNG files from the repo root: `browse-page-after-fix.png`, `homepage-after-csp-fix-attempt1.png`, `homepage-after-csp-fix-final.png`, `homepage-covers.png` (they are untracked debugging screenshots — verify with `git status` that they show as `??` before deleting).
3. [x] Append these lines to `.gitignore` (read the file first; do not duplicate existing entries):
   ```
   # Debugging artifacts
   /nul
   /*.png
   ```
4. [x] Run `git status` — confirm no PNG files and no `nul` appear in output.

**Verify:**
- [x] `git status --short` output contains no `.png` lines and no `nul` line
- [x] `git ls-files | grep -i "^nul$"` outputs nothing
- [x] `Get-ChildItem *.png` in repo root returns nothing

**Completed Notes:**
- Files modified: `.gitignore` (added `/*.png` pattern with comment). Deleted from disk: `nul`, `browse-page-after-fix.png`, `homepage-after-csp-fix-attempt1.png`, `homepage-after-csp-fix-final.png`, `homepage-covers.png`.
- Approach taken: `nul` was NOT tracked in git (git can't index the reserved name), so no `git rm --cached` was needed — deleted from disk via `Remove-Item "\\.\<path>\nul" -Force`. PNGs were untracked (`??`), deleted directly.
- Deviations from plan: `.gitignore` already contained `nul` (line 45) — only `/*.png` was added, under a `# debugging artifacts` comment, to avoid duplication.
- Issues encountered: none. Verified `/*.png` is root-anchored: `git check-ignore` matches `test.png` in root, while tracked `public/images/*.png` assets remain tracked and unaffected.

**Status:** [x] COMPLETE

## Task 2: Verify all CI commands pass locally

**Source:** Prerequisite for Task 3 — CI must be green on first run
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `package.json`

**Context:** Before writing the workflow, confirm every command it will run passes locally. There is currently no `typecheck` script. If any command fails, this task is BLOCKED — do not "fix" unrelated code as part of this plan.

**Steps:**
1. [x] Add to `package.json` scripts (keep existing scripts untouched): `"typecheck": "tsc --noEmit"`
2. [x] Run `npm run typecheck`. If it reports errors: STOP, set this task to `[-] BLOCKED`, list every error verbatim in Completed Notes, and ask the user how to proceed. Do NOT attempt fixes. → **Errors found; user approved fixing the stale test payloads (see Completed Notes). Typecheck green after fix.**
3. [x] Run `npm run lint` — expect exit code 0 (warnings are OK, errors are not).
4. [x] Run `npm run test:run` — expect all tests pass (~80 tests as of Mar 2026).
5. [x] Run `npm run build` — expect successful production build (repo has `.env.local`, so local build has real env vars).

**Verify:**
- [x] `npm run typecheck` exits 0
- [x] `npm run lint` exits 0 with 0 errors (warnings allowed)
- [x] `npm run test:run` exits 0, all tests pass
- [x] `npm run build` exits 0

**Completed Notes:**
- Files modified: `package.json` (added `"typecheck": "tsc --noEmit"` script), `__tests__/lib/actions/reviews.test.ts` (2 payloads), `__tests__/lib/validation/review.test.ts` (2 tests).
- Approach taken: typecheck initially failed (2 errors in `reviews.test.ts` — payloads missing required `vibeTags`/`isSpoiler`). Task was set BLOCKED per plan; user approved "Fix the test file now". Added `vibeTags: [], isSpoiler: false` to both `createReview` payloads → typecheck green. Then `test:run` failed 2 tests in `review.test.ts` — same root cause (stale after the Mar 2026 optional-rating change): tests passed `rating: 4` + short text expecting rejection, but the current rule is "rating OR 50+ chars" so rating+short-text is valid. Removed the rating from both tests so they assert what they name (short text-only reviews rejected); renamed accordingly. All 80 tests green after fix.
- Deviations from plan: plan said "do not fix unrelated code" — fixed 4 stale test cases (2 files) with explicit user approval; no application code touched.
- Issues encountered: build emits a benign warning about multiple lockfiles (`C:\Users\bitpk\package-lock.json` in the home dir vs the project's) — Turbopack infers the wrong workspace root; doesn't affect CI (ubuntu runner won't have a stray home-dir lockfile). Lint: 0 errors / 25 warnings, as expected.

**Status:** [x] COMPLETE

## Task 3: Create GitHub Actions CI workflow

**Source:** Code-quality audit 2026-07-07 — "No `.github/workflows/` at all; nothing gates PRs"
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** `.github/workflows/ci.yml` (new)

**Context:** One workflow, four checks. The build step needs environment variables — the app reads Supabase/Mapbox/AI keys at build time. Use placeholder values; the build must not contact real services. CI does NOT deploy (Vercel handles deploys).

**Steps:**
1. [x] Discover which env vars the build needs: run `grep -rhoE "process\.env\.[A-Z_]+" app/ lib/ components/ proxy.ts 2>/dev/null | sort -u` and note all `NEXT_PUBLIC_*` names plus `SUPABASE_SERVICE_ROLE_KEY` if present.
2. [x] Create `.github/workflows/ci.yml` with exactly this structure (add any additional env vars found in step 1 to the build step's `env:` block with placeholder values):
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]

   jobs:
     ci:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 24
             cache: npm
         - run: npm ci
         - run: npm run typecheck
         - run: npm run lint
         - run: npm run test:run
         - run: npm run build
           env:
             NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
             NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
             SUPABASE_SERVICE_ROLE_KEY: placeholder-service-key
             NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: pk.placeholder
   ```
3. [x] IMPORTANT: the exact Mapbox var name must match what step 1 found (e.g. `NEXT_PUBLIC_MAPBOX_TOKEN` vs `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`) — use the name from the grep, not the example above.
4. [x] Edge case: if `npm run build` fails in CI later because a page prerenders against Supabase at build time, the fix is placeholder env vars shaped like real ones (valid URL format) — NOT skipping the build step.

**Verify:**
- [x] `.github/workflows/ci.yml` exists and `npx yaml-lint` is NOT required — instead verify with `node -e "require('js-yaml')"` is unnecessary; simply confirm the file parses by running `git add .github/workflows/ci.yml` without error and visually matching the structure above
- [x] Workflow contains all four run steps: typecheck, lint, test:run, build
- [x] Every `NEXT_PUBLIC_*` var found in Step 1 grep appears in the build step env block

**Completed Notes:**
- Files modified: `.github/workflows/ci.yml` (new). Staged with `git add`.
- Approach taken: Used the plan's exact workflow structure. Grep found 5 `NEXT_PUBLIC_*` vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (matches the plan's example name exactly), plus two not in the example — `NEXT_PUBLIC_SITE_URL` (placeholder `https://placeholder.example.com`, valid URL shape) and `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` (`placeholder-tag`). Added all 5 + `SUPABASE_SERVICE_ROLE_KEY` to the build step's env block.
- Deviations from plan: none — only the two additional env vars the plan's step 1 anticipated.
- Issues encountered: none. Beyond the plan's minimal parse check, also validated with `js-yaml`: parses cleanly, all 5 run steps (`npm ci`, typecheck, lint, test:run, build) and all 6 env keys confirmed programmatically. Server-only vars (ANTHROPIC_API_KEY, RESEND, KV, etc.) were intentionally excluded — they're read at request time, not build time, per the plan's scope.

**Status:** [x] COMPLETE

## Task 4: Final QA — push and confirm green run

**Source:** Plan completion gate
**Priority:** 🔴 Critical
**Effort:** Low
**File(s):** -

**Context:** The only proof CI works is a green run on GitHub.

**Steps:**
1. [ ] Commit Tasks 1–3 changes: `git add -A && git commit -m "ci: Add GitHub Actions workflow (typecheck, lint, test, build) + repo hygiene"`
2. [ ] Ask the user before pushing (per project convention, confirm outward-facing actions). After approval: `git push origin main`.
3. [ ] Wait ~3 minutes, then run `gh run list --limit 1` — status must be `completed` / conclusion `success`.
4. [ ] If the run failed: run `gh run view --log-failed`, fix ONLY workflow/env issues (not application code), commit, push again. If application code fails in CI but passed locally, STOP and report to user.

**Verify:**
- [ ] `gh run list --limit 1` shows `success`
- [ ] `gh workflow list` shows the `CI` workflow as active

**Completed Notes:**
- Files modified:
- Approach taken:
- Deviations from plan:
- Issues encountered:

**Status:** [ ] PENDING

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Fixing the 25 lint warnings (`no-img-element`, `exhaustive-deps`, `alt-text`) | Not blocking — lint passes with 0 errors | Separate cleanup pass |
| `--max-warnings=0` enforcement | Would fail CI until warnings fixed | After warning cleanup |
| `npm audit` / dependency scanning step | Deferred from security-audit-2026-02-07 | When adding Dependabot |
| CI deploy step | Vercel auto-deploys on push | Never (not needed) |
| Branch protection rules requiring CI | Needs repo admin action in GitHub UI | User decision after first green run |

## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (green `gh run list` result)
- [ ] No console errors

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-07-07 | 1 | COMPLETE | Deleted `nul` + 4 root PNGs; added `/*.png` to .gitignore (`nul` entry already existed) |
| 2026-07-07 | 2 | COMPLETE | Added `typecheck` script; fixed 4 stale test cases (user-approved) in `reviews.test.ts` + `review.test.ts`; typecheck/lint/test/build all exit 0 |
| 2026-07-07 | 3 | COMPLETE | Created `.github/workflows/ci.yml` — 4 checks on push/PR to main; 6 placeholder env vars in build step (incl. `NEXT_PUBLIC_SITE_URL` + `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` found via grep) |
