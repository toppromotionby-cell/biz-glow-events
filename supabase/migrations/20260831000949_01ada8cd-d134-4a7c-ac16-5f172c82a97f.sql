ALTER TABLE public.calendar_sync_state
  ADD COLUMN IF NOT EXISTS last_morning_on date,
  ADD COLUMN IF NOT EXISTS last_evening_on date;