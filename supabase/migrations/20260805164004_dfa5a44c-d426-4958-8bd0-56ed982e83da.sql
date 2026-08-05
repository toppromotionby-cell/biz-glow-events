CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT '',
  doc_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Minsk')::date,
  validity_days integer NOT NULL DEFAULT 14,
  client_name text NOT NULL DEFAULT '',
  client_company text NOT NULL DEFAULT '',
  client_unp text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  client_address text NOT NULL DEFAULT '',
  event_date date,
  event_time_start text NOT NULL DEFAULT '',
  event_time_end text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  guests_count integer,
  event_format text NOT NULL DEFAULT '',
  setup_note text NOT NULL DEFAULT '',
  event_notes text NOT NULL DEFAULT '',
  company_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_url text,
  signature_url text,
  stamp_url text,
  texts jsonb NOT NULL DEFAULT '{}'::jsonb,
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  discount_type text NOT NULL DEFAULT 'none',
  discount_value numeric NOT NULL DEFAULT 0,
  prepayment_type text NOT NULL DEFAULT 'percent',
  prepayment_value numeric NOT NULL DEFAULT 50,
  delivery_amount numeric NOT NULL DEFAULT 0,
  vat_note text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage quotes" ON public.quotes
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'шт.',
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  entity_type text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_items_quote_id_idx ON public.quote_items(quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage quote items" ON public.quote_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER quotes_touch_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.set_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_day date;
  v_seq int;
  v_attempt int := 0;
  v_candidate text;
  v_exists boolean;
BEGIN
  IF NEW.quote_number IS NOT NULL AND NEW.quote_number <> '' THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.created_at AT TIME ZONE 'Europe/Minsk')::date;

  SELECT count(*) INTO v_seq
    FROM public.quotes
   WHERE (created_at AT TIME ZONE 'Europe/Minsk')::date = v_day;
  v_seq := v_seq + 1;

  LOOP
    v_candidate := to_char(v_day, 'DD/MM/YYYY') || '-' || lpad(v_seq::text, 2, '0');
    SELECT EXISTS(SELECT 1 FROM public.quotes WHERE quote_number = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempt > 50;
    v_seq := v_seq + 1;
    v_attempt := v_attempt + 1;
  END LOOP;

  NEW.quote_number := v_candidate;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_quote_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_quote_number_trg
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.set_quote_number();