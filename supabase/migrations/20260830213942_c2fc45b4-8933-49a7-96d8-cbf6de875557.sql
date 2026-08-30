create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid references public.company_profiles(id) on delete set null,
  tab_number text not null default '',
  full_name text not null,
  short_name text not null default '',
  position text not null default '',
  position_code text not null default '',
  unit text not null default 'Основное',
  tariff numeric not null default 0,
  raise_pct numeric not null default 0,
  rate numeric not null default 1,
  hired_on date,
  fired_on date,
  is_active boolean not null default true,
  sort_order int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employees TO authenticated;
GRANT ALL ON public.hr_employees TO service_role;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage hr employees" ON public.hr_employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER hr_employees_touch BEFORE UPDATE ON public.hr_employees FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX hr_employees_company_idx ON public.hr_employees (company_profile_id);