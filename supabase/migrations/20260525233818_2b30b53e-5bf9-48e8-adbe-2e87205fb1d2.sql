CREATE TABLE public.catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX catalog_categories_type_name_uniq
  ON public.catalog_categories (entity_type, lower(name));

CREATE INDEX catalog_categories_type_idx
  ON public.catalog_categories (entity_type, sort_order, name);

ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors read catalog categories"
  ON public.catalog_categories
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'content_editor'::app_role)
  );

CREATE POLICY "Editors manage catalog categories"
  ON public.catalog_categories
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'content_editor'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'content_editor'::app_role)
  );

-- Backfill from existing items
INSERT INTO public.catalog_categories (entity_type, name)
SELECT 'zones', DISTINCT_VAL FROM (SELECT DISTINCT category AS DISTINCT_VAL FROM public.zones WHERE category IS NOT NULL AND length(trim(category)) > 0) s
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_categories (entity_type, name)
SELECT 'tech_equipment', DISTINCT_VAL FROM (SELECT DISTINCT category AS DISTINCT_VAL FROM public.tech_equipment WHERE category IS NOT NULL AND length(trim(category)) > 0) s
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_categories (entity_type, name)
SELECT 'services', DISTINCT_VAL FROM (SELECT DISTINCT category AS DISTINCT_VAL FROM public.services WHERE category IS NOT NULL AND length(trim(category)) > 0) s
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_categories (entity_type, name)
SELECT 'production_items', DISTINCT_VAL FROM (SELECT DISTINCT category AS DISTINCT_VAL FROM public.production_items WHERE category IS NOT NULL AND length(trim(category)) > 0) s
ON CONFLICT DO NOTHING;