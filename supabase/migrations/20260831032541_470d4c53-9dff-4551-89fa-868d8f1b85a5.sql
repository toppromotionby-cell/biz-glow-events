ALTER TABLE public.dj_tracks
  ADD COLUMN IF NOT EXISTS cover_spec_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_palette text;

CREATE INDEX IF NOT EXISTS dj_tracks_cover_spec_version_idx ON public.dj_tracks (cover_spec_version);