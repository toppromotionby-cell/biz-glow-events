-- 1. Форматы мероприятий -----------------------------------------------------
CREATE TABLE public.dj_event_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  hint text,
  icon text,
  subtags text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 100,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dj_event_formats TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dj_event_formats TO authenticated;
GRANT ALL ON public.dj_event_formats TO service_role;
ALTER TABLE public.dj_event_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_formats_read" ON public.dj_event_formats FOR SELECT TO authenticated USING (public.dj_is_member(auth.uid()));
CREATE POLICY "dj_formats_write" ON public.dj_event_formats FOR ALL TO authenticated USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_event_formats_touch BEFORE UPDATE ON public.dj_event_formats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.dj_track_formats (
  track_id uuid NOT NULL REFERENCES public.dj_tracks(id) ON DELETE CASCADE,
  format_id uuid NOT NULL REFERENCES public.dj_event_formats(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, format_id)
);
GRANT SELECT, INSERT, DELETE ON public.dj_track_formats TO authenticated;
GRANT ALL ON public.dj_track_formats TO service_role;
ALTER TABLE public.dj_track_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_track_formats_read" ON public.dj_track_formats FOR SELECT TO authenticated USING (public.dj_is_member(auth.uid()));
CREATE POLICY "dj_track_formats_write" ON public.dj_track_formats FOR ALL TO authenticated USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE INDEX dj_track_formats_format_idx ON public.dj_track_formats(format_id);

INSERT INTO public.dj_event_formats (slug, name, hint, icon, sort_order, subtags) VALUES
  ('wedding','Свадьба','Церемония, банкет, первый танец','HeartHandshake',10,'{}'),
  ('birthday','День рождения и юбилей','Именинник, торт, поздравления','Cake',20,'{}'),
  ('corporate','Корпоратив','Компании, тимбилдинг, награждение','Briefcase',30,'{}'),
  ('newyear','Новый год и Рождество','Ёлка, куранты, зимние хиты','TreePine',40,'{}'),
  ('march8','8 Марта','Женский праздник','Flower2',50,'{}'),
  ('feb23','23 Февраля','Мужской праздник','Shield',60,'{}'),
  ('graduation','Выпускной и школьное','Школа, вуз, последний звонок','GraduationCap',70,'{}'),
  ('kids','Детский праздник','Аниматоры, игры, мультхиты','Baby',80,'{}'),
  ('themed','Тематическая вечеринка','Гэтсби, Хэллоуин, неон и другие','PartyPopper',90,
    '{"Гэтсби","Мафия","Гавайская","Хэллоуин","Диско 80-х","Стиляги","Неон / UV","Кино и супергерои","Casino","Пижамная"}'),
  ('openair','Городское и open-air','Площади, фестивали, улица','Tent',100,'{}');

-- 2. Новые категории ---------------------------------------------------------
INSERT INTO public.dj_categories (section, slug, name, icon, color, sort_order) VALUES
  ('music','foreign','Зарубежное','Globe','#ff8c1a',35),
  ('music','zeroes','Нулевые','Disc','#ff6a00',45),
  ('music','modern','Современные хиты','Sparkles','#ffb04a',48),
  ('music','shanson','Шансон','Guitar','#e08a3c',52),
  ('music','poprock','Поп-рок','Music','#ff7a2f',55),
  ('music','latina','Латина','Sun','#ffa640',58),
  ('music','house','Хаус и клубное','Waves','#ff6a00',62),
  ('music','hiphop','Хип-хоп и R&B','Mic','#e0761f',64),
  ('music','caucasus','Кавказское','Mountain','#f09030',66),
  ('music','lyric','Лирика и романтика','Heart','#ffb26b',68),
  ('music','instrumental','Инструментал и фон','Piano','#d9873a',70),
  ('music','newyear','Новогоднее','Snowflake','#ffc06a',72),
  ('family','hearth','Семейный очаг','Flame','#ff8c1a',10),
  ('family','dance-mom','Танец с мамой','Heart','#ffa640',20),
  ('family','dance-dad','Танец с папой','Heart','#f09030',30),
  ('family','blessing','Благословение и каравай','Wheat','#ffb26b',40),
  ('family','candles','Свечи и таинство','Flame','#ffc06a',50),
  ('family','vows','Клятвы и кольца','Gem','#ff7a2f',60),
  ('family','parents','Поздравления родителей','Users','#e08a3c',70),
  ('family','anniversary','Юбилейные и памятные','Award','#ff6a00',80),
  ('family','silence','Минута молчания','Pause','#c98a4a',90),
  ('family','final-song','Финальная песня','Music2','#ffb04a',100),
  ('inout','birthday-entry','Выход именинника','PartyPopper','#ffb04a',15),
  ('inout','bouquet','Бросание букета и подвязки','Flower','#ffa640',25),
  ('inout','cake','Вынос и разрезание торта','Cake','#ff8c1a',28),
  ('inout','fireworks','Салют и конфетти','Sparkles','#ff6a00',35),
  ('inout','farewell','Проводы гостей','DoorOpen','#e08a3c',50),
  ('host','auction','Аукцион','Gavel','#ffb26b',60),
  ('host','interactive','Интерактивы с залом','Users','#ff8c1a',70),
  ('host','timing','Тайминг-паузы','Timer','#d9873a',80),
  ('host','drama','Драматичные подложки','CloudLightning','#e0761f',90),
  ('host','comedy','Комедийные подложки','Laugh','#ffc06a',100),
  ('jingles','fanfare','Фанфары','Trumpet','#ff8c1a',50),
  ('jingles','applause','Аплодисменты и смех','Hand','#ffb04a',60),
  ('jingles','roll','Барабанная дробь','Drum','#ff6a00',70),
  ('jingles','tension','Интригующие стингеры','Zap','#e0761f',80),
  ('jingles','victory','Победные акценты','Trophy','#ffc06a',90),
  ('jingles','countdown','Обратный отсчёт','Timer','#f09030',100),
  ('samples','impacts','Импакты и удары','Hammer','#ff6a00',50),
  ('samples','risers','Ризеры и даунлифтеры','TrendingUp','#ff8c1a',60),
  ('samples','household','Бытовые звуки','Home','#d9873a',70),
  ('samples','nature','Природа','Trees','#ffb26b',80),
  ('samples','techno-fx','Техно-эффекты','Cpu','#e0761f',90),
  ('welcome','jazz','Джаз и босса','Music3','#ffb04a',50),
  ('welcome','coffee','Кофе-брейк','Coffee','#d9873a',60),
  ('welcome','photozone','Фотозона','Camera','#ffa640',70),
  ('welcome','covers','Инструментальные каверы','Guitar','#f09030',80),
  ('show','drums','Барабанное шоу','Drum','#ff6a00',40),
  ('show','light','Свет и лазер','Lightbulb','#ffc06a',50),
  ('show','cryo','Криошоу и спецэффекты','Snowflake','#ffb26b',60),
  ('show','circus','Цирк и иллюзион','Wand2','#e08a3c',70),
  ('show','anima','Детская анимация','Baby','#ffb04a',80),
  ('club','club-sets','Клубные сеты','Disc3','#ff6a00',10),
  ('club','deep-lounge','Дип-хаус и лаунж-бар','Waves','#ffa640',20),
  ('club','techno','Техно и тек-хаус','Cpu','#e0761f',30),
  ('club','afro-latin','Афро и латина-хаус','Sun','#ffb26b',40),
  ('club','hiphop-night','Hip-Hop / R&B night','Mic','#f09030',50),
  ('club','mashups','Ремиксы и мэшапы','Shuffle','#ff8c1a',60),
  ('club','retro-party','Ретро-вечеринка','Radio','#ffc06a',70),
  ('club','warmup','Warm-up (ранний час)','Sunrise','#d9873a',80),
  ('club','peaktime','Peak-time (пик)','Flame','#ff6a00',90),
  ('club','closing','Closing (закрытие)','Sunset','#e08a3c',100),
  ('club','bootlegs','Bootleg и эдиты','Scissors','#ffb04a',110),
  ('club','karaoke','Караоке-минусовки','Mic2','#ffa640',120)
ON CONFLICT DO NOTHING;

-- 3. Автогигиена -------------------------------------------------------------
ALTER TABLE public.dj_tracks
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lifecycle_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS keep_forever boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_purged_at timestamptz;
CREATE INDEX IF NOT EXISTS dj_tracks_lifecycle_idx ON public.dj_tracks(lifecycle_status, last_activity_at);

CREATE TABLE public.dj_hygiene_settings (
  id integer PRIMARY KEY DEFAULT 1,
  min_tracks_per_block integer NOT NULL DEFAULT 3,
  block_fresh_days integer NOT NULL DEFAULT 180,
  dormant_after_days integer NOT NULL DEFAULT 365,
  archive_after_days integer NOT NULL DEFAULT 90,
  purge_after_days integer NOT NULL DEFAULT 180,
  protect_recent_days integer NOT NULL DEFAULT 30,
  notify_before_days integer NOT NULL DEFAULT 7,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_hygiene_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.dj_hygiene_settings TO authenticated;
GRANT ALL ON public.dj_hygiene_settings TO service_role;
ALTER TABLE public.dj_hygiene_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_hygiene_settings_manage" ON public.dj_hygiene_settings FOR ALL TO authenticated
  USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_hygiene_settings_touch BEFORE UPDATE ON public.dj_hygiene_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.dj_hygiene_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.dj_hygiene_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid,
  track_label text,
  action text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  bytes_freed bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dj_hygiene_log TO authenticated;
GRANT ALL ON public.dj_hygiene_log TO service_role;
ALTER TABLE public.dj_hygiene_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_hygiene_log_read" ON public.dj_hygiene_log FOR SELECT TO authenticated USING (public.dj_can_manage(auth.uid()));
CREATE INDEX dj_hygiene_log_created_idx ON public.dj_hygiene_log(created_at DESC);

-- 4. Топ-пачки (только главный админ) ----------------------------------------
CREATE TABLE public.dj_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  scope_kind text NOT NULL DEFAULT 'overall',
  scope_key text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  track_count integer NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text,
  error text,
  built_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_packs TO authenticated;
GRANT ALL ON public.dj_packs TO service_role;
ALTER TABLE public.dj_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_packs_admin_only" ON public.dj_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER dj_packs_touch BEFORE UPDATE ON public.dj_packs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX dj_packs_period_scope_idx ON public.dj_packs(period_start, period_end, scope_kind, coalesce(scope_key, ''));

CREATE TABLE public.dj_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.dj_packs(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.dj_tracks(id) ON DELETE SET NULL,
  position integer NOT NULL,
  label text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  downloads integer NOT NULL DEFAULT 0,
  plays integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_pack_items TO authenticated;
GRANT ALL ON public.dj_pack_items TO service_role;
ALTER TABLE public.dj_pack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_pack_items_admin_only" ON public.dj_pack_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX dj_pack_items_pack_idx ON public.dj_pack_items(pack_id, position);