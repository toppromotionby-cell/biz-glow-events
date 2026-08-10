ALTER TABLE public.catalog_sections
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'native',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS category_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.catalog_sections
  DROP CONSTRAINT IF EXISTS catalog_sections_kind_check;
ALTER TABLE public.catalog_sections
  ADD CONSTRAINT catalog_sections_kind_check CHECK (kind IN ('native','virtual'));

CREATE UNIQUE INDEX IF NOT EXISTS catalog_sections_slug_key
  ON public.catalog_sections (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_native_catalog_sections()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.kind = 'native' THEN
    RAISE EXCEPTION 'Базовый раздел нельзя удалить, его можно только скрыть';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_native_catalog_sections_trg ON public.catalog_sections;
CREATE TRIGGER protect_native_catalog_sections_trg
  BEFORE DELETE ON public.catalog_sections
  FOR EACH ROW EXECUTE FUNCTION public.protect_native_catalog_sections();