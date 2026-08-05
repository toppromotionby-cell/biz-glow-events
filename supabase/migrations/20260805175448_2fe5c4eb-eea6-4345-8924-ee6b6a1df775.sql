ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS quotes_public_token_key ON public.quotes(public_token);

CREATE TABLE IF NOT EXISTS public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_versions_quote_id_idx ON public.quote_versions(quote_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.quote_versions TO authenticated;
GRANT ALL ON public.quote_versions TO service_role;

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quote versions" ON public.quote_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can create quote versions" ON public.quote_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can delete quote versions" ON public.quote_versions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));