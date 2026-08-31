CREATE TABLE IF NOT EXISTS public.assistant_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_key text,
  status text NOT NULL DEFAULT 'pending',
  title text NOT NULL,
  summary text,
  request text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  research jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  result text,
  tg_chat_id bigint,
  tg_message_id bigint,
  reminded_at timestamptz,
  decided_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_plans_pending_idx ON public.assistant_plans (status, created_at DESC);

GRANT ALL ON public.assistant_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_plans TO authenticated;
ALTER TABLE public.assistant_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant_plans_admin" ON public.assistant_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER assistant_plans_touch BEFORE UPDATE ON public.assistant_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();