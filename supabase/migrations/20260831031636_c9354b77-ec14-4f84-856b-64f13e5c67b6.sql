-- 1. Убираем обсуждения
DROP TABLE IF EXISTS public.dj_comments CASCADE;
DROP TABLE IF EXISTS public.dj_threads CASCADE;

-- 2. Категории
CREATE TABLE public.dj_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  sort_order integer NOT NULL DEFAULT 100,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_categories TO authenticated;
GRANT ALL ON public.dj_categories TO service_role;

ALTER TABLE public.dj_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dj_categories_read_members" ON public.dj_categories
  FOR SELECT TO authenticated
  USING (public.dj_is_member(auth.uid()));

CREATE POLICY "dj_categories_manage" ON public.dj_categories
  FOR ALL TO authenticated
  USING (public.dj_can_manage(auth.uid()))
  WITH CHECK (public.dj_can_manage(auth.uid()));

CREATE TRIGGER dj_categories_touch BEFORE UPDATE ON public.dj_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX dj_categories_section_idx ON public.dj_categories (section, sort_order);

-- 3. Треки: метаданные, дедупликация, иерархия
ALTER TABLE public.dj_tracks
  ADD COLUMN IF NOT EXISTS album text,
  ADD COLUMN IF NOT EXISTS bitrate_kbps integer,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS work_key text,
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'music',
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.dj_categories(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dj_tracks_content_hash_uidx ON public.dj_tracks (content_hash) WHERE content_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dj_tracks_dedupe_key_uidx ON public.dj_tracks (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS dj_tracks_work_key_idx ON public.dj_tracks (work_key);
CREATE INDEX IF NOT EXISTS dj_tracks_section_idx ON public.dj_tracks (section, category_id);

-- 4. Софт
ALTER TABLE public.dj_software
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.dj_categories(id) ON DELETE SET NULL;

ALTER TABLE public.dj_software_versions
  ADD COLUMN IF NOT EXISTS build_name text,
  ADD COLUMN IF NOT EXISTS arch text,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS dj_software_versions_hash_uidx
  ON public.dj_software_versions (content_hash) WHERE content_hash IS NOT NULL;

-- 5. Стартовые категории
INSERT INTO public.dj_categories (section, slug, name, icon, color, sort_order) VALUES
  ('music','dance','Танцевальное','Disc3','#ff6a00',10),
  ('music','slow','Медляки','Heart','#e0559c',20),
  ('music','russian','Русское','Flag','#3aa0ff',30),
  ('music','retro','Ретро','Radio','#a06bff',40),
  ('music','folk','Народное','Music4','#4ec9a0',50),
  ('music','kids','Детское','Baby','#ffc93c',60),
  ('jingles','stingers','Отбивки','Zap','#ff8c1a',10),
  ('jingles','logos','Логотипы и джинглы','BadgeCheck','#ff6a00',20),
  ('jingles','transitions','Переходы','Shuffle','#7c5cff',30),
  ('jingles','drums','Барабанные сбивки','Drum','#ff4d4d',40),
  ('host','speech','Фоны под речь','Mic','#3aa0ff',10),
  ('host','quiz','Викторины','HelpCircle','#4ec9a0',20),
  ('host','games','Конкурсы','Gamepad2','#ffc93c',30),
  ('host','toasts','Тосты','Wine','#e0559c',40),
  ('host','ceremony','Церемонии','Sparkles','#a06bff',50),
  ('samples','drums','Ударные','Drumstick','#ff6a00',10),
  ('samples','fx','FX и свуши','Wind','#3aa0ff',20),
  ('samples','vocal','Голосовые','Mic2','#e0559c',30),
  ('samples','atmo','Атмосферы','CloudFog','#7c5cff',40),
  ('inout','couple','Выход молодых','HeartHandshake','#e0559c',10),
  ('inout','firstdance','Первый танец','Music2','#a06bff',20),
  ('inout','final','Финал','Flag','#ff6a00',30),
  ('inout','award','Награждение','Trophy','#ffc93c',40),
  ('welcome','welcome','Welcome-фоны','DoorOpen','#4ec9a0',10),
  ('welcome','lounge','Лаунж','Sofa','#7c5cff',20),
  ('welcome','dinner','Ужин','UtensilsCrossed','#ff8c1a',30),
  ('welcome','fourchette','Фуршет','Martini','#3aa0ff',40),
  ('show','fire','Файер-шоу','Flame','#ff4d4d',10),
  ('show','artists','Артисты','Star','#ffc93c',20),
  ('show','dance','Танцевальные номера','PartyPopper','#e0559c',30),
  ('software','dj','DJ-софт','Disc','#ff6a00',10),
  ('software','daw','DAW и редакторы','AudioWaveform','#3aa0ff',20),
  ('software','plugin','Плагины и VST','Puzzle','#7c5cff',30),
  ('software','library','Библиотеки и сэмплы','Library','#4ec9a0',40),
  ('software','video','Видео и визуал','Video','#e0559c',50),
  ('software','utility','Утилиты','Wrench','#94a3b8',60)
ON CONFLICT (slug) DO NOTHING;