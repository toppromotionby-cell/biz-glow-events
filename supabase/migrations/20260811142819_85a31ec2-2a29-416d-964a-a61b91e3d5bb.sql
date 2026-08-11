ALTER TABLE public.document_settings ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'brand';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'inherit';
ALTER TABLE public.promo_quotes ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'inherit';
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS client_logo_url text;
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS logo_layout jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'inherit';