-- Directions
CREATE TABLE public.calendar_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  google_color_id text,
  emoji text,
  keywords text[] NOT NULL DEFAULT '{}',
  work_start time NOT NULL DEFAULT '09:00',
  work_end time NOT NULL DEFAULT '19:00',
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_directions TO authenticated;
GRANT ALL ON public.calendar_directions TO service_role;
ALTER TABLE public.calendar_directions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage directions" ON public.calendar_directions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER calendar_directions_touch BEFORE UPDATE ON public.calendar_directions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Items
CREATE TABLE public.calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'meeting',
  title text NOT NULL,
  notes text,
  direction_id uuid REFERENCES public.calendar_directions(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  due_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  tz text NOT NULL DEFAULT 'Europe/Minsk',
  status text NOT NULL DEFAULT 'planned',
  importance text NOT NULL DEFAULT 'normal',
  location text,
  participants text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'web',
  google_event_id text,
  google_task_id text,
  google_etag text,
  google_updated_at timestamptz,
  reschedule_count int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_items_kind_chk CHECK (kind IN ('task','meeting')),
  CONSTRAINT calendar_items_status_chk CHECK (status IN ('planned','in_progress','done','canceled')),
  CONSTRAINT calendar_items_importance_chk CHECK (importance IN ('normal','hard'))
);
CREATE UNIQUE INDEX calendar_items_google_event_uq ON public.calendar_items (google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX calendar_items_starts_idx ON public.calendar_items (starts_at);
CREATE INDEX calendar_items_status_idx ON public.calendar_items (status, kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_items TO authenticated;
GRANT ALL ON public.calendar_items TO service_role;
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage items" ON public.calendar_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER calendar_items_touch BEFORE UPDATE ON public.calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reminders
CREATE TABLE public.calendar_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  kind text NOT NULL,
  fire_at timestamptz NOT NULL,
  sent_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_reminders_kind_chk CHECK (kind IN ('before','followup','digest_morning','digest_evening','weekly'))
);
CREATE INDEX calendar_reminders_due_idx ON public.calendar_reminders (fire_at) WHERE sent_at IS NULL;
CREATE UNIQUE INDEX calendar_reminders_uq ON public.calendar_reminders (item_id, kind, fire_at) WHERE item_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_reminders TO authenticated;
GRANT ALL ON public.calendar_reminders TO service_role;
ALTER TABLE public.calendar_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage reminders" ON public.calendar_reminders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Inbox
CREATE TABLE public.calendar_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'telegram',
  raw_text text,
  transcript text,
  parsed jsonb,
  status text NOT NULL DEFAULT 'pending',
  question text,
  tg_chat_id bigint,
  tg_message_id bigint,
  item_id uuid REFERENCES public.calendar_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_inbox_status_chk CHECK (status IN ('pending','needs_info','confirmed','rejected'))
);
CREATE INDEX calendar_inbox_status_idx ON public.calendar_inbox (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_inbox TO authenticated;
GRANT ALL ON public.calendar_inbox TO service_role;
ALTER TABLE public.calendar_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage inbox" ON public.calendar_inbox FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER calendar_inbox_touch BEFORE UPDATE ON public.calendar_inbox
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sync state (singleton)
CREATE TABLE public.calendar_sync_state (
  id int PRIMARY KEY DEFAULT 1,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  sync_token text,
  last_pull_at timestamptz,
  lease_until timestamptz,
  paused_reason text,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_sync_state_single CHECK (id = 1)
);
GRANT SELECT ON public.calendar_sync_state TO authenticated;
GRANT ALL ON public.calendar_sync_state TO service_role;
ALTER TABLE public.calendar_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sync state" ON public.calendar_sync_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER calendar_sync_state_touch BEFORE UPDATE ON public.calendar_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.calendar_sync_state (id) VALUES (1);

-- Assistant prefs (singleton)
CREATE TABLE public.assistant_prefs (
  id int PRIMARY KEY DEFAULT 1,
  tz text NOT NULL DEFAULT 'Europe/Minsk',
  tg_chat_id bigint,
  morning_time time NOT NULL DEFAULT '08:00',
  evening_time time NOT NULL DEFAULT '20:00',
  quiet_start time NOT NULL DEFAULT '23:00',
  quiet_end time NOT NULL DEFAULT '07:30',
  reminder_minutes int[] NOT NULL DEFAULT '{60,15}',
  hard_reminder_minutes int[] NOT NULL DEFAULT '{120,60,15}',
  followup_minutes int NOT NULL DEFAULT 30,
  style_profile text,
  last_device_tz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_prefs_single CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.assistant_prefs TO authenticated;
GRANT ALL ON public.assistant_prefs TO service_role;
ALTER TABLE public.assistant_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage prefs" ON public.assistant_prefs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER assistant_prefs_touch BEFORE UPDATE ON public.assistant_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.assistant_prefs (id) VALUES (1);

-- Seed directions
INSERT INTO public.calendar_directions (key, title, color, google_color_id, emoji, keywords, sort) VALUES
  ('personal', 'Личное', '#64748b', '8', '🏠', ARRAY['личное','семья','врач','дом','отпуск'], 1),
  ('belight', 'Belight', '#f59e0b', '6', '💡', ARRAY['belight','белайт'], 2),
  ('eventhub', 'EventHub', '#2563eb', '9', '🎪', ARRAY['eventhub','ивентхаб','event hub','эвентхаб'], 3),
  ('toppromotion', 'Top Promotion', '#16a34a', '10', '🚀', ARRAY['top promotion','топ промоушн','топпромоушн','топ'], 4);