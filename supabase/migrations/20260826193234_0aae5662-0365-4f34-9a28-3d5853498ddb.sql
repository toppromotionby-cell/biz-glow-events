ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS management_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS management_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS agency_fee_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.promo_quotes
  ADD COLUMN IF NOT EXISTS management_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS management_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS agency_fee_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.document_settings
  ADD COLUMN IF NOT EXISTS management_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS management_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS agency_fee_value numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_management_type_check CHECK (management_type IN ('none','percent','amount'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_agency_fee_type_check CHECK (agency_fee_type IN ('none','percent','amount'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.promo_quotes ADD CONSTRAINT promo_quotes_management_type_check CHECK (management_type IN ('none','percent','amount'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.promo_quotes ADD CONSTRAINT promo_quotes_agency_fee_type_check CHECK (agency_fee_type IN ('none','percent','amount'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.document_settings ADD CONSTRAINT document_settings_management_type_check CHECK (management_type IN ('none','percent','amount'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.document_settings ADD CONSTRAINT document_settings_agency_fee_type_check CHECK (agency_fee_type IN ('none','percent','amount'));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;