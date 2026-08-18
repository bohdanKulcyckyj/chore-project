-- Calendar recurrence support for task_assignments:
-- 1) dedupe (task_id, due_datetime), 2) unique occurrence key for client upserts,
-- 3) let any household member insert assignments (rotation materializer).

-- 1) Dedupe rows sharing (task_id, due_datetime) where due_datetime IS NOT NULL.
-- Keep the row that has completions (else earliest assigned_at, tie-break by
-- id); delete the rest — but ONLY duplicates with no task_completions
-- (task_completions.assignment_id cascades, so deleting a completed row would
-- destroy completion/points history).
-- If a conflicting pair with history survives (two completed duplicates), the
-- ADD CONSTRAINT below fails loudly; the operator must resolve those rows
-- manually (merge/re-point the completions, then delete) rather than have this
-- migration silently drop them.
DELETE FROM task_assignments
WHERE id IN (
  SELECT id FROM (
    SELECT ta.id,
           row_number() OVER (
             PARTITION BY ta.task_id, ta.due_datetime
             ORDER BY EXISTS (SELECT 1 FROM task_completions tc WHERE tc.assignment_id = ta.id) DESC,
                      ta.assigned_at ASC NULLS LAST, ta.id ASC
           ) AS rn
    FROM task_assignments ta
    WHERE ta.due_datetime IS NOT NULL
  ) ranked
  WHERE rn > 1
)
AND NOT EXISTS (
  SELECT 1 FROM task_completions tc WHERE tc.assignment_id = task_assignments.id
);

-- 2) Unique occurrence key used by the client materializer's upsert
-- (onConflict: task_id,due_datetime). NULL due_datetime rows never collide
-- (Postgres default NULLS DISTINCT).
ALTER TABLE task_assignments
  ADD CONSTRAINT task_assignments_task_due_key UNIQUE (task_id, due_datetime);

-- 3) Any household member (not just admin) may insert assignments for tasks of
-- their household, as long as assigned_to is a member of that same household,
-- the row is a fresh 'pending' one, and it is stamped assigned_by = the caller
-- (no pre-completed rows, no impersonating another assigner). Every client
-- insert path (claim, one-off create, recurrence materializer) already sets
-- status='pending' + assigned_by=auth.uid(). Admins keep FOR ALL.
-- The existing self-assign policy ("Users can create assignments for their
-- household tasks") stays in place and still covers self-claim.
-- RLS-recursion note (see 20250816184700_fix_rls_recursion.sql): recursion only
-- occurred for policies ON household_members querying household_members; that
-- was fixed with the SECURITY DEFINER is_household_member(). Policies on OTHER
-- tables (like the existing task_assignments policies) query household_members
-- with plain subqueries safely — same style used here.
CREATE POLICY "Household members can create assignments for household tasks"
  ON task_assignments FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND assigned_by = auth.uid()
    AND task_id IN (
      SELECT id FROM tasks
      WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
        AND household_id IN (SELECT household_id FROM household_members WHERE user_id = assigned_to)
    )
  );
