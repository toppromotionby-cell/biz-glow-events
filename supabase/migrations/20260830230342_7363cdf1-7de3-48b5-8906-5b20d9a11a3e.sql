ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS participants jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS paperwork_documents_registry_idx
  ON public.paperwork_documents (doc_type, order_journal, order_year);