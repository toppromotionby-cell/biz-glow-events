CREATE POLICY "calendar_outbox_admin" ON public.calendar_outbox FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.calendar_outbox TO authenticated;
GRANT ALL ON public.calendar_outbox TO service_role;