ALTER TABLE public.catalog_categories
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS catalog_categories_touch_updated_at ON public.catalog_categories;
CREATE TRIGGER catalog_categories_touch_updated_at
BEFORE UPDATE ON public.catalog_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_sections (
  key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_sections TO authenticated;
GRANT ALL ON public.catalog_sections TO service_role;

ALTER TABLE public.catalog_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editors read catalog sections" ON public.catalog_sections;
CREATE POLICY "Editors read catalog sections"
ON public.catalog_sections FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'content_editor'::app_role));

DROP POLICY IF EXISTS "Editors manage catalog sections" ON public.catalog_sections;
CREATE POLICY "Editors manage catalog sections"
ON public.catalog_sections FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'content_editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'content_editor'::app_role));

DROP TRIGGER IF EXISTS catalog_sections_touch_updated_at ON public.catalog_sections;
CREATE TRIGGER catalog_sections_touch_updated_at
BEFORE UPDATE ON public.catalog_sections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.catalog_sections (key, title, description, icon, sort_order, visible) VALUES
  ('zones', 'Интерактивные зоны', 'VR/AR, фотозоны, геймификация, иммерсивные зоны', 'Cpu', 10, true),
  ('tech_equipment', 'Техническое оснащение', 'Звук, свет, LED-экраны любых размеров', 'Music', 20, true),
  ('services', 'Услуги', 'BTL, промо-персонал, event-услуги', 'Lightbulb', 30, true),
  ('production_items', 'Производство', 'Декорации, баннеры, арт-объекты, реквизит', 'Package', 40, true),
  ('attractions', 'Аттракционы', 'Аттракционы и развлечения для мероприятий любого масштаба', 'Ferris', 50, true)
ON CONFLICT (key) DO NOTHING;