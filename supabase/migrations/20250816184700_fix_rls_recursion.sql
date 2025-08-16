-- Fix for infinite recursion in household_members RLS policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view household members for their households" ON household_members;

-- Create the security function to avoid recursion
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

-- Create the fixed policy using the security function
CREATE POLICY "Users can view household members for their households"
  ON household_members FOR SELECT TO authenticated
  USING (is_household_member(household_id));