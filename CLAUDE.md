# OhMyReads

Next.js 16 book tracking app with Supabase, Vercel, and AI integration.

## Principles

- **Minimal changes only** - Every edit should be as small as possible
- **Fix root causes, not symptoms** - Investigate before patching
- **Question requirements before implementing** - Clarify ambiguity first
- **Execute, don't delegate** - Use all available tools (CLI, agents, MCP) to complete tasks. Only ask the user to act when genuinely impossible. When delegation is necessary, clearly state what to do, how to do it, and why I cannot.

## Workflow

**For tasks with 3+ steps or multi-file changes:**

1. **Create plan file** in `.claude/plans/` using the exact template format (status table, per-task sections)
2. **Always use template** — even when adapting user-provided plans
3. **Update plan after execution** — mark tasks `[x] COMPLETE`, record commits
4. **Never skip by rationalizing** "it's small enough"

→ [Planning Workflow Template](.claude/docs/planning-workflow.md)

## Pre-Execution Checklist

Before starting any task with 3+ steps:

- [ ] Plan file created in `.claude/plans/` with exact template format
- [ ] Status table has columns: `#`, `Task`, `Status`, `Files`
- [ ] Each task has: **File**, **Steps** (checkboxes), **Verify** (checkboxes), **Status**
- [ ] `Progress: 0/N complete` line present
- [ ] Final QA Checklist included

During execution:
- [ ] Mark task `[x] COMPLETE` immediately after finishing
- [ ] Ask user to `/clear` after each task
- [ ] Re-read plan file after clearing
- [ ] Record commit hash in status table if applicable

## Common Violations (Don't Do This)

❌ **Wrong:** Using a user-provided doc directly as the plan
✅ **Right:** Convert any input to the exact template format first

❌ **Wrong:** Status table with columns like `Task | Status | Commit`
✅ **Right:** Status table with `# | Task | Status | Files`

❌ **Wrong:** Executing all tasks in one session without `/clear`
✅ **Right:** `/clear` after each task, re-read plan, continue

❌ **Wrong:** Task sections without Steps/Verify checkboxes
✅ **Right:** Every task has actionable checkboxes

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```
