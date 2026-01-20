-- Migration: Fix generate_club_slug function to bypass RLS
-- Problem: The function queries book_clubs to check slug uniqueness, but RLS blocks
-- access to private clubs the user isn't a member of. This causes "Failed to generate slug" errors.
-- Solution: Add SECURITY DEFINER so the function runs with elevated privileges.

CREATE OR REPLACE FUNCTION generate_club_slug(club_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(club_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Limit length
  base_slug := substring(base_slug from 1 for 50);

  final_slug := base_slug;

  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM public.book_clubs WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
