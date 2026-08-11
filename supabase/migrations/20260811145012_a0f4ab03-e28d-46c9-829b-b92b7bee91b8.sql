ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS sheet_id text,
  ADD COLUMN IF NOT EXISTS sheet_url text,
  ADD COLUMN IF NOT EXISTS sheet_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheet_snapshot jsonb;