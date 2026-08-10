ALTER TABLE public.document_settings ADD COLUMN IF NOT EXISTS logo_layout jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS logo_layout jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.promo_quotes ADD COLUMN IF NOT EXISTS logo_layout jsonb NOT NULL DEFAULT '{}'::jsonb;