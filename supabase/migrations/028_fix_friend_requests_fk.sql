-- Fix friend_requests foreign keys
-- The table currently references auth.users, but queries need to join with profiles
-- Add explicit foreign keys to profiles table for Supabase relationship hints

-- Add foreign key from sender_id to profiles
ALTER TABLE public.friend_requests
ADD CONSTRAINT friend_requests_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key from receiver_id to profiles
ALTER TABLE public.friend_requests
ADD CONSTRAINT friend_requests_receiver_id_fkey
FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
