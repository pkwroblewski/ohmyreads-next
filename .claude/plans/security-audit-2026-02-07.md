# OhMyReads - Pre-Launch IT Security Audit & Remediation Plan

> **Execution:** Orchestrator (Opus 4.6) + Sub-agents (Sonnet 4.5) in parallel waves

---

## Status

| # | Task | Priority | Effort | Status | Files | Wave |
|---|------|----------|--------|--------|-------|------|
| 1+10 | Fix profiles RLS + admin_role_changes policy | 🔴 Critical | Low | [x] COMPLETE | `supabase/migrations/043_security_hardening.sql` | 1 |
| 2 | Fix cron endpoint auth bypass | 🔴 Critical | Low | [x] COMPLETE | `app/api/cron/weekly-digest/route.ts` | 1 |
| 3 | Wire up middleware (proxy.ts is dead code) | 🔴 Critical | Medium | [x] COMPLETE (N/A) | N/A | 1 |
| 4 | Add auth to AI API routes | 🟠 High | Low | [x] COMPLETE | `app/api/ai/*/route.ts` | 2 |
| 5 | Sanitize PostgREST filter inputs | 🟠 High | Low | [x] COMPLETE | `app/api/books/search/route.ts`, `lib/actions/admin-users.ts`, `lib/utils/sanitize.ts` | 2 |
| 6+7 | Sanitize errors + add rate limiting | 🟠 High | Medium | [x] COMPLETE | `lib/actions/messages.ts`, `app/api/geo/ip-location/route.ts` | 2 |
| 8 | Remove/disable debug endpoint | 🟠 High | Low | [x] COMPLETE | `app/api/geo/readers/debug/route.ts` | 2 |
| 9 | Add HSTS and tighten CSP headers | 🟡 Medium | Low | [x] COMPLETE | `next.config.ts` | 3 |
| 11 | Redact PII from production logs | 🟡 Medium | Medium | [x] COMPLETE | `app/api/cron/weekly-digest/route.ts` | 3 |
| 12 | Add CSRF Origin validation to API routes | 🟡 Medium | Medium | [x] COMPLETE | `lib/utils/csrf.ts`, 4 route files | 3 |
| 13 | Tighten Sentry config for production | 🟢 Low | Low | [x] COMPLETE | `sentry.client.config.ts` | 3 |
| 14 | Final QA & Build Verification | - | Low | [x] COMPLETE | - | 4 |

**Progress: 12/12 tasks complete**

---

## Summary

Pre-launch security audit addressing: RLS privilege escalation, cron auth bypass, API auth gaps, input sanitization, error disclosure, rate limiting, CSP hardening, PII redaction, CSRF protection, and Sentry config.

---

## Final QA Checklist

- [x] All migration files apply without errors
- [x] No broken imports or references
- [x] Build passes (`npm run build`)
- [x] Lint passes (3 pre-existing React Compiler errors, 80 pre-existing warnings — no new issues)
- [x] Tests pass (`npm run test:run` — 42 tests, 2 files, all pass)
- [x] Supabase security advisors checked (pre-existing WARN: mutable search_path on 17 functions, extension in public)
- [x] Security fixes verified

---

## Out of Scope (Deferred)

| Item | Reason | Revisit |
|------|--------|---------|
| CSP nonce for scripts (remove unsafe-inline) | Requires Next.js nonce middleware setup, complex | Post-launch |
| Dependency vulnerability scan (npm audit) | Should be part of CI/CD, not this audit | CI/CD setup |
| Supabase Storage bucket policies audit | Requires Supabase dashboard access | Pre-launch checklist |
| Mapbox token URL restrictions | Configured in Mapbox dashboard, not code | Pre-launch checklist |
| Supabase Realtime channel authorization | Needs review of Realtime policies | Post-launch |
| Full RLS audit of all 42 migrations | Comprehensive but time-intensive | Separate audit |
| Seed endpoint removal from production | Low risk (NODE_ENV gated), but unnecessary code | Post-launch cleanup |
| Function search_path hardening (17 functions) | Pre-existing, not introduced by this audit | Separate migration |

---

## Changelog

| Date | Task # | Status | Notes |
|------|--------|--------|-------|
| 2026-02-07 | 1+10 | COMPLETE | BEFORE UPDATE trigger protects admin columns + admin_role_changes INSERT restricted to admins. Fixed `current_role` reserved word. Added `SET search_path = public`. |
| 2026-02-07 | 2 | COMPLETE | Cron auth fails closed: 503 if CRON_SECRET not set, 401 if wrong |
| 2026-02-07 | 3 | COMPLETE (N/A) | proxy.ts IS active middleware in Next.js 16 — not dead code. No changes needed. |
| 2026-02-07 | 4 | COMPLETE | Auth added to book-search, trending-insights, place-search. Rate limit keys switched to user.id. Fixed duplicate `supabase` variable in trending-insights. |
| 2026-02-07 | 5 | COMPLETE | Created `sanitizePostgrestValue()` in `lib/utils/sanitize.ts`. Applied to books/search and admin-users `.or()` calls. |
| 2026-02-07 | 6+7 | COMPLETE | Replaced raw `error.message` with generic messages in messages.ts (3 locations). Added rate limiting to ip-location (10 req/min/IP). |
| 2026-02-07 | 8 | COMPLETE | Added `NODE_ENV === 'production'` guard returning 404 at top of debug endpoint. |
| 2026-02-07 | 9 | COMPLETE | Added HSTS header. Tightened CSP img-src to specific domains. |
| 2026-02-07 | 11 | COMPLETE | Removed email from weekly digest log line 210. |
| 2026-02-07 | 12 | COMPLETE | Created `lib/utils/csrf.ts` with origin validation. Applied to 4 routes (6 handlers): book-search, place-search, place reviews, place photos. |
| 2026-02-07 | 13 | COMPLETE | tracesSampleRate: 1 → 0.1, replaysSessionSampleRate: 0.1 → 0.01 |
| 2026-02-07 | 14 | COMPLETE | Build passes, lint clean (pre-existing only), 42/42 tests pass, Supabase advisors checked. |
