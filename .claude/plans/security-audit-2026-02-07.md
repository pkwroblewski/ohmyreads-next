# OhMyReads - Pre-Launch IT Security Audit & Remediation Plan

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

> **Execution:** Orchestrator (Opus 4.6) + Sub-agents (Sonnet 4.5) in parallel waves

---

## Status

| # | Task | Priority | Effort | Status | Files | Wave |
|---|------|----------|--------|--------|-------|------|
| 1+10 | Fix profiles RLS + admin_role_changes policy | 🔴 Critical | Low | [ ] PENDING | `supabase/migrations/043_security_hardening.sql` | 1 |
| 2 | Fix cron endpoint auth bypass | 🔴 Critical | Low | [ ] PENDING | `app/api/cron/weekly-digest/route.ts` | 1 |
| 3 | Wire up middleware (proxy.ts is dead code) | 🔴 Critical | Medium | [ ] PENDING | `middleware.ts`, `proxy.ts` | 1 |
| 4 | Add auth to AI API routes | 🟠 High | Low | [ ] PENDING | `app/api/ai/*/route.ts` | 2 |
| 5 | Sanitize PostgREST filter inputs | 🟠 High | Low | [ ] PENDING | `app/api/books/search/route.ts`, `lib/actions/admin-users.ts` | 2 |
| 6+7 | Sanitize errors + add rate limiting | 🟠 High | Medium | [ ] PENDING | `lib/actions/messages.ts`, `app/api/geo/ip-location/route.ts` + others | 2 |
| 8 | Remove/disable debug endpoint | 🟠 High | Low | [ ] PENDING | `app/api/geo/readers/debug/route.ts` | 2 |
| 9 | Add HSTS and tighten CSP headers | 🟡 Medium | Low | [ ] PENDING | `next.config.ts` | 3 |
| 11 | Redact PII from production logs | 🟡 Medium | Medium | [ ] PENDING | `app/api/cron/weekly-digest/route.ts`, `lib/utils/log.ts` | 3 |
| 12 | Add CSRF Origin validation to API routes | 🟡 Medium | Medium | [ ] PENDING | New utility + API routes | 3 |
| 13 | Tighten Sentry config for production | 🟢 Low | Low | [ ] PENDING | `sentry.client.config.ts` | 3 |
| 14 | Final QA & Build Verification | - | Low | [ ] PENDING | - | 4 |

**Progress: 0/12 tasks complete**

---

## Summary

Pre-launch security audit addressing: RLS privilege escalation, dead middleware, cron auth bypass, API auth gaps, input sanitization, error disclosure, rate limiting, CSP hardening, PII redaction, CSRF protection, and Sentry config.

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| | | | |
