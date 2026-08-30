ALTER TABLE public.paperwork_documents
  ADD COLUMN IF NOT EXISTS order_journal text,
  ADD COLUMN IF NOT EXISTS order_kind text,
  ADD COLUMN IF NOT EXISTS order_year integer,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS source_path text;

CREATE INDEX IF NOT EXISTS paperwork_documents_orders_idx
  ON public.paperwork_documents (doc_type, order_journal, order_year);

DROP POLICY IF EXISTS "Staff read paperwork archive" ON storage.objects;
CREATE POLICY "Staff read paperwork archive"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'paperwork-archive'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

DROP POLICY IF EXISTS "Staff write paperwork archive" ON storage.objects;
CREATE POLICY "Staff write paperwork archive"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'paperwork-archive'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

DROP POLICY IF EXISTS "Staff delete paperwork archive" ON storage.objects;
CREATE POLICY "Staff delete paperwork archive"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'paperwork-archive'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );