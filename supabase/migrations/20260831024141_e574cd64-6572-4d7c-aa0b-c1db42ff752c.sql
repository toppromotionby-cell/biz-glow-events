CREATE POLICY "dj_storage_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('dj-audio','dj-software','dj-artwork') AND public.dj_is_trusted(auth.uid()));

CREATE POLICY "dj_storage_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('dj-audio','dj-software','dj-artwork')
         AND (owner = auth.uid() OR public.dj_can_manage(auth.uid())));

CREATE POLICY "dj_storage_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('dj-audio','dj-software','dj-artwork') AND public.dj_can_manage(auth.uid()))
  WITH CHECK (bucket_id IN ('dj-audio','dj-software','dj-artwork') AND public.dj_can_manage(auth.uid()));

CREATE POLICY "dj_storage_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('dj-audio','dj-software','dj-artwork') AND public.dj_can_manage(auth.uid()));