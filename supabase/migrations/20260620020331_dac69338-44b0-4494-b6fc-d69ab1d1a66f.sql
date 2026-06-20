DROP POLICY IF EXISTS "Authenticated can read document settings" ON public.document_settings;
CREATE POLICY "Admins can read document settings"
  ON public.document_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));