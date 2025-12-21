-- ============================================
-- 015: Fix activity_feed FK to profiles
-- ============================================
-- Add explicit FK from activity_feed.user_id to profiles.id
-- so PostgREST can join activity_feed with profiles

-- Add FK constraint (profiles.id = auth.users.id, so this works)
ALTER TABLE public.activity_feed
DROP CONSTRAINT IF EXISTS activity_feed_user_id_profiles_fkey;

ALTER TABLE public.activity_feed
ADD CONSTRAINT activity_feed_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK constraint for checkin_id to place_checkins
ALTER TABLE public.activity_feed
DROP CONSTRAINT IF EXISTS activity_feed_checkin_id_fkey;

ALTER TABLE public.activity_feed
ADD CONSTRAINT activity_feed_checkin_id_fkey
FOREIGN KEY (checkin_id) REFERENCES public.place_checkins(id) ON DELETE CASCADE;
