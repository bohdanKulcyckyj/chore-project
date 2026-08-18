-- Restore admin management of household_members.
--
-- 20250816191414 created "Admins can manage household members", but
-- 20250914150616_remote_schema.sql dropped it and replaced it with self-service-only
-- policies (user_id = auth.uid()). Since then an admin's "Make Admin" / "Remove Member"
-- UPDATE/DELETE matched zero rows: PostgREST returns 204 No Content either way, so the
-- UI reported success while nothing changed.
--
-- SECURITY DEFINER helper (mirrors is_household_member) so the policy can read
-- household_members without re-triggering its own RLS -- the recursion that
-- 20250816184700 / 20250816191414 were fighting.
CREATE OR REPLACE FUNCTION public.is_household_admin(household_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = household_uuid
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can update household members" ON household_members;
CREATE POLICY "Admins can update household members"
  ON household_members FOR UPDATE TO authenticated
  USING (is_household_admin(household_id))
  WITH CHECK (is_household_admin(household_id));

DROP POLICY IF EXISTS "Admins can remove household members" ON household_members;
CREATE POLICY "Admins can remove household members"
  ON household_members FOR DELETE TO authenticated
  USING (is_household_admin(household_id));

-- Privilege escalation fix. 20250914150616 left "Users can update their own membership"
-- as USING (user_id = auth.uid()) with no WITH CHECK and no column restriction, so any
-- member could UPDATE their own row and set role='admin'. Re-scope it so a self-update
-- can never change role or household_id; admins go through the policy above instead.
-- Enforced in the trigger below rather than a WITH CHECK subquery: reading
-- household_members from its own policy is what caused the recursion incidents in
-- 20250816184700 / 20250816191414.
DROP POLICY IF EXISTS "Users can update their own membership" ON household_members;
CREATE POLICY "Users can update their own membership"
  ON household_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Last-admin protection. The client checks this too (for a friendly toast), but the
-- client is not a trust boundary: a direct PostgREST call could otherwise leave a
-- household with zero admins, which is unrecoverable through the UI.
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demoting boolean;
BEGIN
  -- Self-service updates may not change role (privilege escalation) or move the row to
  -- another household. Admins acting on someone else's row are exempt.
  IF TG_OP = 'UPDATE' AND OLD.user_id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_household_admin(OLD.household_id) THEN
      RAISE EXCEPTION 'Only an admin can change a member role';
    END IF;
    IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
      RAISE EXCEPTION 'Cannot move a membership to another household';
    END IF;
  END IF;

  demoting := (TG_OP = 'DELETE') OR (NEW.role IS DISTINCT FROM 'admin');

  IF OLD.role = 'admin' AND demoting THEN
    IF (SELECT count(*) FROM household_members
        WHERE household_id = OLD.household_id AND role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Household must keep at least one admin';
    END IF;
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_removal ON household_members;
CREATE TRIGGER trg_prevent_last_admin_removal
  BEFORE UPDATE OR DELETE ON household_members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_admin_removal();
