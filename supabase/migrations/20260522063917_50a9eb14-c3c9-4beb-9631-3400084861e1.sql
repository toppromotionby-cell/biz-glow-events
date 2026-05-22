-- Restrict catalog-media listing to staff; public URLs still work because bucket is public
DROP POLICY IF EXISTS "Public read catalog-media" ON storage.objects;

CREATE POLICY "Staff list catalog-media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'catalog-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'content_editor'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);