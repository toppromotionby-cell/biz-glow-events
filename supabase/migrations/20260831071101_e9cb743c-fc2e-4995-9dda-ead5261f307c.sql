CREATE TABLE public.copilot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Новый диалог',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_sessions TO authenticated;
GRANT ALL ON public.copilot_sessions TO service_role;
ALTER TABLE public.copilot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_sessions_admin" ON public.copilot_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER copilot_sessions_touch BEFORE UPDATE ON public.copilot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX copilot_sessions_user_idx ON public.copilot_sessions (user_id, last_message_at DESC);

CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.copilot_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_messages_admin" ON public.copilot_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX copilot_messages_session_idx ON public.copilot_messages (session_id, created_at);

CREATE TABLE public.copilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.copilot_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','applied','rejected','failed','rolled_back','expired')),
  title text NOT NULL,
  summary text,
  request text,
  risk text NOT NULL DEFAULT 'write' CHECK (risk IN ('read','draft','write','destructive')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  result text,
  error text,
  decided_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_runs TO authenticated;
GRANT ALL ON public.copilot_runs TO service_role;
ALTER TABLE public.copilot_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_runs_admin" ON public.copilot_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER copilot_runs_touch BEFORE UPDATE ON public.copilot_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX copilot_runs_status_idx ON public.copilot_runs (status, created_at DESC);
CREATE INDEX copilot_runs_session_idx ON public.copilot_runs (session_id, created_at DESC);

CREATE TABLE public.copilot_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.copilot_runs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  tool text NOT NULL,
  target_table text,
  target_id text,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.copilot_audit TO authenticated;
GRANT ALL ON public.copilot_audit TO service_role;
ALTER TABLE public.copilot_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_audit_admin" ON public.copilot_audit FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX copilot_audit_run_idx ON public.copilot_audit (run_id, created_at);

CREATE TABLE public.copilot_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  speak_replies boolean NOT NULL DEFAULT true,
  voice_rate numeric NOT NULL DEFAULT 1.0,
  hands_free boolean NOT NULL DEFAULT false,
  allow_web_search boolean NOT NULL DEFAULT true,
  max_rows_per_run integer NOT NULL DEFAULT 50,
  max_emails_per_run integer NOT NULL DEFAULT 100,
  allow_destructive boolean NOT NULL DEFAULT false,
  enabled_modules jsonb NOT NULL DEFAULT '["catalog","content","orders","documents","mail","files","analytics","hygiene","knowledge"]'::jsonb,
  operators jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.copilot_settings TO authenticated;
GRANT ALL ON public.copilot_settings TO service_role;
ALTER TABLE public.copilot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_settings_admin" ON public.copilot_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER copilot_settings_touch BEFORE UPDATE ON public.copilot_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.copilot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;