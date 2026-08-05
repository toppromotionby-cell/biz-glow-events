-- Both functions are SECURITY DEFINER internal email-queue plumbing:
--   * public.email_queue_wake() is a TRIGGER function; trigger firing does NOT
--     require EXECUTE privilege, so revoking is safe.
--   * public.email_queue_dispatch() is only invoked by the pg_cron job
--     'process-email-queue', which runs as the postgres role.
-- Neither is called from application code via PostgREST RPC. Exposing them to
-- anon/authenticated let untrusted callers drive privileged queue processing
-- (net.http_post using the vault-stored service role key).

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM authenticated;

REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM anon;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM authenticated;

-- Preserve the callers that legitimately need these functions.
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;