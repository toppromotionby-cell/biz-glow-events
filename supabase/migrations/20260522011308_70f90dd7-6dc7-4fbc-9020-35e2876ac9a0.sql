CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  client text,
  event_type text,
  event_date date,
  location text,
  guests_count integer,
  summary text,
  description text,
  cover_url text,
  photo_urls text[] DEFAULT ARRAY[]::text[],
  video_urls text[] DEFAULT ARRAY[]::text[],
  services_used text[] DEFAULT ARRAY[]::text[],
  metrics jsonb DEFAULT '{}'::jsonb,
  seo_title text,
  seo_description text,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published cases"
ON public.cases FOR SELECT
TO public
USING (published = true);

CREATE POLICY "Editors manage cases"
ON public.cases FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'content_editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'content_editor'::app_role));

CREATE TRIGGER cases_touch_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cases_published_date ON public.cases (published, event_date DESC);
CREATE INDEX idx_cases_featured ON public.cases (featured) WHERE published = true;