ALTER TABLE public.paperwork_documents
  ADD COLUMN IF NOT EXISTS order_journal text,
  ADD COLUMN IF NOT EXISTS order_kind text,
  ADD COLUMN IF NOT EXISTS order_year integer,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS source_path text;

CREATE INDEX IF NOT EXISTS paperwork_documents_order_idx
  ON public.paperwork_documents (order_journal, order_year, doc_date DESC);