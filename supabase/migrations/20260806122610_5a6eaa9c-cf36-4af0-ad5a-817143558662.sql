CREATE TABLE public.attractions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text,
  short_description text,
  description text,
  features jsonb,
  requirements text,
  faq jsonb,
  pricing jsonb,
  photo_urls text[],
  video_urls text[],
  seo_title text,
  seo_description text,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attractions TO authenticated;
GRANT ALL ON public.attractions TO service_role;

ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors manage attractions"
  ON public.attractions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'content_editor'::app_role));

CREATE TRIGGER touch_attractions
  BEFORE UPDATE ON public.attractions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX attractions_published_sort_idx ON public.attractions (published, sort_order);
CREATE INDEX attractions_category_idx ON public.attractions (category);

INSERT INTO public.catalog_categories (entity_type, name, sort_order) VALUES
  ('attractions', 'Тимбилдинг', 10),
  ('attractions', 'Эстафеты', 20),
  ('attractions', 'Спортивные', 30),
  ('attractions', 'Надувные / Мягкие', 40),
  ('attractions', 'Азартные', 50),
  ('attractions', 'Интерактивные', 60),
  ('attractions', 'Настольные', 70),
  ('attractions', 'Деревянные', 80),
  ('attractions', 'Головоломки', 90),
  ('attractions', 'Тиры', 100),
  ('attractions', 'Видеоигры', 110),
  ('attractions', 'Музыкальные', 120),
  ('attractions', 'РУ Модели', 130),
  ('attractions', 'Детские', 140),
  ('attractions', 'Фото развлечения', 150);