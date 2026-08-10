ALTER TABLE public.zones DROP COLUMN IF EXISTS short_description;
ALTER TABLE public.services DROP COLUMN IF EXISTS short_description;
ALTER TABLE public.tech_equipment DROP COLUMN IF EXISTS short_description;
ALTER TABLE public.production_items DROP COLUMN IF EXISTS short_description;
ALTER TABLE public.attractions DROP COLUMN IF EXISTS short_description;