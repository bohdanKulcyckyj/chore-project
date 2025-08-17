-- Fix user profile creation trigger to handle metadata properly
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger AS $$
DECLARE
  display_name_value text;
BEGIN
  -- Try to get display_name from user metadata with better error handling
  BEGIN
    display_name_value := COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->'data'->>'display_name',
      split_part(NEW.email, '@', 1)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to email username if metadata parsing fails
    display_name_value := split_part(NEW.email, '@', 1);
  END;

  -- Insert the user profile with error handling
  BEGIN
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (NEW.id, display_name_value);
  EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise it
    RAISE LOG 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
    RAISE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();