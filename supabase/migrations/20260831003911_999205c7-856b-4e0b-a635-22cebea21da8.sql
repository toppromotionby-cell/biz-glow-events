ALTER TABLE public.assistant_prefs
  ADD COLUMN IF NOT EXISTS tg_allowed_chat_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  ADD COLUMN IF NOT EXISTS tg_bot_username text;