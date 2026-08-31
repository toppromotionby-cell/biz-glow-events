
-- ===== настройки бота-помощника =====
CREATE TABLE public.assistant_bot_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  admin_chat_id bigint,
  allow_web_search boolean NOT NULL DEFAULT true,
  plan_only boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 200,
  hygiene_enabled boolean NOT NULL DEFAULT true,
  hygiene_hour smallint NOT NULL DEFAULT 9,
  hygiene_notify boolean NOT NULL DEFAULT true,
  last_hygiene_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_bot_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.assistant_bot_settings TO authenticated;
GRANT ALL ON public.assistant_bot_settings TO service_role;
ALTER TABLE public.assistant_bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant settings staff" ON public.assistant_bot_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
INSERT INTO public.assistant_bot_settings (id) VALUES (1);

-- ===== привязки чатов =====
CREATE TABLE public.assistant_bot_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL UNIQUE,
  tg_username text,
  tg_first_name text,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_bot_links TO authenticated;
GRANT ALL ON public.assistant_bot_links TO service_role;
ALTER TABLE public.assistant_bot_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant links own or staff" ON public.assistant_bot_links FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ===== коды привязки =====
CREATE TABLE public.assistant_bot_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assistant_bot_codes TO authenticated;
GRANT ALL ON public.assistant_bot_codes TO service_role;
ALTER TABLE public.assistant_bot_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant codes own" ON public.assistant_bot_codes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.assistant_validate_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Срок действия кода должен быть в будущем';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assistant_codes_validate BEFORE INSERT ON public.assistant_bot_codes
  FOR EACH ROW EXECUTE FUNCTION public.assistant_validate_code();

-- ===== дедупликация апдейтов =====
CREATE TABLE public.assistant_bot_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.assistant_bot_updates TO service_role;
ALTER TABLE public.assistant_bot_updates ENABLE ROW LEVEL SECURITY;

-- ===== журнал диалога =====
CREATE TABLE public.assistant_bot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  kind text NOT NULL DEFAULT 'text',
  text text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_bot_messages_chat_idx ON public.assistant_bot_messages (chat_id, created_at DESC);
GRANT SELECT ON public.assistant_bot_messages TO authenticated;
GRANT ALL ON public.assistant_bot_messages TO service_role;
ALTER TABLE public.assistant_bot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant messages staff read" ON public.assistant_bot_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR user_id = auth.uid());

-- ===== аудит выдачи файлов =====
CREATE TABLE public.assistant_file_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  chat_id bigint,
  kind text NOT NULL,
  doc_id uuid,
  filename text,
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_file_grants_created_idx ON public.assistant_file_grants (created_at DESC);
GRANT SELECT ON public.assistant_file_grants TO authenticated;
GRANT ALL ON public.assistant_file_grants TO service_role;
ALTER TABLE public.assistant_file_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant grants staff read" ON public.assistant_file_grants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR user_id = auth.uid());

-- ===== база знаний =====
CREATE TABLE public.knowledge_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  fact text NOT NULL,
  source_kind text NOT NULL DEFAULT 'manual',
  source_table text,
  source_id text,
  source_url text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confidence numeric NOT NULL DEFAULT 0.8,
  valid_until date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','conflict','archived')),
  tags text[] NOT NULL DEFAULT '{}',
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX knowledge_facts_dedup_idx ON public.knowledge_facts (scope, subject, md5(fact));
CREATE INDEX knowledge_facts_status_idx ON public.knowledge_facts (status, updated_at DESC);
CREATE INDEX knowledge_facts_source_idx ON public.knowledge_facts (source_table, source_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_facts TO authenticated;
GRANT ALL ON public.knowledge_facts TO service_role;
ALTER TABLE public.knowledge_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge facts staff" ON public.knowledge_facts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'content_editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'content_editor'));
CREATE TRIGGER knowledge_facts_touch BEFORE UPDATE ON public.knowledge_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== правила гигиены =====
CREATE TABLE public.hygiene_rules (
  key text PRIMARY KEY,
  title text NOT NULL,
  area text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  schedule text NOT NULL DEFAULT 'daily' CHECK (schedule IN ('daily','weekly')),
  auto_fix boolean NOT NULL DEFAULT false,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.hygiene_rules TO authenticated;
GRANT ALL ON public.hygiene_rules TO service_role;
ALTER TABLE public.hygiene_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hygiene rules staff" ON public.hygiene_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ===== находки гигиены =====
CREATE TABLE public.hygiene_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL,
  area text NOT NULL,
  entity_table text,
  entity_id text,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','auto_fixed','approved','dismissed','muted')),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hygiene_findings_unique_open ON public.hygiene_findings (rule_key, coalesce(entity_id,'-')) WHERE status = 'pending';
CREATE INDEX hygiene_findings_status_idx ON public.hygiene_findings (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hygiene_findings TO authenticated;
GRANT ALL ON public.hygiene_findings TO service_role;
ALTER TABLE public.hygiene_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hygiene findings staff" ON public.hygiene_findings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
