# OhMyReads - Dashboard Stats Fix (COMPLETED)

> **Status: RESOLVED** - January 20, 2026

---

## Status Tracking

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Update updateReadingStats to count reviews | [x] Complete | lib/actions/books.ts |
| 2 | Export updateReadingStats function | [x] Complete | lib/actions/books.ts |
| 3 | Import helper in reviews.ts | [x] Complete | lib/actions/reviews.ts |
| 4 | Call stats update after createReview | [x] Complete | lib/actions/reviews.ts |
| 5 | Call stats update after deleteReview | [x] Complete | lib/actions/reviews.ts |
| 6 | Build and deploy (initial) | [x] Complete | - |
| 6b | Initialize stats on dashboard load | [x] Complete | app/(app)/dashboard/page.tsx |
| 7 | Fix RLS policies for reading_stats | [x] Complete | supabase/migrations/030_fix_reading_stats_rls.sql |
| 8 | User verification test | [x] Complete | Manual test |

**Progress: 8/8 tasks complete**

---

## Problem Summary

Dashboard showed 0 for all stats (Books Read, Pages Read, Reviews Written) even though user had data.

### Root Causes Identified

1. **RLS Policy Gap**: The `reading_stats` table had a `FOR ALL` policy with only `USING` clause, missing `WITH CHECK` for INSERT operations. This caused silent failures when trying to insert new stats rows.

2. **Stats not recalculated**: The `updateReadingStats` function only runs on user actions (add/remove book, create/delete review), not on dashboard load for existing stats rows.

---

## Solution Applied

### 1. Fixed RLS Policies (Migration 030)
```sql
-- Separate policies with proper clauses
CREATE POLICY "Users can view their own stats" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own stats" FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stats" FOR UPDATE USING (...) WITH CHECK (...);
CREATE POLICY "Users can delete their own stats" FOR DELETE USING (auth.uid() = user_id);
```

### 2. Added Error Handling
Added error logging to `updateReadingStats()` to surface any future failures.

### 3. Dashboard Initialization
Dashboard now calls `updateReadingStats()` if no stats row exists for the user.

---

## Lessons Learned / Troubleshooting Guide

### When Dashboard Stats Show 0:

1. **Check if reading_stats row exists**
   ```sql
   SELECT * FROM reading_stats WHERE user_id = '<user-id>';
   ```

2. **Check if user has actual data**
   ```sql
   SELECT * FROM user_books WHERE user_id = '<user-id>' AND status = 'read';
   SELECT * FROM reviews WHERE user_id = '<user-id>';
   ```

3. **If row exists but values are 0**: The stats weren't updated when actions occurred
   - User needs to trigger an action (change book status, etc.) to recalculate
   - Or manually update via SQL

4. **If row doesn't exist**: Check RLS policies
   ```sql
   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'reading_stats';
   ```
   - Must have INSERT policy with `WITH CHECK` clause
   - Must have SELECT policy with `USING` clause

5. **Check Vercel logs** for errors containing:
   - `Error updating reading_stats`
   - `Error fetching read books`
   - `Error fetching reviews count`

### RLS Policy Requirements for reading_stats:
- SELECT: `USING (auth.uid() = user_id)`
- INSERT: `WITH CHECK (auth.uid() = user_id)`
- UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- DELETE: `USING (auth.uid() = user_id)`

---

## Commits

- `766d52e` - fix: Update reading_stats when book status changes
- `29b070f` - fix: Update reading_stats with reviews_count on all stat changes
- `ed31109` - fix: Initialize reading_stats on dashboard load if missing
- `96c603d` - fix: Add error handling and RLS policy fix for reading_stats
- `efe7293` - debug: Add detailed logging to updateReadingStats (temporary)

---

## Files Modified

1. `lib/actions/books.ts` - updateReadingStats with error handling
2. `lib/actions/reviews.ts` - Call stats update on review create/delete
3. `app/(app)/dashboard/page.tsx` - Initialize stats on load
4. `supabase/migrations/030_fix_reading_stats_rls.sql` - RLS policy fix
