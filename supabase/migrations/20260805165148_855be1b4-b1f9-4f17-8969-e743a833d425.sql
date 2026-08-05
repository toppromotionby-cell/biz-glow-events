ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;