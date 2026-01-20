-- Fix reading_stats RLS to allow INSERT operations
-- The existing FOR ALL policy only has USING clause (for SELECT)
-- We need WITH CHECK clause for INSERT/UPDATE validation

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update their own stats" ON public.reading_stats;

-- Create explicit policies with proper clauses
CREATE POLICY "Users can insert their own stats" ON public.reading_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" ON public.reading_stats
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stats" ON public.reading_stats
  FOR DELETE USING (auth.uid() = user_id);
