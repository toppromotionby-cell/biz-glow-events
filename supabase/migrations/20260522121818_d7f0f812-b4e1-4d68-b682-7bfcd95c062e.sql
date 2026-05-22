
-- 1) blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn FROM public.blog_posts
)
UPDATE public.blog_posts b SET sort_order = ranked.rn FROM ranked WHERE ranked.id = b.id;
CREATE INDEX IF NOT EXISTS blog_posts_sort_idx ON public.blog_posts (sort_order);

-- 2) cases
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn FROM public.cases
)
UPDATE public.cases c SET sort_order = ranked.rn FROM ranked WHERE ranked.id = c.id;
CREATE INDEX IF NOT EXISTS cases_sort_idx ON public.cases (sort_order);

-- 3) zones
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn FROM public.zones
)
UPDATE public.zones z SET sort_order = ranked.rn FROM ranked WHERE ranked.id = z.id;
CREATE INDEX IF NOT EXISTS zones_sort_idx ON public.zones (sort_order);

-- 4) tech_equipment
ALTER TABLE public.tech_equipment ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn FROM public.tech_equipment
)
UPDATE public.tech_equipment t SET sort_order = ranked.rn FROM ranked WHERE ranked.id = t.id;
CREATE INDEX IF NOT EXISTS tech_equipment_sort_idx ON public.tech_equipment (sort_order);

-- 5) services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn FROM public.services
)
UPDATE public.services s SET sort_order = ranked.rn FROM ranked WHERE ranked.id = s.id;
CREATE INDEX IF NOT EXISTS services_sort_idx ON public.services (sort_order);

-- 6) production_items
ALTER TABLE public.production_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn FROM public.production_items
)
UPDATE public.production_items p SET sort_order = ranked.rn FROM ranked WHERE ranked.id = p.id;
CREATE INDEX IF NOT EXISTS production_items_sort_idx ON public.production_items (sort_order);

-- 7) site_sections (PK = key)
ALTER TABLE public.site_sections ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT key, ROW_NUMBER() OVER (ORDER BY label) - 1 AS rn FROM public.site_sections
)
UPDATE public.site_sections ss SET sort_order = ranked.rn FROM ranked WHERE ranked.key = ss.key;
CREATE INDEX IF NOT EXISTS site_sections_sort_idx ON public.site_sections (sort_order);
