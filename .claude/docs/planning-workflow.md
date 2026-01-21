# Planning Workflow

Use this for tasks requiring 3+ steps or multi-file changes. This document defines the process; see [example-plan.md](./example-plan.md) for the exact template format.

---

## When to Create a Plan

**Always create a plan when:**
- Task has 3+ steps
- Task touches multiple files
- Task comes from an audit or review
- Task involves investigation before implementation
- You're unsure of the scope

**Never skip planning by rationalizing** "it's small enough."

---

## Plan File Location

Create plans in: `.claude/plans/{descriptive-name}.md`

Examples:
- `.claude/plans/social-features-critical-fixes.md`
- `.claude/plans/reader-map-ux-improvements.md`
- `.claude/plans/dark-mode-toggle.md`

---

## Plan Structure (Required Elements)

Every plan must include these sections in this order:

### 1. Title & Workflow Instructions
```markdown
# [Project] - [Task Name]

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
```

### 2. Status Table

**Must have these exact columns:**
```markdown
## Status

| # | Task | Priority | Effort | Status | Files |
|---|------|----------|--------|--------|-------|
| 0 | Codebase discovery | - | Low | [ ] Pending | - |
| 1 | Task description | 🔴 Critical | Medium | [ ] Pending | `file.ts` |
| 2 | Task description | 🟠 High | Low | [ ] Pending | `other.ts` |
| N | Final QA | - | Low | [ ] Pending | - |

**Progress: 0/N complete**
```

**Priority values:** 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low  
**Effort values:** Low, Medium, High

### 3. Summary
```markdown
## Summary

One paragraph explaining: what's the problem, what's the approach, and what's the expected outcome.
```

### 4. Task Sections

**Each task must have this structure:**
```markdown
## Task N: Title

**Source:** [User Request / Audit Finding > Specific finding / Bug Report #123]  
**Priority:** 🔴 Critical  
**Effort:** Medium  
**File(s):** `path/to/file.ts`

**Context:** Why this task exists. What problem it solves. Any relevant background.

**Steps:**
1. [ ] Specific action one
2. [ ] Specific action two
3. [ ] Specific action three

**Verify:**
- [ ] Specific testable check
- [ ] Another testable check
- [ ] Build passes if applicable

**Completed Notes:**
<!-- Fill in after completing -->
- Files modified: 
- Approach taken: 
- Deviations from plan: 
- Issues encountered: 

**Status:** one of:
- `[ ] PENDING` - not started
- `[x] COMPLETE` - all steps and verify checks done
- `[x] CODE COMPLETE - Verification blocked` - code done, verify requires deployment/action
- `[-] BLOCKED` - cannot proceed, waiting on external dependency
```

### 5. Out of Scope Section
```markdown
## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| Feature X | Too large, needs own plan | Next sprint |
| Enhancement Y | Nice-to-have, not critical | v2.0 |
```

### 6. Final QA Checklist
```markdown
## Final QA Checklist

- [ ] All files created/modified exist
- [ ] No broken imports or references
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature works as expected (manual test)
- [ ] No console errors
```

### 7. Changelog
```markdown
## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| | | | |
```

---

## Execution Protocol

### Per-Task Cycle
```
┌─────────────────────────────────────────────────────────┐
│  1. READ plan file, find first PENDING task             │
│  2. EXECUTE all Steps (check off as you go)             │
│  3. VERIFY all checks pass                              │
│  4. FILL IN Completed Notes section                     │
│  5. UPDATE status to [x] COMPLETE                       │
│  6. UPDATE progress counter                             │
│  7. UPDATE Changelog table                              │
│  8. STOP - ask user to /clear                           │
│  9. After clear, re-read plan → repeat                  │
└─────────────────────────────────────────────────────────┘
```

### Quality Gates

Each task must pass verification before marking complete:
- If verification fails → fix before moving on
- If blocked → document blocker in Completed Notes, ask user
- Never mark COMPLETE without filling Completed Notes

### Context Management

| Command | When to use |
|---------|-------------|
| `/clear` | After each task completes |
| `/compact` | Mid-task if context getting large |

**Always re-read plan file after clearing** - this restores your state.

---

## Execution Responsibility

### My Responsibility (Claude)

- Execute all tasks using available tools: Bash, CLI, MCP plugins, agents
- Verify completion myself when possible
- Document what was actually done in Completed Notes
- Only mark tasks "for user" when I genuinely cannot execute

### Available Tools (Use These Before Asking User)

| Task Type | Tool to Use |
|-----------|-------------|
| Database operations | `supabase` CLI or `npx supabase` |
| File operations | Read/Write/Edit tools |
| Git operations | Bash |
| API calls | WebFetch or Node scripts |
| Browser testing | Playwright MCP tools |
| Package install | `npm install` via Bash |

### User Action Required Format

When user action is truly required, use this format:
```markdown
⚠️ USER ACTION REQUIRED

**Task:** [What needs to be done]
**How:** 
1. [Step-by-step instructions]
2. [Be specific]
**Why I cannot:** [Specific limitation - e.g., "requires GUI", "needs credentials I don't have"]
**Verify:** [How user confirms completion]
**Then:** [What happens next - e.g., "Tell me when done and I'll continue"]
```

---

## Common Violations (Avoid These)

| ❌ Wrong | ✅ Right |
|----------|----------|
| Using user-provided doc as the plan | Convert any input to exact template format |
| Status table with different columns | Always: `# \| Task \| Priority \| Effort \| Status \| Files` |
| Executing multiple tasks without `/clear` | One task → clear → next task |
| Task sections without Completed Notes | Every task has Completed Notes section |
| Marking COMPLETE without filling Completed Notes | Always document what was done |
| Marking COMPLETE with unchecked Verify items | Stop and ask if verification is blocked |
| Skipping Out of Scope section | Explicitly list what's deferred |
| No Changelog | Always include and update Changelog |
| Assuming file paths | Discover paths in Task 0 |

---

## Pre-Execution Checklist

Before starting any plan, verify:

**Plan Structure:**
- [ ] Workflow instructions at top (9 steps)
- [ ] Status table has correct columns: `# | Task | Priority | Effort | Status | Files`
- [ ] Progress counter present
- [ ] Summary section exists

**Each Task Has:**
- [ ] Source (where task came from)
- [ ] Priority (🔴/🟠/🟡/🟢)
- [ ] Effort (Low/Medium/High)
- [ ] File(s) to modify
- [ ] Context (why this task exists)
- [ ] Steps (checkboxes)
- [ ] Verify (checkboxes)
- [ ] Completed Notes (blank section)
- [ ] Status

**Plan Includes:**
- [ ] Task 0 for discovery (if exploring unfamiliar code)
- [ ] Out of Scope table
- [ ] Final QA Checklist
- [ ] Changelog table

---

## Converting External Input to Plans

When receiving audit reports, user requests, or bug reports:

1. **Read the input thoroughly**
2. **Extract actionable items** - what specifically needs to change?
3. **Group into logical tasks** - one issue may need multiple tasks
4. **Prioritize** - Critical bugs first, enhancements last
5. **Create plan using exact template** - don't use the input document as-is
6. **Add discovery task** if codebase is unfamiliar
7. **Define Out of Scope** - what's NOT being done in this plan

---

## QA Principles

1. **Verify after every task** - Never skip the Verify section
2. **Test before marking complete** - Don't assume it works
3. **Build must pass** - Run `npm run build` before final completion
4. **Manual test when applicable** - Actually use the feature
5. **Document everything** - Completed Notes are not optional

---

→ **Full working example:** [example-plan.md](./example-plan.md)