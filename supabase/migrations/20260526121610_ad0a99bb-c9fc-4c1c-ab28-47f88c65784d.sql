INSERT INTO public.production_items (slug, title, short_description, description, category, photo_urls, published, sort_order)
VALUES
  ('decor-arch', 'Арки и фотостены', 'ЧПУ-резка, печать, монтаж на объекте.', 'ЧПУ-резка, печать, монтаж на объекте.', 'Декор', ARRAY['https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&q=80'], true, 10),
  ('stage-construction', 'Сценические конструкции', 'Сцены, подиумы, фермы, рампы под нагрузку.', 'Сцены, подиумы, фермы, рампы под нагрузку.', 'Конструкции', ARRAY['https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&q=80'], true, 20),
  ('props-custom', 'Реквизит и арт-объекты', 'От 3D-печати до крупногабаритных инсталляций.', 'От 3D-печати до крупногабаритных инсталляций.', 'Реквизит', ARRAY['https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=1200&q=80'], true, 30),
  ('branding-print', 'Брендирование и печать', 'Баннеры, пресс-воллы, наклейки, флаги.', 'Баннеры, пресс-воллы, наклейки, флаги.', 'Печать', ARRAY['https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1200&q=80'], true, 40)
ON CONFLICT (slug) DO NOTHING;