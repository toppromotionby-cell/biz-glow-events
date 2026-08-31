ALTER TABLE public.assistant_memory
  ADD COLUMN IF NOT EXISTS bot text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'shared';

CREATE INDEX IF NOT EXISTS assistant_memory_scope_idx ON public.assistant_memory (scope, active);