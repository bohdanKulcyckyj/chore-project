-- Fix household SELECT policy to allow creators to view their newly created households
-- This prevents the chicken-and-egg problem where creators can't SELECT their household
-- before being added as members

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view households they are members of" ON households;

-- Create new policy that allows both members AND creators to view households
CREATE POLICY "Users can view households they created or are members of"
  ON households FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR 
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );