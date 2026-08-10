CREATE TABLE public.finance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('invoice','contract','act')),
  doc_number text,
  status text NOT NULL DEFAULT 'draft',
  doc_date date NOT NULL DEFAULT current_date,
  due_date date,
  client_name text NOT NULL DEFAULT '',
  client_company text NOT NULL DEFAULT '',
  client_unp text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  client_address text NOT NULL DEFAULT '',
  event_date date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  versions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_documents TO authenticated;
GRANT ALL ON public.finance_documents TO service_role;

ALTER TABLE public.finance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage finance documents"
ON public.finance_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE INDEX finance_documents_kind_created_idx ON public.finance_documents (kind, created_at DESC);
CREATE INDEX finance_documents_order_idx ON public.finance_documents (order_id);

CREATE OR REPLACE FUNCTION public.set_finance_doc_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  yr text;
  seq integer;
BEGIN
  IF NEW.doc_number IS NOT NULL AND NEW.doc_number <> '' THEN
    RETURN NEW;
  END IF;
  prefix := CASE NEW.kind WHEN 'invoice' THEN 'SCH' WHEN 'contract' THEN 'DOG' ELSE 'AKT' END;
  yr := to_char(coalesce(NEW.doc_date, current_date), 'YYYY');
  SELECT coalesce(max((regexp_replace(doc_number, '^.*-', ''))::int), 0) + 1
    INTO seq
    FROM public.finance_documents
   WHERE kind = NEW.kind
     AND doc_number LIKE prefix || '-' || yr || '-%';
  NEW.doc_number := prefix || '-' || yr || '-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_documents_number
BEFORE INSERT ON public.finance_documents
FOR EACH ROW EXECUTE FUNCTION public.set_finance_doc_number();

CREATE TRIGGER finance_documents_updated_at
BEFORE UPDATE ON public.finance_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();