# Planning Workflow

Use this for tasks requiring 3+ steps or multi-file changes.

---

## Plan File Template

Create in `.claude/plans/{descriptive-name}.md`:

```markdown
# [Project] - [Task Name]

> **Workflow:** Read this file → Find PENDING task → Execute → Verify → Mark COMPLETE → `/clear`

---

## Status

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Description | [ ] Pending | file.ts |
| 2 | Description | [ ] Pending | other.ts |
| N | Final QA | [ ] Pending | - |

**Progress: 0/N complete**

---

## Summary
One paragraph: what's the problem and approach.

---

## Task N: Title

**File:** `path/to/file.ts`

**Steps:**
1. [ ] Step one
2. [ ] Step two

**Verify:**
- [ ] Specific check 1
- [ ] Specific check 2

**Status:** [ ] PENDING

---

## Final QA Checklist
- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (manual test)
```

---

## Execution Protocol

### Per-Task Cycle
1. **Read** → Find first PENDING task in status table
2. **Execute** → Complete all steps
3. **Verify** → Check all items in task's Verify section
4. **Update** → Mark `[x] COMPLETE`, increment progress
5. **Clear** → Ask user to `/clear` context
6. **Repeat** → Re-read plan, continue with next PENDING

### Quality Gates
Each task must pass its verification before marking complete:
- If verification fails → fix before moving on
- If blocked → document blocker, ask user

---

## Context Management

| Command | When to use |
|---------|-------------|
| `/clear` | After each task completes |
| `/compact` | Mid-task if context large |

Always re-read plan file after clearing to restore state.

---

## QA Principles

1. **Verify after every task** - Never skip the Verify section
2. **Test before marking complete** - Don't assume it works
3. **Build must pass** - Run `npm run build` before final completion
4. **Manual test when applicable** - Actually use the feature
