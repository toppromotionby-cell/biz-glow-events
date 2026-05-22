
DROP POLICY IF EXISTS "Authenticated inserts logs" ON public.marketing_logs;
CREATE POLICY "Authenticated inserts logs"
  ON public.marketing_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND event IS NOT NULL AND char_length(event) BETWEEN 1 AND 200);
