ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qty_unit text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rate_qty numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_info boolean NOT NULL DEFAULT false;

ALTER TABLE public.promo_quote_items
  ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qty_unit text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rate_qty numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_info boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.estimate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'promo',
  description text NOT NULL DEFAULT '',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  strict boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_templates TO authenticated;
GRANT ALL ON public.estimate_templates TO service_role;
ALTER TABLE public.estimate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage estimate templates" ON public.estimate_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER estimate_templates_touch_updated_at
  BEFORE UPDATE ON public.estimate_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.estimate_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.estimate_templates(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  qty_unit text NOT NULL DEFAULT '',
  rate_unit text NOT NULL DEFAULT '',
  rate_qty numeric NOT NULL DEFAULT 1,
  multiplier numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  includes jsonb NOT NULL DEFAULT '[]'::jsonb,
  included boolean NOT NULL DEFAULT true,
  group_key text NOT NULL DEFAULT '',
  is_info boolean NOT NULL DEFAULT false,
  exclude_from_commission boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimate_template_items_template_idx
  ON public.estimate_template_items (template_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_template_items TO authenticated;
GRANT ALL ON public.estimate_template_items TO service_role;
ALTER TABLE public.estimate_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage estimate template items" ON public.estimate_template_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));