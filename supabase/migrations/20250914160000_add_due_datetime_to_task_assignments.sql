-- Replace due_date with due_datetime for calendar functionality
-- Since database has no data, we can safely drop and recreate the column

-- Drop the old due_date column
ALTER TABLE task_assignments 
DROP COLUMN due_date;

-- Add the new due_datetime column
ALTER TABLE task_assignments 
ADD COLUMN due_datetime TIMESTAMPTZ;

-- Add a comment for documentation
COMMENT ON COLUMN task_assignments.due_datetime IS 'Datetime when the task is due - supports full calendar functionality';