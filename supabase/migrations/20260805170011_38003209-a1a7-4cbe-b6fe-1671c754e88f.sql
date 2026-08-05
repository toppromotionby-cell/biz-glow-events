CREATE TABLE public.quote_block_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  block_type text NOT NULL DEFAULT 'text',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT 'always',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_block_snippets TO authenticated;
GRANT ALL ON public.quote_block_snippets TO service_role;

ALTER TABLE public.quote_block_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage quote block snippets"
ON public.quote_block_snippets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER quote_block_snippets_updated_at
BEFORE UPDATE ON public.quote_block_snippets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();