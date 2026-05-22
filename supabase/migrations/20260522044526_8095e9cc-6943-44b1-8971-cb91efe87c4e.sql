
CREATE TABLE public.text_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  original_text text NOT NULL,
  override_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path, original_text)
);

ALTER TABLE public.text_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads text overrides"
ON public.text_overrides FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage text overrides"
ON public.text_overrides FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_text_overrides_updated_at
BEFORE UPDATE ON public.text_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.text_overrides;
