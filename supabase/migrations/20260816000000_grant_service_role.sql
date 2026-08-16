-- Local parity with hosted Supabase: the platform grants service_role full
-- table access by default; local `supabase start` does not (same gap
-- 20250915000000_grant_api_roles.sql closed for anon/authenticated).
-- service_role has BYPASSRLS, so RLS policies don't apply to it anyway.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
