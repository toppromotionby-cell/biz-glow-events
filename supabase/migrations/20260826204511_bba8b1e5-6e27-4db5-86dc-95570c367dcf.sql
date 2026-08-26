CREATE TABLE public.presentation_brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stops jsonb NOT NULL DEFAULT '["#ffffff"]'::jsonb,
  angle integer NOT NULL DEFAULT 135,
  accent text NOT NULL DEFAULT '#c2410c',
  font text NOT NULL DEFAULT 'inherit',
  logo_url text,
  frame text NOT NULL DEFAULT 'none',
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_brand_kits TO authenticated;
GRANT ALL ON public.presentation_brand_kits TO service_role;

ALTER TABLE public.presentation_brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage presentation brand kits"
ON public.presentation_brand_kits
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS brand_kit jsonb;