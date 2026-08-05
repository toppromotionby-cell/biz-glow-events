CREATE TABLE public.promo_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  project text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  period text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_role text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  logo_url text,
  client_logo_url text,
  accent_color text NOT NULL DEFAULT '#F5A623',
  show_qty boolean NOT NULL DEFAULT true,
  show_total_qty boolean NOT NULL DEFAULT true,
  show_notes boolean NOT NULL DEFAULT true,
  vat_enabled boolean NOT NULL DEFAULT true,
  vat_rate numeric NOT NULL DEFAULT 20,
  commission_enabled boolean NOT NULL DEFAULT true,
  commission_rate numeric NOT NULL DEFAULT 10,
  commission_label text NOT NULL DEFAULT 'Комиссия агентства',
  management_enabled boolean NOT NULL DEFAULT false,
  management_amount numeric NOT NULL DEFAULT 0,
  management_label text NOT NULL DEFAULT 'Менеджмент',
  currency text NOT NULL DEFAULT 'BYN',
  footer_note text NOT NULL DEFAULT '',
  is_template boolean NOT NULL DEFAULT false,
  template_name text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_quotes TO authenticated;
GRANT ALL ON public.promo_quotes TO service_role;
ALTER TABLE public.promo_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage promo quotes" ON public.promo_quotes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.promo_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.promo_quotes(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'услуга',
  qty numeric NOT NULL DEFAULT 1,
  multiplier numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  exclude_from_commission boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_quote_items TO authenticated;
GRANT ALL ON public.promo_quote_items TO service_role;
ALTER TABLE public.promo_quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage promo quote items" ON public.promo_quote_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX promo_quote_items_quote_idx ON public.promo_quote_items(quote_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_promo_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date;
  v_seq int;
  v_attempt int := 0;
  v_candidate text;
  v_exists boolean;
BEGIN
  IF NEW.doc_number IS NOT NULL AND NEW.doc_number <> '' THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.created_at AT TIME ZONE 'Europe/Minsk')::date;

  SELECT count(*) INTO v_seq
    FROM public.promo_quotes
   WHERE (created_at AT TIME ZONE 'Europe/Minsk')::date = v_day;
  v_seq := v_seq + 1;

  LOOP
    v_candidate := to_char(v_day, 'DD/MM/YYYY') || '-' || lpad(v_seq::text, 2, '0');
    SELECT EXISTS(SELECT 1 FROM public.promo_quotes WHERE doc_number = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempt > 50;
    v_seq := v_seq + 1;
    v_attempt := v_attempt + 1;
  END LOOP;

  NEW.doc_number := v_candidate;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_promo_quote_number_trg BEFORE INSERT ON public.promo_quotes
FOR EACH ROW EXECUTE FUNCTION public.set_promo_quote_number();

CREATE TRIGGER promo_quotes_touch_updated_at BEFORE UPDATE ON public.promo_quotes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();