-- Migration: Fix OAuth profile creation trigger
-- Problem: Google OAuth uses 'picture' instead of 'avatar_url'
-- This migration updates the trigger to handle various OAuth provider metadata structures

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    -- Username: try various fields, fallback to email prefix or user ID
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'preferred_username',
      NEW.raw_user_meta_data->>'user_name',
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      'user_' || LEFT(NEW.id::text, 8)
    ),
    -- Display name: try various fields
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name'
    ),
    -- Avatar: Google uses 'picture', others use 'avatar_url'
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  );

  INSERT INTO public.reading_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- Handle duplicate username by appending random suffix
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'preferred_username',
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      'user'
    ) || '_' || LEFT(md5(random()::text), 4),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  );

  INSERT INTO public.reading_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
WHEN OTHERS THEN
  -- Log error but don't fail user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
