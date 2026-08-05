ALTER TABLE public.promo_quotes
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;

ALTER TABLE public.promo_quote_items
  ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.promo_item_snippets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_item_snippets TO authenticated;
GRANT ALL ON public.promo_item_snippets TO service_role;
ALTER TABLE public.promo_item_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage promo item snippets"
  ON public.promo_item_snippets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER promo_item_snippets_touch_updated_at
  BEFORE UPDATE ON public.promo_item_snippets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.promo_quote_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.promo_quotes(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_quote_versions_quote_idx
  ON public.promo_quote_versions (quote_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_quote_versions TO authenticated;
GRANT ALL ON public.promo_quote_versions TO service_role;
ALTER TABLE public.promo_quote_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage promo quote versions"
  ON public.promo_quote_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));