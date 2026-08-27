ALTER TABLE public.document_settings
  ADD COLUMN IF NOT EXISTS show_facsimile boolean NOT NULL DEFAULT false;