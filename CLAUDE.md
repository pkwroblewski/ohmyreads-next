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

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```
