-- Migration: Add SECURITY DEFINER function to add club creator as admin
-- Problem: RLS policies on book_clubs and book_club_members reference each other,
-- causing infinite recursion when inserting a new member.
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to add the creator.

-- Function to add club creator as admin (bypasses RLS)
CREATE OR REPLACE FUNCTION add_club_creator_as_admin(p_club_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verify the user is actually the club creator
  IF NOT EXISTS (
    SELECT 1 FROM public.book_clubs
    WHERE id = p_club_id AND created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is not the creator of this club';
  END IF;

  -- Insert the creator as admin
  INSERT INTO public.book_club_members (club_id, user_id, role)
  VALUES (p_club_id, p_user_id, 'admin')
  ON CONFLICT (club_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_club_creator_as_admin(UUID, UUID) TO authenticated;
