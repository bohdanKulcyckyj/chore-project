-- Fix households.created_by to have a default value of auth.uid()
-- This allows INSERT without specifying created_by while still satisfying RLS policy

ALTER TABLE households 
ALTER COLUMN created_by SET DEFAULT auth.uid();