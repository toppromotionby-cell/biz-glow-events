CREATE TABLE public.paperwork_brand_kits (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  name text not null default 'Основной бланк',
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperwork_brand_kits TO authenticated;
GRANT ALL ON public.paperwork_brand_kits TO service_role;
ALTER TABLE public.paperwork_brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage paperwork brand kits" ON public.paperwork_brand_kits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER paperwork_brand_kits_touch BEFORE UPDATE ON public.paperwork_brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX paperwork_brand_kits_company_idx ON public.paperwork_brand_kits (company_profile_id);
CREATE UNIQUE INDEX paperwork_brand_kits_default_idx ON public.paperwork_brand_kits (company_profile_id) WHERE is_default;

INSERT INTO public.paperwork_brand_kits (company_profile_id, name, is_default, settings)
SELECT company_profile_id, 'Основной бланк', true, settings FROM public.paperwork_brand_blanks;

ALTER TABLE public.paperwork_templates
  ADD COLUMN IF NOT EXISTS variables_schema jsonb not null default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revision integer not null default 1;

ALTER TABLE public.paperwork_documents
  ADD COLUMN IF NOT EXISTS brand_kit_id uuid references public.paperwork_brand_kits(id) on delete set null,
  ADD COLUMN IF NOT EXISTS template_revision integer;

UPDATE public.paperwork_documents d
SET brand_kit_id = k.id
FROM public.paperwork_brand_kits k
WHERE d.company_profile_id = k.company_profile_id AND k.is_default AND d.brand_kit_id IS NULL;