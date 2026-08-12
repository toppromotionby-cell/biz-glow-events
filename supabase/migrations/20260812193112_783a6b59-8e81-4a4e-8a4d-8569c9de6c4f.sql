ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS presentations_public_token_key ON public.presentations(public_token);

CREATE TABLE IF NOT EXISTS public.presentation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_versions TO authenticated;
GRANT ALL ON public.presentation_versions TO service_role;

ALTER TABLE public.presentation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage presentation versions"
ON public.presentation_versions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX IF NOT EXISTS presentation_versions_presentation_idx
  ON public.presentation_versions(presentation_id, created_at DESC);