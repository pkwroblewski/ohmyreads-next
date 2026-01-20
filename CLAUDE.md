# OhMyReads

Next.js 16 book tracking app with Supabase, Vercel, and AI integration.

## Principles

- **Minimal changes only** - Every edit should be as small as possible
- **Fix root causes, not symptoms** - Investigate before patching
- **Question requirements before implementing** - Clarify ambiguity first
- **Execute, don't delegate** - Use all available tools (CLI, agents, MCP) to complete tasks. Only ask the user to act when genuinely impossible. When delegation is necessary, clearly state what to do, how to do it, and why I cannot.

## Workflow

For multi-step tasks, create a plan file in `.claude/plans/` following the template in:
→ [Planning Workflow](.claude/docs/planning-workflow.md)

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```
