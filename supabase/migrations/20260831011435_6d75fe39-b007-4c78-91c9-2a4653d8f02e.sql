ALTER TABLE public.assistant_prefs
  ADD COLUMN IF NOT EXISTS visuals_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visual_mode text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS digest_visual boolean NOT NULL DEFAULT true;