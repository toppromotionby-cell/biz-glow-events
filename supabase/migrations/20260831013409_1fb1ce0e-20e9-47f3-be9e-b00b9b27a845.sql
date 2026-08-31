ALTER TABLE public.calendar_directions ADD COLUMN IF NOT EXISTS google_tasklist_id text;

ALTER TABLE public.calendar_items
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS google_tasklist_id text,
  ADD COLUMN IF NOT EXISTS google_tasks_etag text,
  ADD COLUMN IF NOT EXISTS google_tasks_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS calendar_items_google_task_idx ON public.calendar_items (google_task_id);
CREATE INDEX IF NOT EXISTS calendar_items_parent_idx ON public.calendar_items (parent_id);

ALTER TABLE public.assistant_prefs
  ADD COLUMN IF NOT EXISTS task_routing text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS gtasks_enabled boolean NOT NULL DEFAULT true;