-- Public bucket for catalog hero photos/videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-media', 'catalog-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read
CREATE POLICY "Public read catalog-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'catalog-media');

-- Editors can write
CREATE POLICY "Editors write catalog-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'catalog-media'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'content_editor'::app_role))
);

CREATE POLICY "Editors update catalog-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'catalog-media'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'content_editor'::app_role))
);

CREATE POLICY "Editors delete catalog-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'catalog-media'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'content_editor'::app_role))
);