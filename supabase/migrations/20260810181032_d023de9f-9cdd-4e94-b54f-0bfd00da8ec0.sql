CREATE TABLE public.presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Новая презентация',
  company_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  template text NOT NULL DEFAULT 'light',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;
GRANT ALL ON public.presentations TO service_role;

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage presentations"
ON public.presentations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.presentation_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'text',
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  image_url text,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  entity_type text,
  entity_id uuid,
  quote_item_id uuid,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX presentation_slides_presentation_id_idx ON public.presentation_slides (presentation_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_slides TO authenticated;
GRANT ALL ON public.presentation_slides TO service_role;

ALTER TABLE public.presentation_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage presentation slides"
ON public.presentation_slides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER presentations_touch_updated_at
BEFORE UPDATE ON public.presentations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER presentation_slides_touch_updated_at
BEFORE UPDATE ON public.presentation_slides
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();