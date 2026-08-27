CREATE TABLE public.paperwork_templates (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid references public.company_profiles(id) on delete set null,
  category text not null default 'letters',
  doc_type text not null default 'letter',
  name text not null default 'Новый шаблон',
  description text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  background_url text,
  is_archived boolean not null default false,
  is_favorite boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperwork_templates TO authenticated;
GRANT ALL ON public.paperwork_templates TO service_role;
ALTER TABLE public.paperwork_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage paperwork templates" ON public.paperwork_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'content_editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'content_editor'));

CREATE TABLE public.paperwork_documents (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.paperwork_templates(id) on delete set null,
  company_profile_id uuid references public.company_profiles(id) on delete set null,
  doc_type text not null default 'letter',
  title text not null default 'Без названия',
  doc_number text not null default '',
  doc_date date not null default current_date,
  blocks jsonb not null default '[]'::jsonb,
  values jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  author_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperwork_documents TO authenticated;
GRANT ALL ON public.paperwork_documents TO service_role;
ALTER TABLE public.paperwork_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage paperwork documents" ON public.paperwork_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR author_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR author_id = auth.uid());

CREATE TABLE public.paperwork_brand_blanks (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null unique references public.company_profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperwork_brand_blanks TO authenticated;
GRANT ALL ON public.paperwork_brand_blanks TO service_role;
ALTER TABLE public.paperwork_brand_blanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage paperwork blanks" ON public.paperwork_brand_blanks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER paperwork_templates_touch BEFORE UPDATE ON public.paperwork_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER paperwork_documents_touch BEFORE UPDATE ON public.paperwork_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER paperwork_blanks_touch BEFORE UPDATE ON public.paperwork_brand_blanks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX paperwork_documents_updated_idx ON public.paperwork_documents (updated_at DESC);
CREATE INDEX paperwork_templates_category_idx ON public.paperwork_templates (category);