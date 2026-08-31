-- Память ассистента (обучаемость), история диалога и журнал действий для «отмени».

CREATE TABLE IF NOT EXISTS public.assistant_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'rule', -- alias | habit | rule | fact
  key text NOT NULL,
  value text NOT NULL,
  source text NOT NULL DEFAULT 'user',
  weight int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assistant_memory_kind_key_uniq ON public.assistant_memory (kind, lower(key));

GRANT ALL ON public.assistant_memory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_memory TO authenticated;
ALTER TABLE public.assistant_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant_memory_admin" ON public.assistant_memory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.assistant_dialog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'telegram',
  chat_key text NOT NULL,
  role text NOT NULL, -- user | assistant
  content text NOT NULL,
  focus_item_id uuid REFERENCES public.calendar_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_dialog_chat_idx ON public.assistant_dialog (chat_key, created_at DESC);

GRANT ALL ON public.assistant_dialog TO service_role;
GRANT SELECT, DELETE ON public.assistant_dialog TO authenticated;
ALTER TABLE public.assistant_dialog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant_dialog_admin" ON public.assistant_dialog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_key text,
  action text NOT NULL,
  item_id uuid,
  before_state jsonb,
  after_state jsonb,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_actions_recent_idx ON public.assistant_actions (created_at DESC);

GRANT ALL ON public.assistant_actions TO service_role;
GRANT SELECT ON public.assistant_actions TO authenticated;
ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant_actions_admin" ON public.assistant_actions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.assistant_prefs
  ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'friendly',
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS voice_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brain_enabled boolean NOT NULL DEFAULT true;