CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============ Контрагенты ============
CREATE TABLE public.doc_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_key text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  unp text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  contact_role text NOT NULL DEFAULT '',
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_contacts TO authenticated;
GRANT ALL ON public.doc_contacts TO service_role;
ALTER TABLE public.doc_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage doc contacts" ON public.doc_contacts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER doc_contacts_touch_updated_at BEFORE UPDATE ON public.doc_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX doc_contacts_name_trgm ON public.doc_contacts USING gin (name gin_trgm_ops);
CREATE INDEX doc_contacts_company_trgm ON public.doc_contacts USING gin (company gin_trgm_ops);

-- ============ Каталог позиций ============
CREATE TABLE public.doc_item_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_key text NOT NULL UNIQUE,
  section text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'шт',
  price numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  includes jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_item_catalog TO authenticated;
GRANT ALL ON public.doc_item_catalog TO service_role;
ALTER TABLE public.doc_item_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage doc item catalog" ON public.doc_item_catalog FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER doc_item_catalog_touch_updated_at BEFORE UPDATE ON public.doc_item_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX doc_item_catalog_title_trgm ON public.doc_item_catalog USING gin (title gin_trgm_ops);

-- ============ Текстовые заготовки ============
CREATE TABLE public.doc_text_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  match_key text NOT NULL,
  value text NOT NULL,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, match_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_text_snippets TO authenticated;
GRANT ALL ON public.doc_text_snippets TO service_role;
ALTER TABLE public.doc_text_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage doc text snippets" ON public.doc_text_snippets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER doc_text_snippets_touch_updated_at BEFORE UPDATE ON public.doc_text_snippets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX doc_text_snippets_value_trgm ON public.doc_text_snippets USING gin (value gin_trgm_ops);

-- ============ Первичное наполнение ============
INSERT INTO public.doc_contacts (match_key, name, company, unp, phone, email, address, usage_count, last_used_at)
SELECT key, max(name), max(company), max(unp), max(phone), max(email), max(address), count(*)::int, max(used)
FROM (
  SELECT
    coalesce(nullif(lower(trim(q.client_unp)), ''), nullif(lower(trim(q.client_email)), ''),
             nullif(lower(trim(q.client_phone)), ''), lower(trim(q.client_company || '|' || q.client_name))) AS key,
    trim(q.client_name) AS name, trim(q.client_company) AS company, trim(q.client_unp) AS unp,
    trim(q.client_phone) AS phone, trim(q.client_email) AS email, trim(q.client_address) AS address,
    q.updated_at AS used
  FROM public.quotes q
  WHERE trim(coalesce(q.client_name,'') || coalesce(q.client_company,'')) <> ''
  UNION ALL
  SELECT
    coalesce(nullif(lower(trim(o.client_email)), ''), nullif(lower(trim(o.client_phone)), ''),
             lower(trim(coalesce(o.client_company,'') || '|' || o.client_name))),
    trim(o.client_name), trim(coalesce(o.client_company,'')), '', trim(o.client_phone), trim(o.client_email), '',
    o.updated_at
  FROM public.orders o
  WHERE trim(coalesce(o.client_name,'')) <> ''
  UNION ALL
  SELECT
    coalesce(nullif(lower(trim(p.contact_email)), ''), nullif(lower(trim(p.contact_phone)), ''),
             lower(trim(p.client_name || '|' || p.contact_name))),
    trim(nullif(p.contact_name, '')), trim(p.client_name), '', trim(p.contact_phone), trim(p.contact_email), '',
    p.updated_at
  FROM public.promo_quotes p
  WHERE trim(coalesce(p.client_name,'')) <> ''
) s
WHERE key IS NOT NULL AND key <> '' AND key <> '|'
GROUP BY key
ON CONFLICT (match_key) DO NOTHING;

INSERT INTO public.doc_item_catalog (match_key, section, title, description, unit, price, cost, includes, usage_count, last_used_at)
SELECT key, max(section), max(title), max(description), max(unit), max(price), max(cost),
       (array_agg(includes ORDER BY used DESC))[1], count(*)::int, max(used)
FROM (
  SELECT lower(trim(qi.section)) || '|' || lower(trim(qi.title)) AS key,
         trim(qi.section) AS section, trim(qi.title) AS title, trim(qi.description) AS description,
         trim(qi.unit) AS unit, qi.price, qi.cost, qi.includes, qi.created_at AS used
  FROM public.quote_items qi WHERE trim(coalesce(qi.title,'')) <> ''
  UNION ALL
  SELECT lower(trim(pi.section)) || '|' || lower(trim(pi.title)),
         trim(pi.section), trim(pi.title), trim(pi.note), trim(pi.unit), pi.price, pi.cost, pi.includes, pi.created_at
  FROM public.promo_quote_items pi WHERE trim(coalesce(pi.title,'')) <> ''
) s
GROUP BY key
ON CONFLICT (match_key) DO NOTHING;

INSERT INTO public.doc_text_snippets (kind, match_key, value, usage_count, last_used_at)
SELECT kind, lower(trim(value)), max(trim(value)), count(*)::int, max(used)
FROM (
  SELECT 'venue' AS kind, venue AS value, updated_at AS used FROM public.quotes WHERE trim(coalesce(venue,'')) <> ''
  UNION ALL
  SELECT 'venue', venue, updated_at FROM public.promo_quotes WHERE trim(coalesce(venue,'')) <> ''
  UNION ALL
  SELECT 'event_format', event_format, updated_at FROM public.quotes WHERE trim(coalesce(event_format,'')) <> ''
  UNION ALL
  SELECT 'note', event_notes, updated_at FROM public.quotes WHERE trim(coalesce(event_notes,'')) <> ''
  UNION ALL
  SELECT 'note', setup_note, updated_at FROM public.quotes WHERE trim(coalesce(setup_note,'')) <> ''
  UNION ALL
  SELECT 'footer', footer_note, updated_at FROM public.promo_quotes WHERE trim(coalesce(footer_note,'')) <> ''
  UNION ALL
  SELECT 'section', section, created_at FROM public.quote_items WHERE trim(coalesce(section,'')) <> ''
  UNION ALL
  SELECT 'section', section, created_at FROM public.promo_quote_items WHERE trim(coalesce(section,'')) <> ''
) s
GROUP BY kind, lower(trim(value))
ON CONFLICT (kind, match_key) DO NOTHING;