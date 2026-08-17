-- Enable realtime for task_assignments: the calendar's postgres_changes channel
-- only fires for tables in the supabase_realtime publication (empty by default
-- on fresh local stacks). Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
  END IF;
END $$;
