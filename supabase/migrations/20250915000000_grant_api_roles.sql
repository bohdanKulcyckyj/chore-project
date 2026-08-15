-- Grant table/sequence privileges to the Supabase API roles.
-- Hosted Supabase applies these via platform defaults; a local `supabase start`
-- does not, so anon/authenticated hit "permission denied for table ..." even
-- though RLS policies exist. RLS still governs which ROWS are visible; these
-- grants only allow the roles to reach the tables at all.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Future tables/sequences created by the postgres role inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
