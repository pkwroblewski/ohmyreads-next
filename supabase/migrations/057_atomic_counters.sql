-- ============================================
-- Migration 057: Atomic counter maintenance + shelf reconciliation
--
-- Three denormalized values were maintained by the *application* making a
-- second round trip after the write that changed them:
--
--   * books.average_rating / ratings_count  -- reviews.ts called
--     recalculate_book_rating() after every review insert/update/delete
--   * reviews.likes_count                   -- reviews.ts called
--     increment/decrement_review_likes() after inserting/deleting the like,
--     and explicitly accepted drift when that second call failed
--     ("Like was added but count wasn't updated - still consider success")
--   * reading_stats.*                       -- books.ts / reviews.ts called
--     updateReadingStats() after every user_books or reviews write
--
-- If the process died between the two calls, or the second call failed, the
-- counter stayed wrong until some later write happened to fix it. Every other
-- counter in this schema (club members, follows, friends, list likes, place
-- checkins/photos/reviews, unread messages) is already trigger-maintained, so
-- this migration brings the remaining three in line: the counter is now
-- updated in the same transaction as the row that changed it.
--
-- Recompute-from-source is used rather than +1/-1 deltas, and the parent row
-- is locked FOR UPDATE first, so two concurrent likes cannot both read the
-- pre-insert count and write the same stale total.
--
-- Also adds:
--   * set_book_shelves() -- shelf reconciliation in one transaction. The app
--     did DELETE-then-INSERT as two statements, so a failed INSERT left the
--     book removed from shelves it should still be on.
--   * reconcile_counters() -- admin/cron maintenance that recomputes every
--     denormalized counter from its source table and reports what it fixed.
--     The pre-existing delta-based triggers can still drift (e.g.
--     update_friends_count only handles pending -> accepted and DELETE of an
--     accepted row, so an accepted -> rejected UPDATE leaves friends_count
--     inflated), and until now there was no way to repair that.
-- ============================================

-- ============================================
-- 1. books.average_rating / ratings_count -- DELIBERATELY NOT TOUCHED
--
-- These look like a denormalization of public.reviews, but they are not: for
-- most of the catalog they hold *Open Library* ratings written by
-- scripts/import-ratings.ts, and they drive recommendations
-- (`.gte("average_rating", 3.8)`, `.gte("ratings_count", 5)`), search
-- ordering, autocomplete, curated picks and the sitemap.
--
-- The pre-existing recalculate_book_rating() RPC -- which reviews.ts already
-- calls after every review write -- overwrites that external rating with the
-- local review average, so a book's first local review silently replaces
-- thousands of Open Library ratings with one and drops the book out of
-- recommendations. That is a real bug, but it is a *product* question (the
-- column needs splitting into local_* and external_* pairs), not a counter
-- to be made atomic.
--
-- Adding a trigger here would have made that behaviour atomic AND extended it
-- to write paths that never called the RPC (admin review deletion, cascade
-- deletes), clobbering more external ratings than the app does today. So the
-- app keeps calling recalculate_book_rating() explicitly, and atomicity for
-- book ratings is deferred to the column-split task.
-- ============================================

-- ============================================
-- 2. reviews.likes_count  <- review_likes
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_review_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  v_review_id UUID;
BEGIN
  v_review_id := COALESCE(NEW.review_id, OLD.review_id);

  PERFORM 1 FROM public.reviews WHERE id = v_review_id FOR UPDATE;

  UPDATE public.reviews r
  SET likes_count = (
    SELECT COUNT(*) FROM public.review_likes rl WHERE rl.review_id = v_review_id
  )
  WHERE r.id = v_review_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS review_likes_sync_count ON public.review_likes;
CREATE TRIGGER review_likes_sync_count
  AFTER INSERT OR DELETE ON public.review_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_review_likes_count();

-- ============================================
-- 3. reading_stats  <- user_books + reviews
--
-- Statement-level with transition tables: a CSV import inserts user_books in
-- one batch statement, so a row-level trigger would recompute the same
-- aggregate once per imported book (O(n^2)). This recomputes once per
-- distinct user per statement instead.
--
-- current_streak is deliberately not touched -- it is maintained elsewhere,
-- and the application's own upsert never wrote it either.
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_reading_stats(p_user_ids UUID[])
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    CONTINUE WHEN v_user_id IS NULL;

    -- Lock an existing stats row before reading the source tables.
    PERFORM 1 FROM public.reading_stats WHERE user_id = v_user_id FOR UPDATE;

    INSERT INTO public.reading_stats AS rs (
      user_id, books_read, pages_read, reviews_count, updated_at
    )
    SELECT
      v_user_id,
      COUNT(*) FILTER (WHERE ub.status = 'read'),
      COALESCE(SUM(b.page_count) FILTER (WHERE ub.status = 'read'), 0),
      (SELECT COUNT(*) FROM public.reviews r WHERE r.user_id = v_user_id),
      NOW()
    FROM public.user_books ub
    LEFT JOIN public.books b ON b.id = ub.book_id
    WHERE ub.user_id = v_user_id
    ON CONFLICT (user_id) DO UPDATE
    SET books_read    = EXCLUDED.books_read,
        pages_read    = EXCLUDED.pages_read,
        reviews_count = EXCLUDED.reviews_count,
        updated_at    = EXCLUDED.updated_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Only the trigger functions below need this; it takes an arbitrary array of
-- user ids and is SECURITY DEFINER, so it should not be a callable RPC.
REVOKE ALL ON FUNCTION public.sync_reading_stats(UUID[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_reading_stats_from_new()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_reading_stats(
    ARRAY(SELECT DISTINCT user_id FROM new_rows WHERE user_id IS NOT NULL)
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_reading_stats_from_old()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_reading_stats(
    ARRAY(SELECT DISTINCT user_id FROM old_rows WHERE user_id IS NOT NULL)
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_reading_stats_from_both()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_reading_stats(ARRAY(
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM old_rows
      UNION
      SELECT user_id FROM new_rows
    ) u WHERE user_id IS NOT NULL
  ));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_books_sync_stats_insert ON public.user_books;
CREATE TRIGGER user_books_sync_stats_insert
  AFTER INSERT ON public.user_books
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_reading_stats_from_new();

DROP TRIGGER IF EXISTS user_books_sync_stats_update ON public.user_books;
CREATE TRIGGER user_books_sync_stats_update
  AFTER UPDATE ON public.user_books
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_reading_stats_from_both();

DROP TRIGGER IF EXISTS user_books_sync_stats_delete ON public.user_books;
CREATE TRIGGER user_books_sync_stats_delete
  AFTER DELETE ON public.user_books
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_reading_stats_from_old();

DROP TRIGGER IF EXISTS reviews_sync_stats_insert ON public.reviews;
CREATE TRIGGER reviews_sync_stats_insert
  AFTER INSERT ON public.reviews
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_reading_stats_from_new();

DROP TRIGGER IF EXISTS reviews_sync_stats_delete ON public.reviews;
CREATE TRIGGER reviews_sync_stats_delete
  AFTER DELETE ON public.reviews
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_reading_stats_from_old();

-- ============================================
-- 4. set_book_shelves() -- atomic shelf reconciliation
--
-- Replaces the app's DELETE-then-INSERT pair in updateBookShelves and
-- updateBookShelvesByBookId. Ownership of both the user_book and every target
-- shelf is checked here, so the RPC is safe to expose to authenticated users.
-- ============================================

CREATE OR REPLACE FUNCTION public.set_book_shelves(
  p_user_book_id UUID,
  p_shelf_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  p_shelf_ids := COALESCE(p_shelf_ids, ARRAY[]::UUID[]);

  SELECT user_id INTO v_owner_id
  FROM public.user_books
  WHERE id = p_user_book_id
  FOR UPDATE;

  IF v_owner_id IS NULL OR v_owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Book not found in your shelf' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_shelf_ids) AS target(shelf_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_shelves us
      WHERE us.id = target.shelf_id AND us.user_id = v_user_id
    )
  ) THEN
    RAISE EXCEPTION 'One or more shelves not found' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.shelf_books
  WHERE user_book_id = p_user_book_id
    AND NOT (shelf_id = ANY (p_shelf_ids));

  INSERT INTO public.shelf_books (shelf_id, user_book_id)
  SELECT target.shelf_id, p_user_book_id
  FROM unnest(p_shelf_ids) AS target(shelf_id)
  ON CONFLICT (shelf_id, user_book_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated, so revoke anon explicitly rather than relying on PUBLIC.
REVOKE ALL ON FUNCTION public.set_book_shelves(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_book_shelves(UUID, UUID[]) TO authenticated;

-- ============================================
-- 5. reconcile_counters() -- repair drifted denormalized counters
--
-- Recomputes every denormalized counter from its source table and returns one
-- row per counter with how many rows were wrong. Admin- or service-role-only.
-- ============================================

CREATE OR REPLACE FUNCTION public.reconcile_counters()
RETURNS TABLE (counter TEXT, rows_fixed BIGINT) AS $$
DECLARE
  v_fixed BIGINT;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin = true
     )
  THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  -- NOTE: books.average_rating / books.ratings_count are deliberately NOT
  -- reconciled here. Despite the naming, they are not a denormalization of
  -- public.reviews -- for most of the catalog they hold *Open Library*
  -- ratings, populated by scripts/import-ratings.ts and relied on by
  -- recommendations (`.gte("average_rating", 3.8)`, `.gte("ratings_count", 5)`),
  -- search ordering, autocomplete, curated picks and the sitemap. Recomputing
  -- them from local reviews would erase the external ratings for every book
  -- that has no local review. See the Task 13 notes: the column is overloaded
  -- and needs a product decision (separate local_* columns) before either
  -- source can be reconciled safely.

  -- reviews.likes_count
  UPDATE public.reviews r
  SET likes_count = src.cnt
  FROM (
    SELECT r2.id, (SELECT COUNT(*) FROM public.review_likes rl WHERE rl.review_id = r2.id) AS cnt
    FROM public.reviews r2
  ) src
  WHERE r.id = src.id AND COALESCE(r.likes_count, 0) IS DISTINCT FROM src.cnt;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'reviews.likes_count'; rows_fixed := v_fixed; RETURN NEXT;

  -- reading_lists.likes_count
  UPDATE public.reading_lists l
  SET likes_count = src.cnt
  FROM (
    SELECT l2.id, (SELECT COUNT(*) FROM public.reading_list_likes ll WHERE ll.list_id = l2.id) AS cnt
    FROM public.reading_lists l2
  ) src
  WHERE l.id = src.id AND COALESCE(l.likes_count, 0) IS DISTINCT FROM src.cnt;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'reading_lists.likes_count'; rows_fixed := v_fixed; RETURN NEXT;

  -- book_clubs.member_count
  UPDATE public.book_clubs c
  SET member_count = src.cnt
  FROM (
    SELECT c2.id, (SELECT COUNT(*) FROM public.book_club_members m WHERE m.club_id = c2.id) AS cnt
    FROM public.book_clubs c2
  ) src
  WHERE c.id = src.id AND COALESCE(c.member_count, 0) IS DISTINCT FROM src.cnt;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'book_clubs.member_count'; rows_fixed := v_fixed; RETURN NEXT;

  -- places.checkins_count / photos_count / reviews_count / average_rating
  UPDATE public.places pl
  SET checkins_count = src.checkins,
      photos_count   = src.photos,
      reviews_count  = src.reviews,
      average_rating = src.avg_rating
  FROM (
    SELECT p2.id,
           (SELECT COUNT(*) FROM public.place_checkins pc WHERE pc.place_id = p2.id) AS checkins,
           (SELECT COUNT(*) FROM public.place_photos pp   WHERE pp.place_id = p2.id) AS photos,
           (SELECT COUNT(*) FROM public.place_reviews pr  WHERE pr.place_id = p2.id) AS reviews,
           (SELECT ROUND(AVG(pr.rating)::numeric, 2) FROM public.place_reviews pr WHERE pr.place_id = p2.id) AS avg_rating
    FROM public.places p2
  ) src
  WHERE pl.id = src.id
    AND (COALESCE(pl.checkins_count, 0) IS DISTINCT FROM src.checkins
      OR COALESCE(pl.photos_count, 0)   IS DISTINCT FROM src.photos
      OR COALESCE(pl.reviews_count, 0)  IS DISTINCT FROM src.reviews
      OR pl.average_rating              IS DISTINCT FROM src.avg_rating);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'places.counts'; rows_fixed := v_fixed; RETURN NEXT;

  -- profiles.followers_count / following_count / friends_count /
  -- unread_messages_count
  UPDATE public.profiles p
  SET followers_count       = src.followers,
      following_count       = src.following,
      friends_count         = src.friends,
      unread_messages_count = src.unread
  FROM (
    SELECT p2.id,
           (SELECT COUNT(*) FROM public.follows f WHERE f.following_id = p2.id) AS followers,
           (SELECT COUNT(*) FROM public.follows f WHERE f.follower_id  = p2.id) AS following,
           (SELECT COUNT(*) FROM public.friend_requests fr
             WHERE fr.status = 'accepted'
               AND (fr.sender_id = p2.id OR fr.receiver_id = p2.id))            AS friends,
           (SELECT COUNT(*) FROM public.direct_messages dm
             WHERE dm.receiver_id = p2.id AND dm.read_at IS NULL)               AS unread
    FROM public.profiles p2
  ) src
  WHERE p.id = src.id
    AND (COALESCE(p.followers_count, 0)       IS DISTINCT FROM src.followers
      OR COALESCE(p.following_count, 0)       IS DISTINCT FROM src.following
      OR COALESCE(p.friends_count, 0)         IS DISTINCT FROM src.friends
      OR COALESCE(p.unread_messages_count, 0) IS DISTINCT FROM src.unread);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'profiles.social_counts'; rows_fixed := v_fixed; RETURN NEXT;

  -- reading_stats.books_read / pages_read / reviews_count
  UPDATE public.reading_stats rs
  SET books_read    = src.books_read,
      pages_read    = src.pages_read,
      reviews_count = src.reviews_count,
      updated_at    = NOW()
  FROM (
    SELECT rs2.user_id,
           (SELECT COUNT(*) FROM public.user_books ub
             WHERE ub.user_id = rs2.user_id AND ub.status = 'read')            AS books_read,
           (SELECT COALESCE(SUM(b.page_count), 0) FROM public.user_books ub
              JOIN public.books b ON b.id = ub.book_id
             WHERE ub.user_id = rs2.user_id AND ub.status = 'read')            AS pages_read,
           (SELECT COUNT(*) FROM public.reviews r WHERE r.user_id = rs2.user_id) AS reviews_count
    FROM public.reading_stats rs2
  ) src
  WHERE rs.user_id = src.user_id
    AND (COALESCE(rs.books_read, 0)    IS DISTINCT FROM src.books_read
      OR COALESCE(rs.pages_read, 0)    IS DISTINCT FROM src.pages_read
      OR COALESCE(rs.reviews_count, 0) IS DISTINCT FROM src.reviews_count);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  counter := 'reading_stats'; rows_fixed := v_fixed; RETURN NEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reconcile_counters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_counters() TO authenticated, service_role;

COMMENT ON FUNCTION public.reconcile_counters() IS
  'Recomputes every denormalized counter from its source table and returns the number of rows corrected per counter. Admin or service_role only. Safe to run repeatedly; a healthy database returns 0 for every counter.';
