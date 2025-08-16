-- Final fix for infinite recursion in household_members RLS policy
-- This ensures the policy is completely rebuilt to avoid any caching issues

-- Drop ALL existing policies on household_members
DROP POLICY IF EXISTS "Users can view household members for their households" ON household_members;
DROP POLICY IF EXISTS "Users can join households" ON household_members;
DROP POLICY IF EXISTS "Admins can manage household members" ON household_members;

-- Ensure the security function exists and is correct
DROP FUNCTION IF EXISTS is_household_member(uuid);

CREATE OR REPLACE FUNCTION is_household_member(household_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members 
    WHERE user_id = auth.uid() 
    AND household_id = household_uuid
  );
$$;

-- Recreate all household_members policies with the security function
CREATE POLICY "Users can view household members for their households"
  ON household_members FOR SELECT TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Users can join households"
  ON household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage household members"
  ON household_members FOR ALL TO authenticated
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));