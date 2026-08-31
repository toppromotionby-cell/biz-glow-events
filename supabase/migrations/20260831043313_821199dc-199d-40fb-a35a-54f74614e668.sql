-- 1. Привязка Telegram-чатов к аккаунтам
CREATE TABLE public.dj_tg_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint NOT NULL UNIQUE,
  tg_username text,
  tg_first_name text,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_tg_links TO authenticated;
GRANT ALL ON public.dj_tg_links TO service_role;
ALTER TABLE public.dj_tg_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_tg_links own or admin" ON public.dj_tg_links FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.dj_can_manage(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_tg_links_touch BEFORE UPDATE ON public.dj_tg_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Одноразовые коды привязки
CREATE TABLE public.dj_tg_link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_tg_link_codes TO authenticated;
GRANT ALL ON public.dj_tg_link_codes TO service_role;
ALTER TABLE public.dj_tg_link_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_tg_link_codes own" ON public.dj_tg_link_codes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.dj_tg_validate_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Срок действия кода должен быть в будущем';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dj_tg_link_codes_validate BEFORE INSERT ON public.dj_tg_link_codes
  FOR EACH ROW EXECUTE FUNCTION public.dj_tg_validate_code();

-- 3. Очередь исходящих сообщений
CREATE TABLE public.dj_tg_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  chat_id bigint,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  send_after timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dj_tg_outbox_pending_idx ON public.dj_tg_outbox (status, send_after);
GRANT SELECT ON public.dj_tg_outbox TO authenticated;
GRANT ALL ON public.dj_tg_outbox TO service_role;
ALTER TABLE public.dj_tg_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_tg_outbox admin read" ON public.dj_tg_outbox FOR SELECT TO authenticated
  USING (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_tg_outbox_touch BEFORE UPDATE ON public.dj_tg_outbox
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Дедупликация обновлений Telegram
CREATE TABLE public.dj_tg_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dj_tg_updates TO service_role;
ALTER TABLE public.dj_tg_updates ENABLE ROW LEVEL SECURITY;

-- 5. Настройки бота
CREATE TABLE public.dj_tg_settings (
  id integer PRIMARY KEY DEFAULT 1,
  group_chat_id bigint,
  admin_chat_id bigint,
  notify_applications boolean NOT NULL DEFAULT true,
  notify_tracks boolean NOT NULL DEFAULT true,
  notify_rejects boolean NOT NULL DEFAULT true,
  notify_digest boolean NOT NULL DEFAULT true,
  announce_publications boolean NOT NULL DEFAULT true,
  daily_digest_hour integer NOT NULL DEFAULT 10,
  weekly_digest_dow integer NOT NULL DEFAULT 1,
  last_daily_at timestamptz,
  last_weekly_at timestamptz,
  last_reject_digest_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_tg_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.dj_tg_settings TO authenticated;
GRANT ALL ON public.dj_tg_settings TO service_role;
ALTER TABLE public.dj_tg_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_tg_settings admin" ON public.dj_tg_settings FOR ALL TO authenticated
  USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_tg_settings_touch BEFORE UPDATE ON public.dj_tg_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.dj_tg_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;