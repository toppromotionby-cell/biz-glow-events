ALTER TABLE public.dj_tracks
  ADD COLUMN IF NOT EXISTS is_remix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remixer text,
  ADD COLUMN IF NOT EXISTS original_track_id uuid REFERENCES public.dj_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_source text;

CREATE INDEX IF NOT EXISTS dj_tracks_original_track_idx ON public.dj_tracks(original_track_id);
CREATE INDEX IF NOT EXISTS dj_tracks_is_remix_idx ON public.dj_tracks(is_remix);

CREATE TABLE IF NOT EXISTS public.dj_lookup_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  query_key text NOT NULL,
  response jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, query_key)
);

GRANT ALL ON public.dj_lookup_cache TO service_role;
ALTER TABLE public.dj_lookup_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_lookup_cache service only" ON public.dj_lookup_cache FOR ALL TO service_role USING (true) WITH CHECK (true);