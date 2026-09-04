-- ============================================
-- Migration 068: RLS performance and catalog cleanup (Phase 2, Task 24)
--
-- Closes audit findings D7 and D8 (live performance advisor, 2026-09-01,
-- re-read 2026-09-04: 85 auth_rls_initplan, 96 multiple_permissive_policies).
--
--   1. Every policy that called auth.uid() directly now calls
--      (select auth.uid()), so Postgres evaluates it once per statement as an
--      InitPlan instead of once per row. Section 1 was generated from
--      pg_policies: same names, roles, commands and expressions.
--   2. Where a table had several permissive policies for one command they are
--      merged into one OR-ed policy (permissive policies are OR-ed anyway, so
--      the row set is identical); the admin clause is always the last branch.
--      The two FOR ALL policies (places, social_links) that overlapped a public
--      SELECT are split into per-command policies instead.
--   3. search_path pinned on the four SECURITY INVOKER functions the advisor
--      still flagged; pg_trgm moved out of public (the GIN opclass indexes on
--      profiles reference it by OID and survive the move; every API role has
--      `extensions` on its search_path; nothing in the app calls similarity()).
--   4. books_external_id_dedupe_backup dropped (35 rows: 10 isbn,
--      10 google_books_id, 15 open_library_id — the pre-image of the 059
--      dedupe, which has been settled since Aug 2026) and five redundant
--      indexes dropped: 006's non-unique partials on isbn / google_books_id /
--      open_library_id (059's partial UNIQUE indexes cover the same lookups),
--      user_books_user_book_idx (duplicate of the UNIQUE (user_id, book_id)
--      constraint index) and idx_activity_feed_user_id (leading column of
--      activity_feed_user_created_at_idx).
--
-- Not touched: the 55 unused_index entries (mostly 061's, too young to judge).
--
-- Idempotent: every DROP is IF EXISTS and every policy is dropped before it is
-- created, so the file can be re-run.
-- ============================================

-- ------------------------------------------------------------
-- 1. auth.uid() -> (select auth.uid()) in every remaining policy
--    (generated from pg_policies on 2026-09-04; names, roles,
--    commands and expressions are otherwise verbatim)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert admin role changes" ON public.admin_role_changes;
CREATE POLICY "Admins can insert admin role changes" ON public.admin_role_changes
  FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Admins can view admin role changes" ON public.admin_role_changes;
CREATE POLICY "Admins can view admin role changes" ON public.admin_role_changes
  FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Members can view club memberships" ON public.book_club_members;
CREATE POLICY "Members can view club memberships" ON public.book_club_members
  FOR SELECT TO public
  USING (((user_id = (select auth.uid())) OR (get_club_visibility(club_id) = 'public'::text) OR is_club_member(club_id)));

DROP POLICY IF EXISTS "Admins can delete club reads" ON public.book_club_reads;
CREATE POLICY "Admins can delete club reads" ON public.book_club_reads
  FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM book_club_members
  WHERE ((book_club_members.club_id = book_club_reads.club_id) AND (book_club_members.user_id = (select auth.uid())) AND (book_club_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admins can manage club reads" ON public.book_club_reads;
CREATE POLICY "Admins can manage club reads" ON public.book_club_reads
  FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM book_club_members
  WHERE ((book_club_members.club_id = book_club_reads.club_id) AND (book_club_members.user_id = (select auth.uid())) AND (book_club_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Anyone can view reads for visible clubs" ON public.book_club_reads;
CREATE POLICY "Anyone can view reads for visible clubs" ON public.book_club_reads
  FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM book_clubs
  WHERE ((book_clubs.id = book_club_reads.club_id) AND ((book_clubs.visibility = 'public'::text) OR (EXISTS ( SELECT 1
           FROM book_club_members bcm
          WHERE ((bcm.club_id = book_clubs.id) AND (bcm.user_id = (select auth.uid()))))))))));

DROP POLICY IF EXISTS "Admins can update club reads" ON public.book_club_reads;
CREATE POLICY "Admins can update club reads" ON public.book_club_reads
  FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM book_club_members
  WHERE ((book_club_members.club_id = book_club_reads.club_id) AND (book_club_members.user_id = (select auth.uid())) AND (book_club_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Club admins can delete their clubs" ON public.book_clubs;
CREATE POLICY "Club admins can delete their clubs" ON public.book_clubs
  FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM book_club_members
  WHERE ((book_club_members.club_id = book_clubs.id) AND (book_club_members.user_id = (select auth.uid())) AND (book_club_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Authenticated users can create book clubs" ON public.book_clubs;
CREATE POLICY "Authenticated users can create book clubs" ON public.book_clubs
  FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (created_by = (select auth.uid()))));

DROP POLICY IF EXISTS "Anyone can view public book clubs" ON public.book_clubs;
CREATE POLICY "Anyone can view public book clubs" ON public.book_clubs
  FOR SELECT TO public
  USING (((visibility = 'public'::text) OR (created_by = (select auth.uid())) OR is_club_member(id)));

DROP POLICY IF EXISTS "Club admins can update their clubs" ON public.book_clubs;
CREATE POLICY "Club admins can update their clubs" ON public.book_clubs
  FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM book_club_members
  WHERE ((book_club_members.club_id = book_clubs.id) AND (book_club_members.user_id = (select auth.uid())) AND (book_club_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Authenticated users can submit books" ON public.book_submissions;
CREATE POLICY "Authenticated users can submit books" ON public.book_submissions
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = submitted_by));

DROP POLICY IF EXISTS "Admins can insert books" ON public.books;
CREATE POLICY "Admins can insert books" ON public.books
  FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
CREATE POLICY "Users can insert their own comments" ON public.comments
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete own messages" ON public.direct_messages;
CREATE POLICY "Users can delete own messages" ON public.direct_messages
  FOR DELETE TO public
  USING (((select auth.uid()) = sender_id));

DROP POLICY IF EXISTS "Users can send messages to friends" ON public.direct_messages;
CREATE POLICY "Users can send messages to friends" ON public.direct_messages
  FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) = sender_id) AND are_friends((select auth.uid()), receiver_id)));

DROP POLICY IF EXISTS "Users can view own messages" ON public.direct_messages;
CREATE POLICY "Users can view own messages" ON public.direct_messages
  FOR SELECT TO public
  USING ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE TO public
  USING (((select auth.uid()) = follower_id));

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = follower_id));

DROP POLICY IF EXISTS "Users can delete own friend requests" ON public.friend_requests;
CREATE POLICY "Users can delete own friend requests" ON public.friend_requests
  FOR DELETE TO public
  USING (((((select auth.uid()) = sender_id) AND ((status)::text = 'pending'::text)) OR ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)) AND ((status)::text = 'accepted'::text))));

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = sender_id));

DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
CREATE POLICY "Users can view own friend requests" ON public.friend_requests
  FOR SELECT TO public
  USING ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can delete own check-ins" ON public.place_checkins;
CREATE POLICY "Users can delete own check-ins" ON public.place_checkins
  FOR DELETE TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create check-ins" ON public.place_checkins;
CREATE POLICY "Authenticated users can create check-ins" ON public.place_checkins
  FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (user_id = (select auth.uid()))));

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON public.place_photos;
CREATE POLICY "Authenticated users can upload photos" ON public.place_photos
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.place_reviews;
CREATE POLICY "Users can delete own reviews" ON public.place_reviews
  FOR DELETE TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.place_reviews;
CREATE POLICY "Authenticated users can create reviews" ON public.place_reviews
  FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (user_id = (select auth.uid()))));

DROP POLICY IF EXISTS "Users can update own reviews" ON public.place_reviews;
CREATE POLICY "Users can update own reviews" ON public.place_reviews
  FOR UPDATE TO public
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can submit places" ON public.place_submissions;
CREATE POLICY "Authenticated users can submit places" ON public.place_submissions
  FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (submitted_by = (select auth.uid()))));

DROP POLICY IF EXISTS "Admins can moderate submissions" ON public.place_submissions;
CREATE POLICY "Admins can moderate submissions" ON public.place_submissions
  FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = id));

DROP POLICY IF EXISTS "Users can delete their own challenges" ON public.reading_challenges;
CREATE POLICY "Users can delete their own challenges" ON public.reading_challenges
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create their own challenges" ON public.reading_challenges;
CREATE POLICY "Users can create their own challenges" ON public.reading_challenges
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own challenges" ON public.reading_challenges;
CREATE POLICY "Users can view their own challenges" ON public.reading_challenges
  FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own challenges" ON public.reading_challenges;
CREATE POLICY "Users can update their own challenges" ON public.reading_challenges
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create their own goals" ON public.reading_goals;
CREATE POLICY "Users can create their own goals" ON public.reading_goals
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own goals" ON public.reading_goals;
CREATE POLICY "Users can view their own goals" ON public.reading_goals
  FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own goals" ON public.reading_goals;
CREATE POLICY "Users can update their own goals" ON public.reading_goals
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Owners can remove books from their lists" ON public.reading_list_books;
CREATE POLICY "Owners can remove books from their lists" ON public.reading_list_books
  FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM reading_lists
  WHERE ((reading_lists.id = reading_list_books.list_id) AND (reading_lists.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Owners can add books to their lists" ON public.reading_list_books;
CREATE POLICY "Owners can add books to their lists" ON public.reading_list_books
  FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM reading_lists
  WHERE ((reading_lists.id = reading_list_books.list_id) AND (reading_lists.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Anyone can view books in visible lists" ON public.reading_list_books;
CREATE POLICY "Anyone can view books in visible lists" ON public.reading_list_books
  FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM reading_lists
  WHERE ((reading_lists.id = reading_list_books.list_id) AND ((reading_lists.visibility = 'public'::text) OR (reading_lists.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Owners can update books in their lists" ON public.reading_list_books;
CREATE POLICY "Owners can update books in their lists" ON public.reading_list_books
  FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM reading_lists
  WHERE ((reading_lists.id = reading_list_books.list_id) AND (reading_lists.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can remove their own likes" ON public.reading_list_likes;
CREATE POLICY "Users can remove their own likes" ON public.reading_list_likes
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can like public lists" ON public.reading_list_likes;
CREATE POLICY "Users can like public lists" ON public.reading_list_likes
  FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM reading_lists
  WHERE ((reading_lists.id = reading_list_likes.list_id) AND (reading_lists.visibility = 'public'::text))))));

DROP POLICY IF EXISTS "Anyone can view likes on visible lists" ON public.reading_list_likes;
CREATE POLICY "Anyone can view likes on visible lists" ON public.reading_list_likes
  FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM reading_lists
  WHERE ((reading_lists.id = reading_list_likes.list_id) AND ((reading_lists.visibility = 'public'::text) OR (reading_lists.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Users can delete their own lists" ON public.reading_lists;
CREATE POLICY "Users can delete their own lists" ON public.reading_lists
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create their own lists" ON public.reading_lists;
CREATE POLICY "Users can create their own lists" ON public.reading_lists
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own lists" ON public.reading_lists;
CREATE POLICY "Users can update their own lists" ON public.reading_lists
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.reading_stats;
CREATE POLICY "Users can insert their own stats" ON public.reading_stats
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own stats" ON public.reading_stats;
CREATE POLICY "Users can update their own stats" ON public.reading_stats
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can unlike reviews" ON public.review_likes;
CREATE POLICY "Users can unlike reviews" ON public.review_likes
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can like reviews" ON public.review_likes;
CREATE POLICY "Users can like reviews" ON public.review_likes
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
CREATE POLICY "Users can insert their own reviews" ON public.reviews
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews" ON public.reviews
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can remove from own shelves" ON public.shelf_books;
CREATE POLICY "Users can remove from own shelves" ON public.shelf_books
  FOR DELETE TO public
  USING ((shelf_id IN ( SELECT user_shelves.id
   FROM user_shelves
  WHERE (user_shelves.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can add to own shelves" ON public.shelf_books;
CREATE POLICY "Users can add to own shelves" ON public.shelf_books
  FOR INSERT TO public
  WITH CHECK ((shelf_id IN ( SELECT user_shelves.id
   FROM user_shelves
  WHERE (user_shelves.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can update own shelf books" ON public.shelf_books;
CREATE POLICY "Users can update own shelf books" ON public.shelf_books
  FOR UPDATE TO public
  USING ((shelf_id IN ( SELECT user_shelves.id
   FROM user_shelves
  WHERE (user_shelves.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can remove their badges" ON public.user_badges;
CREATE POLICY "Users can remove their badges" ON public.user_badges
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete their own books" ON public.user_books;
CREATE POLICY "Users can delete their own books" ON public.user_books
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert their own books" ON public.user_books;
CREATE POLICY "Users can insert their own books" ON public.user_books
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own books" ON public.user_books;
CREATE POLICY "Users can update their own books" ON public.user_books
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete own shelves" ON public.user_shelves;
CREATE POLICY "Users can delete own shelves" ON public.user_shelves
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create own shelves" ON public.user_shelves;
CREATE POLICY "Users can create own shelves" ON public.user_shelves
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update own shelves" ON public.user_shelves;
CREATE POLICY "Users can update own shelves" ON public.user_shelves
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete their own taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can delete their own taste profile" ON public.user_taste_profiles
  FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create their own taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can create their own taste profile" ON public.user_taste_profiles
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can view their own taste profile" ON public.user_taste_profiles
  FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own taste profile" ON public.user_taste_profiles;
CREATE POLICY "Users can update their own taste profile" ON public.user_taste_profiles
  FOR UPDATE TO public
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- ------------------------------------------------------------
-- 2. One permissive policy per table and command
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can remove members" ON public.book_club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON public.book_club_members;
CREATE POLICY "Members can leave clubs and admins can remove members" ON public.book_club_members
  FOR DELETE TO public
  USING ((select auth.uid()) = user_id OR public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Club creators can add themselves as admin" ON public.book_club_members;
DROP POLICY IF EXISTS "Users can join public clubs" ON public.book_club_members;
CREATE POLICY "Users can join public clubs or create their own club as admin" ON public.book_club_members
  FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id AND (
    EXISTS (SELECT 1 FROM public.book_clubs WHERE book_clubs.id = book_club_members.club_id AND book_clubs.visibility = 'public')
    OR (role = 'admin' AND EXISTS (SELECT 1 FROM public.book_clubs WHERE book_clubs.id = book_club_members.club_id AND book_clubs.created_by = (select auth.uid())))
  ));

DROP POLICY IF EXISTS "Admins can view all book submissions" ON public.book_submissions;
DROP POLICY IF EXISTS "Anyone can view approved submissions" ON public.book_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.book_submissions;
CREATE POLICY "Submissions visible when approved, to the submitter, or to admins" ON public.book_submissions
  FOR SELECT TO public
  USING (status = 'approved' OR (select auth.uid()) = submitted_by OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can moderate book submissions" ON public.book_submissions;
DROP POLICY IF EXISTS "Users can update their pending submissions" ON public.book_submissions;
CREATE POLICY "Submitters can update pending submissions and admins can moderate" ON public.book_submissions
  FOR UPDATE TO public
  USING (((select auth.uid()) = submitted_by AND status = 'pending') OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true))
  WITH CHECK (((select auth.uid()) = submitted_by AND status = 'pending') OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can delete comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Authors and admins can delete comments" ON public.comments
  FOR DELETE TO public
  USING ((select auth.uid()) = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can delete place photos" ON public.place_photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.place_photos;
CREATE POLICY "Uploaders and admins can delete place photos" ON public.place_photos
  FOR DELETE TO public
  USING ((select auth.uid()) = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Approved photos are viewable by everyone" ON public.place_photos;
DROP POLICY IF EXISTS "Users can view their own photos" ON public.place_photos;
CREATE POLICY "Approved photos are viewable by everyone and own photos by the uploader" ON public.place_photos
  FOR SELECT TO public
  USING (is_approved = true OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all submissions" ON public.place_submissions;
DROP POLICY IF EXISTS "Users can view own submissions" ON public.place_submissions;
CREATE POLICY "Submitters see their own place submissions and admins see all" ON public.place_submissions
  FOR SELECT TO public
  USING ((select auth.uid()) = submitted_by OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can manage places" ON public.places;
DROP POLICY IF EXISTS "Anyone can read places" ON public.places;
CREATE POLICY "Anyone can read places" ON public.places
  FOR SELECT TO public
  USING (true);
CREATE POLICY "Admins can insert places" ON public.places
  FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));
CREATE POLICY "Admins can update places" ON public.places
  FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));
CREATE POLICY "Admins can delete places" ON public.places
  FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can view all reading stats" ON public.reading_stats;
DROP POLICY IF EXISTS "Reading stats are viewable by owner or when discoverable" ON public.reading_stats;
DROP POLICY IF EXISTS "Users can view their own stats" ON public.reading_stats;
CREATE POLICY "Reading stats are viewable by owner, when discoverable, or by admins" ON public.reading_stats
  FOR SELECT TO public
  USING ((select auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reading_stats.user_id AND COALESCE(p.discovery_visible, true))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Reporters see their own reports and admins see all" ON public.reports
  FOR SELECT TO public
  USING ((select auth.uid()) = reporter_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Authors and admins can delete reviews" ON public.reviews
  FOR DELETE TO public
  USING ((select auth.uid()) = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Public shelf books are viewable" ON public.shelf_books;
DROP POLICY IF EXISTS "Users can view own shelf books" ON public.shelf_books;
CREATE POLICY "Shelf books are viewable on public shelves and own shelves" ON public.shelf_books
  FOR SELECT TO public
  USING (shelf_id IN (SELECT user_shelves.id FROM public.user_shelves WHERE user_shelves.is_public = true OR user_shelves.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can manage their own social links" ON public.social_links;
DROP POLICY IF EXISTS "Social links are viewable by everyone" ON public.social_links;
CREATE POLICY "Social links are viewable by everyone" ON public.social_links
  FOR SELECT TO public
  USING (true);
CREATE POLICY "Users can insert their own social links" ON public.social_links
  FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own social links" ON public.social_links
  FOR UPDATE TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own social links" ON public.social_links
  FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all user books" ON public.user_books;
DROP POLICY IF EXISTS "Shelves are viewable by owner or when discoverable" ON public.user_books;
CREATE POLICY "Shelves are viewable by owner, when discoverable, or by admins" ON public.user_books
  FOR SELECT TO public
  USING ((select auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_books.user_id AND COALESCE(p.discovery_visible, true))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_admin = true));

DROP POLICY IF EXISTS "Public shelves are viewable" ON public.user_shelves;
DROP POLICY IF EXISTS "Users can view own shelves" ON public.user_shelves;
CREATE POLICY "Shelves are viewable when public or by their owner" ON public.user_shelves
  FOR SELECT TO public
  USING (is_public = true OR (select auth.uid()) = user_id);
-- ------------------------------------------------------------
-- 3. Function search_path and extension schema
-- ------------------------------------------------------------

ALTER FUNCTION public.generate_list_slug(list_title text, owner_id uuid) SET search_path = public;
ALTER FUNCTION public.get_distinct_genres() SET search_path = public;
ALTER FUNCTION public.update_club_timestamp() SET search_path = public;
ALTER FUNCTION public.update_list_timestamp() SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Catalog cleanup
-- ------------------------------------------------------------

DROP TABLE IF EXISTS public.books_external_id_dedupe_backup;

DROP INDEX IF EXISTS public.books_isbn_idx;
DROP INDEX IF EXISTS public.books_google_books_id_idx;
DROP INDEX IF EXISTS public.books_open_library_id_idx;
DROP INDEX IF EXISTS public.user_books_user_book_idx;
DROP INDEX IF EXISTS public.idx_activity_feed_user_id;
