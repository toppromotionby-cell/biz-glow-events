ALTER TABLE public.assistant_plans
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'planner',
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS assistant_plans_chat_status_idx
  ON public.assistant_plans (kind, tg_chat_id, status, created_at DESC);