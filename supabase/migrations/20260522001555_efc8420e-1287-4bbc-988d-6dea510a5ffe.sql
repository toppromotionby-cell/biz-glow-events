
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','manager','content_editor','marketer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  consent_pd BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company, phone, email, consent_pd)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'company',
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'consent_pd')::boolean, false)
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATALOGS
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  short_description TEXT,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  requirements TEXT,
  faq JSONB DEFAULT '[]'::jsonb,
  pricing JSONB DEFAULT '{}'::jsonb,
  photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  video_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  seo_title TEXT,
  seo_description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (array_length(photo_urls, 1) IS NULL OR array_length(photo_urls, 1) <= 5),
  CHECK (array_length(video_urls, 1) IS NULL OR array_length(video_urls, 1) <= 5)
);
CREATE TABLE public.tech_equipment (LIKE public.zones INCLUDING ALL);
CREATE TABLE public.services (LIKE public.zones INCLUDING ALL);
CREATE TABLE public.production_items (LIKE public.zones INCLUDING ALL);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['zones','tech_equipment','services','production_items']
  LOOP
    EXECUTE format('CREATE POLICY "Public reads published %1$s" ON public.%1$s FOR SELECT USING (published = true)', t);
    EXECUTE format('CREATE POLICY "Editors manage %1$s" ON public.%1$s FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''content_editor''))', t);
  END LOOP;
END $$;

-- ORDERS / CRM
CREATE TYPE public.order_status AS ENUM ('new','consultation','estimate','contract','in_progress','completed','paid','cancelled');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_company TEXT,
  event_date DATE,
  status order_status NOT NULL DEFAULT 'new',
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total NUMERIC(12,2) DEFAULT 0,
  paid NUMERIC(12,2) DEFAULT 0,
  source TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  title TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Staff manage order items" ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.order_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage timeline" ON public.order_timeline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- AVAILABILITY
CREATE TYPE public.availability_status AS ENUM ('available','booked','maintenance');
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status availability_status NOT NULL DEFAULT 'booked',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  EXCLUDE USING gist (
    item_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status <> 'available')
);
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads availability" ON public.availability FOR SELECT USING (true);
CREATE POLICY "Staff manage availability" ON public.availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- MARKETING
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT,
  budget NUMERIC(12,2) DEFAULT 0,
  goal_conversions INT DEFAULT 0,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketers manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketer'));

CREATE TABLE public.marketing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketers read logs" ON public.marketing_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketer'));
CREATE POLICY "Anyone inserts logs" ON public.marketing_logs FOR INSERT WITH CHECK (true);

-- TELEGRAM LOGS
CREATE TABLE public.telegram_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  http_code INT,
  payload JSONB,
  error TEXT,
  retried_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view telegram logs" ON public.telegram_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('media','media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media');
CREATE POLICY "Editors upload media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor')));
CREATE POLICY "Editors update media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor')));
CREATE POLICY "Editors delete media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor')));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','zones','tech_equipment','services','production_items','orders']
  LOOP
    EXECUTE format('CREATE TRIGGER touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;
