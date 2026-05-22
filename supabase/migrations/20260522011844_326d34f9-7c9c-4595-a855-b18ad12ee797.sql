
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_company text,
  client_role text,
  client_photo_url text,
  rating int NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  text text NOT NULL,
  event_date date,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published testimonials viewable by everyone"
ON public.testimonials FOR SELECT
USING (published = true);

CREATE POLICY "Staff can view all testimonials"
ON public.testimonials FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can insert testimonials"
ON public.testimonials FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'));

CREATE POLICY "Staff can update testimonials"
ON public.testimonials FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'));

CREATE POLICY "Admins can delete testimonials"
ON public.testimonials FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_testimonials_updated_at
BEFORE UPDATE ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_testimonials_published ON public.testimonials(published, sort_order DESC, created_at DESC);
CREATE INDEX idx_testimonials_case ON public.testimonials(case_id);
