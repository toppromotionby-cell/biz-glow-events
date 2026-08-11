CREATE TABLE public.doc_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL DEFAULT 'quote' CHECK (doc_type IN ('quote','promo')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT '',
  block_type text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_snippets TO authenticated;
GRANT ALL ON public.doc_snippets TO service_role;

ALTER TABLE public.doc_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage doc snippets"
ON public.doc_snippets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER doc_snippets_updated_at
BEFORE UPDATE ON public.doc_snippets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX doc_snippets_doc_type_idx ON public.doc_snippets (doc_type, sort_order);

INSERT INTO public.doc_snippets (doc_type, name, description, block_type, condition, title, content, sort_order, created_by, created_at, updated_at)
SELECT 'quote', name, description, block_type, condition, title, content, sort_order, created_by, created_at, updated_at
FROM public.quote_block_snippets;

INSERT INTO public.doc_snippets (doc_type, name, description, section, items, created_by, created_at, updated_at)
SELECT 'promo', name, description, section, items, created_by, created_at, updated_at
FROM public.promo_item_snippets;

DROP TABLE public.quote_block_snippets;
DROP TABLE public.promo_item_snippets;