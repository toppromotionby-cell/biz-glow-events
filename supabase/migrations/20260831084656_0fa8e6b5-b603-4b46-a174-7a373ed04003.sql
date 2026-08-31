DROP POLICY IF EXISTS "Staff manage paperwork documents" ON public.paperwork_documents;
CREATE POLICY "Staff manage paperwork documents"
ON public.paperwork_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));