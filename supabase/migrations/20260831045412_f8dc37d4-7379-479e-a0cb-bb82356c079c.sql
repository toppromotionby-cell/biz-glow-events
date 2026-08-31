ALTER TABLE public.calendar_directions
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS google_sync_token text;

ALTER TABLE public.assistant_prefs
  ADD COLUMN IF NOT EXISTS google_health_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_health_state text;