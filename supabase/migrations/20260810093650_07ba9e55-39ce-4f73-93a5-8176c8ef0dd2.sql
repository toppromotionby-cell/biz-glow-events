ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS vat_as_line boolean NOT NULL DEFAULT false;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_vat_mode_check CHECK (vat_mode IN ('none','add','included'));

ALTER TABLE public.promo_quotes
  ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vat_as_line boolean NOT NULL DEFAULT false;

UPDATE public.promo_quotes SET vat_mode = 'add' WHERE vat_enabled = true;

ALTER TABLE public.promo_quotes
  ADD CONSTRAINT promo_quotes_vat_mode_check CHECK (vat_mode IN ('none','add','included'));

ALTER TABLE public.document_settings
  ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS vat_as_line boolean NOT NULL DEFAULT false;

ALTER TABLE public.document_settings
  ADD CONSTRAINT document_settings_vat_mode_check CHECK (vat_mode IN ('none','add','included'));