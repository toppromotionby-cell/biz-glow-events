DROP POLICY IF EXISTS "Authenticated inserts logs" ON public.marketing_logs;

CREATE POLICY "Service role inserts marketing logs"
ON public.marketing_logs
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');