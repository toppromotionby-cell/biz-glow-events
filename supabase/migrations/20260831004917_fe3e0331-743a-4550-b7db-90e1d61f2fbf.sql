ALTER TABLE public.assistant_prefs
  ADD COLUMN IF NOT EXISTS alice_user_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alice_skill_id text,
  ADD COLUMN IF NOT EXISTS alice_link_code text,
  ADD COLUMN IF NOT EXISTS alice_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alice_mirror_tg boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.calendar_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'telegram',
  kind text NOT NULL DEFAULT 'note',
  text text NOT NULL,
  item_id uuid REFERENCES public.calendar_items(id) ON DELETE SET NULL,
  spoken_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.calendar_outbox TO service_role;
ALTER TABLE public.calendar_outbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS calendar_outbox_unspoken_idx
  ON public.calendar_outbox (created_at DESC)
  WHERE spoken_at IS NULL;