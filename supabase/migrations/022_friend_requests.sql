-- Friend Requests System
-- Enables explicit friend connections between users (separate from follows)

-- ============================================
-- TABLE: friend_requests
-- ============================================

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(sender_id, receiver_id)
);

-- Prevent self-friending
ALTER TABLE public.friend_requests
ADD CONSTRAINT friend_requests_no_self_friend
CHECK (sender_id != receiver_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS friend_requests_sender_idx ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS friend_requests_status_idx ON public.friend_requests(status);
CREATE INDEX IF NOT EXISTS friend_requests_sender_status_idx ON public.friend_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_receiver_status_idx ON public.friend_requests(receiver_id, status);

-- ============================================
-- ADD friends_count TO profiles
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friends_count INTEGER DEFAULT 0;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Users can view requests they sent or received
CREATE POLICY "Users can view own friend requests"
ON public.friend_requests FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send friend requests (insert where they are sender)
CREATE POLICY "Users can send friend requests"
ON public.friend_requests FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Receivers can update request status (accept/reject)
CREATE POLICY "Receivers can respond to friend requests"
ON public.friend_requests FOR UPDATE
USING (auth.uid() = receiver_id AND status = 'pending');

-- Senders can delete their pending requests (cancel)
-- Both parties can delete accepted friendships (unfriend)
CREATE POLICY "Users can delete own friend requests"
ON public.friend_requests FOR DELETE
USING (
  (auth.uid() = sender_id AND status = 'pending') OR
  (auth.uid() IN (sender_id, receiver_id) AND status = 'accepted')
);

-- ============================================
-- TRIGGER: Update friends_count
-- ============================================

CREATE OR REPLACE FUNCTION update_friends_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle status change to 'accepted'
  IF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Increment both users' friends_count
    UPDATE public.profiles SET friends_count = friends_count + 1 WHERE id = NEW.sender_id;
    UPDATE public.profiles SET friends_count = friends_count + 1 WHERE id = NEW.receiver_id;
  END IF;

  -- Handle deletion of accepted friendship
  IF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    -- Decrement both users' friends_count
    UPDATE public.profiles SET friends_count = GREATEST(0, friends_count - 1) WHERE id = OLD.sender_id;
    UPDATE public.profiles SET friends_count = GREATEST(0, friends_count - 1) WHERE id = OLD.receiver_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updates (status changes)
DROP TRIGGER IF EXISTS on_friend_request_update ON public.friend_requests;
CREATE TRIGGER on_friend_request_update
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_friends_count();

-- Trigger for deletes (unfriending)
DROP TRIGGER IF EXISTS on_friend_request_delete ON public.friend_requests;
CREATE TRIGGER on_friend_request_delete
  AFTER DELETE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_friends_count();
