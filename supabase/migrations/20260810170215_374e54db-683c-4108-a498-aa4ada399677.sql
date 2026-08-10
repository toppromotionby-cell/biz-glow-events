CREATE TABLE public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  company_legal_name text NOT NULL DEFAULT '',
  company_brand text NOT NULL DEFAULT '',
  company_unp text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  company_email text NOT NULL DEFAULT '',
  company_website text NOT NULL DEFAULT '',
  logo_url text,
  signature_url text,
  stamp_url text,
  logo_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  accent_color text NOT NULL DEFAULT '#FF7500',
  bank_name text NOT NULL DEFAULT '',
  bank_bic text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  signer_name text NOT NULL DEFAULT '',
  signer_title text NOT NULL DEFAULT '',
  signer_basis text NOT NULL DEFAULT '',
  vat_mode text NOT NULL DEFAULT 'none',
  vat_rate numeric NOT NULL DEFAULT 20,
  vat_as_line boolean NOT NULL DEFAULT false,
  vat_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profiles TO authenticated;
GRANT ALL ON public.company_profiles TO service_role;

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view company profiles"
  ON public.company_profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'accountant')
    OR public.has_role(auth.uid(), 'content_editor')
  );

CREATE POLICY "Admins and accountants can manage company profiles"
  ON public.company_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE TRIGGER company_profiles_touch_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE UNIQUE INDEX company_profiles_single_default
  ON public.company_profiles (is_default) WHERE is_default;

INSERT INTO public.company_profiles (
  name, is_default, sort_order,
  company_legal_name, company_brand, company_unp, company_address,
  company_phone, company_email, company_website,
  logo_url, logo_layout, accent_color,
  bank_name, bank_bic, bank_account,
  signer_name, signer_title, signer_basis,
  vat_mode, vat_rate, vat_as_line, vat_note
)
SELECT
  COALESCE(NULLIF(s.company_brand, ''), NULLIF(s.company_legal_name, ''), 'Основная компания'),
  true, 0,
  s.company_legal_name, s.company_brand, s.company_unp, s.company_address,
  s.company_phone, s.company_email, s.company_website,
  s.logo_url, s.logo_layout, s.accent_color,
  s.bank_name, s.bank_bic, s.bank_account,
  s.signer_name, s.signer_title, s.signer_basis,
  s.vat_mode, s.vat_rate, s.vat_as_line, s.vat_note
FROM public.document_settings s
WHERE s.singleton = true;

ALTER TABLE public.quotes ADD COLUMN company_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.promo_quotes ADD COLUMN company_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.finance_documents ADD COLUMN company_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL;