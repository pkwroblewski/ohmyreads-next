-- Migration: Direct Messages
-- Description: Create direct_messages table for friends-only messaging with realtime support

-- =============================================
-- DIRECT MESSAGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure sender can't message themselves
  CONSTRAINT dm_no_self_message CHECK (sender_id != receiver_id)
);

-- =============================================
-- INDEXES
-- =============================================

-- Index for finding messages by sender
CREATE INDEX IF NOT EXISTS dm_sender_idx ON public.direct_messages(sender_id);

-- Index for finding messages by receiver
CREATE INDEX IF NOT EXISTS dm_receiver_idx ON public.direct_messages(receiver_id);

-- Index for ordering by created_at
CREATE INDEX IF NOT EXISTS dm_created_at_idx ON public.direct_messages(created_at DESC);

-- Composite index for conversation queries (find messages between two users)
CREATE INDEX IF NOT EXISTS dm_conversation_idx ON public.direct_messages(
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id),
  created_at DESC
);

-- =============================================
-- FRIENDSHIP CHECK FUNCTION
-- =============================================

-- Function to check if two users are friends (for use in RLS policies)
CREATE OR REPLACE FUNCTION public.are_friends(user1 UUID, user2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE status = 'accepted'
    AND (
      (sender_id = user1 AND receiver_id = user2)
      OR (sender_id = user2 AND receiver_id = user1)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can only view messages where they're sender or receiver
CREATE POLICY "Users can view own messages"
ON public.direct_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can only send messages to friends (insert where they're sender)
CREATE POLICY "Users can send messages to friends"
ON public.direct_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.are_friends(auth.uid(), receiver_id)
);

-- Users can mark messages as read (update where they're receiver)
CREATE POLICY "Users can mark messages read"
ON public.direct_messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Users can delete their own sent messages
CREATE POLICY "Users can delete own messages"
ON public.direct_messages FOR DELETE
USING (auth.uid() = sender_id);

-- =============================================
-- UNREAD MESSAGES COUNT ON PROFILES
-- =============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS unread_messages_count INTEGER DEFAULT 0;

-- =============================================
-- ENABLE REALTIME
-- =============================================

-- Add direct_messages to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- =============================================
-- TRIGGER: UPDATE UNREAD COUNT
-- =============================================

-- Function to update unread message count when a new message is received
CREATE OR REPLACE FUNCTION public.update_unread_messages_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment unread count for receiver
    UPDATE public.profiles
    SET unread_messages_count = COALESCE(unread_messages_count, 0) + 1
    WHERE id = NEW.receiver_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    -- Decrement unread count when message is marked as read
    UPDATE public.profiles
    SET unread_messages_count = GREATEST(COALESCE(unread_messages_count, 0) - 1, 0)
    WHERE id = NEW.receiver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new messages
CREATE TRIGGER on_direct_message_insert
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_unread_messages_count();

-- Trigger for marking messages as read
CREATE TRIGGER on_direct_message_read
AFTER UPDATE OF read_at ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_unread_messages_count();
