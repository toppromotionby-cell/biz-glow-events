CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role, anon;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;