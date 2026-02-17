-- Migration: Add SET search_path to handle_new_user trigger function
-- Problem: SECURITY DEFINER function missing search_path restriction
-- This is the only SECURITY DEFINER function without SET search_path = public
-- Risk: An attacker who can create a schema with identically named tables
-- could redirect the function's unqualified table references

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
