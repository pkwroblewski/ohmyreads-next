# OhMyReads

Next.js 16 book tracking app with Supabase, Vercel, and AI integration.

## Principles

- **Minimal changes only** - Every edit should be as small as possible
- **Fix root causes, not symptoms** - Investigate before patching
- **Question requirements before implementing** - Clarify ambiguity first
- **Execute, don't delegate** - Use all available tools (CLI, agents, MCP) to complete tasks. Only ask the user to act when genuinely impossible. When delegation is necessary, clearly state what to do, how to do it, and why I cannot.

## Workflow

**For tasks with 3+ steps or multi-file changes:**

1. **STOP** - Do not start coding
2. **READ** `.claude/docs/example-plan.md` - understand the exact format
3. **READ** `.claude/docs/planning-workflow.md` - understand the process
4. **CREATE** plan in `.claude/plans/` using exact template format
5. **EXECUTE** one task → fill Completed Notes → mark COMPLETE
6. **WAIT** for user to run `/clear`
7. **AFTER CLEAR** → re-read plan file, find next PENDING, repeat

## Plan Structure (Non-Negotiable)

**Status table must have these columns:**
```
| # | Task | Priority | Effort | Status | Files |
```

**Each task must have these sections:**
- **Source/Audit Finding** — where this task came from
- **Priority** — 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low
- **Effort** — Low / Medium / High
- **File(s)** — what will be modified
- **Context** — why this task exists
- **Steps** — checkboxes for actions
- **Verify** — checkboxes for confirmation
- **Completed Notes** — filled AFTER completing (files modified, approach, deviations, issues)
- **Status** — one of:
  - `[ ] PENDING` - not started
  - `[x] COMPLETE` - all steps and verify checks done
  - `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
  - `[-] BLOCKED` - cannot proceed, waiting on external dependency

**Plan must also include:**
- Summary section
- Out of Scope (Deferred) table
- Final QA Checklist
- Changelog table

## When Verification is Blocked

If you cannot complete Verify steps (deployment needed, credentials required, etc.):

1. **STOP** - Do not mark COMPLETE
2. **ASK** - "Verification blocked because [reason]. How should I proceed?"
3. **WAIT** - User decides
4. **UPDATE** - Use status user approves (e.g., `[x] CODE COMPLETE - Verification blocked`)

Never assume deferred verification carries over to subsequent tasks.

## Don't Do This

- ❌ Start coding without reading example-plan.md first
- ❌ Use user-provided docs or audits directly as plans → convert to exact template
- ❌ Create Status table with different columns → always use `# | Task | Priority | Effort | Status | Files`
- ❌ Execute multiple tasks without `/clear` → one task, then clear, then next
- ❌ Mark COMPLETE without filling Completed Notes → always document what was done
- ❌ Mark COMPLETE with unchecked Verify items → stop and ask if verification is blocked
- ❌ Skip Out of Scope section → explicitly list what's deferred and why
- ❌ Skip planning for "small" multi-step tasks → always plan if 3+ steps

## Commands
```bash
npm run dev            # Development server
npm run build          # Production build (never while `next dev` runs)
npm run lint           # ESLint — 0 errors, 0 warnings
npm run typecheck      # tsc --noEmit
npm run test           # Vitest (watch)
npm run test:run       # Vitest once (CI)
npm run test:coverage  # Vitest with coverage
npm run types:gen      # Regenerate types/database.generated.ts (never hand-edit)
npm run enrich-books   # Fill missing book metadata (-- --dry-run --limit N)
npm run import-ratings # Refresh Open Library ratings
```
Migrations: `npx supabase db query --linked -f supabase/migrations/NNN_name.sql`.
