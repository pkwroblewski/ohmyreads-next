# Development Workflow

## Process

1. **Think through the problem** - Read the codebase for relevant files
2. **Write a plan** - Create detailed plan file (see Plan File Structure below)
3. **Check in** - Verify the plan with the user before starting
4. **Execute** - Work through tasks one at a time, following Execution Protocol
5. **Communicate** - Provide high-level explanations of changes at each step
6. **Review** - Update `tasks/todo.md` when complete

---

## Plan File Structure

Plans are stored in `.claude/plans/` and follow this structure:

```markdown
# Project Name - Task Name

> **When starting work:** Read this file first, check Status Tracking, find next PENDING task.
> **After each task:** Update status to COMPLETE, update progress counter, ask user to `/clear` context.

---

## Status Tracking

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Task description | [ ] Pending | file.ts |
| 2 | Another task | [ ] Pending | other.ts |

**Progress: 0/X tasks complete**

---

## Problem Summary
Brief description of the issue and root cause.

---

## Task N: Task Title

### Objective
What this task accomplishes.

### File
`path/to/file.ts`

### Steps
1. [ ] Step one
2. [ ] Step two

### Code
```typescript
// Code snippet for the change
```

### Success Criteria
- [ ] Criterion one
- [ ] Criterion two

### Status: [ ] PENDING

---

## Final Verification Checklist
- [ ] Build passes
- [ ] Feature works as expected
```

---

## Execution Protocol

### After EACH Task Completion:
1. **Update status** - Mark task `[x] COMPLETE` in plan file
2. **Update progress counter** - Increment "X/Y tasks complete"
3. **Request context clear** - Ask user to run `/clear` to reset context
4. **Re-read plan** - Start next task by reading the plan file fresh
5. **Check status table** - Find next PENDING task

### Task Workflow:
```
1. Read plan → Find next PENDING task
2. Execute task steps
3. Verify success criteria
4. Update plan file (mark complete)
5. Ask user to /clear context
6. Read plan again → Repeat
```

### Context Management:
- Use `/clear` between tasks to prevent context exhaustion
- Use `/compact` if context gets large mid-task
- Re-read plan file after each clear to maintain state

---

## Core Principles

### Simplicity Above All
- Make every task and code change as simple as possible
- Avoid massive or complex changes
- Every change should impact as little code as possible
- Only modify code that is directly relevant to the task

### No Laziness
- Find the root cause of bugs and fix them properly
- No temporary fixes or workarounds
- You are a senior developer - act like one

### Goal
- Do not introduce any bugs
- Keep changes minimal and focused
- **SIMPLICITY**
