-- 075: let either party delete a rejected friend request
--
-- 064 added friend_requests_pair_uniq (one row per pair), and the DELETE
-- policy (022, restated in 068) covered only pending (sender) and accepted
-- (either party) rows. A rejected row could therefore never be removed, and
-- the pair could never send another request in either direction.
-- sendFriendRequest now deletes the rejected row before inserting a new one.

BEGIN;

DROP POLICY IF EXISTS "Users can delete own friend requests" ON public.friend_requests;
CREATE POLICY "Users can delete own friend requests" ON public.friend_requests
  FOR DELETE TO public
  USING (
    ((SELECT auth.uid()) = sender_id AND status = 'pending')
    OR (
      ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id)
      AND status IN ('accepted', 'rejected')
    )
  );

COMMIT;
