-- Create user profiles table to store display names and other profile information
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can view profiles of household members
CREATE POLICY "Users can view household member profiles"
  ON user_profiles FOR SELECT TO authenticated
  USING (id IN (
    SELECT DISTINCT hm1.user_id 
    FROM household_members hm1
    INNER JOIN household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm2.user_id = auth.uid()
  ));

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user creation
CREATE OR REPLACE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Create profiles for existing users
INSERT INTO user_profiles (id, display_name)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);