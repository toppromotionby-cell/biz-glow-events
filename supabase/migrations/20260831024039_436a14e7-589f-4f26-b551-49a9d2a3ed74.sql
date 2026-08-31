-- ============ members ============
CREATE TABLE public.dj_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nickname text NOT NULL,
  city text,
  bio text,
  contact text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','trusted','blocked','rejected')),
  admin_note text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_members TO authenticated;
GRANT ALL ON public.dj_members TO service_role;

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.dj_member_status(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM public.dj_members WHERE user_id = _uid
$$;

CREATE OR REPLACE FUNCTION public.dj_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_role(_uid, 'admin'::public.app_role)
      OR private.has_role(_uid, 'dj_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.dj_is_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.dj_can_manage(_uid)
      OR EXISTS (SELECT 1 FROM public.dj_members m
                 WHERE m.user_id = _uid AND m.status IN ('approved','trusted'))
$$;

CREATE OR REPLACE FUNCTION public.dj_is_trusted(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.dj_can_manage(_uid)
      OR EXISTS (SELECT 1 FROM public.dj_members m
                 WHERE m.user_id = _uid AND m.status = 'trusted')
$$;

ALTER TABLE public.dj_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_members_self_select" ON public.dj_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.dj_can_manage(auth.uid()));
CREATE POLICY "dj_members_self_apply" ON public.dj_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "dj_members_manage" ON public.dj_members FOR UPDATE TO authenticated
  USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE POLICY "dj_members_delete" ON public.dj_members FOR DELETE TO authenticated
  USING (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_members_touch BEFORE UPDATE ON public.dj_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ tracks ============
CREATE TABLE public.dj_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist text NOT NULL,
  title text NOT NULL,
  version text NOT NULL DEFAULT 'original',
  genre text,
  bpm integer CHECK (bpm IS NULL OR (bpm > 0 AND bpm < 400)),
  key_camelot text,
  year integer CHECK (year IS NULL OR (year > 1900 AND year < 2200)),
  language text,
  energy integer CHECK (energy IS NULL OR (energy BETWEEN 1 AND 10)),
  duration_sec integer,
  tags text[] NOT NULL DEFAULT '{}',
  audio_path text NOT NULL,
  artwork_path text,
  waveform jsonb,
  format text,
  file_size bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','published','rejected')),
  reject_reason text,
  uploaded_by uuid,
  play_count integer NOT NULL DEFAULT 0,
  download_count integer NOT NULL DEFAULT 0,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dj_tracks_status_idx ON public.dj_tracks (status, published_at DESC NULLS LAST);
CREATE INDEX dj_tracks_genre_idx ON public.dj_tracks (genre);
CREATE INDEX dj_tracks_bpm_idx ON public.dj_tracks (bpm);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_tracks TO authenticated;
GRANT ALL ON public.dj_tracks TO service_role;
ALTER TABLE public.dj_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_tracks_read" ON public.dj_tracks FOR SELECT TO authenticated
  USING (
    public.dj_can_manage(auth.uid())
    OR uploaded_by = auth.uid()
    OR (status = 'published' AND public.dj_is_member(auth.uid()))
  );
CREATE POLICY "dj_tracks_upload" ON public.dj_tracks FOR INSERT TO authenticated
  WITH CHECK (
    public.dj_can_manage(auth.uid())
    OR (public.dj_is_trusted(auth.uid()) AND uploaded_by = auth.uid() AND status = 'pending')
  );
CREATE POLICY "dj_tracks_update" ON public.dj_tracks FOR UPDATE TO authenticated
  USING (public.dj_can_manage(auth.uid()))
  WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE POLICY "dj_tracks_delete" ON public.dj_tracks FOR DELETE TO authenticated
  USING (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_tracks_touch BEFORE UPDATE ON public.dj_tracks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ software ============
CREATE TABLE public.dj_software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  vendor text,
  category text NOT NULL DEFAULT 'dj',
  description text,
  instructions text,
  platforms text[] NOT NULL DEFAULT '{}',
  icon_path text,
  website text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','pending','published','rejected')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_software TO authenticated;
GRANT ALL ON public.dj_software TO service_role;
ALTER TABLE public.dj_software ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_software_read" ON public.dj_software FOR SELECT TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR created_by = auth.uid()
         OR (status = 'published' AND public.dj_is_member(auth.uid())));
CREATE POLICY "dj_software_insert" ON public.dj_software FOR INSERT TO authenticated
  WITH CHECK (public.dj_can_manage(auth.uid())
              OR (public.dj_is_trusted(auth.uid()) AND created_by = auth.uid() AND status = 'pending'));
CREATE POLICY "dj_software_update" ON public.dj_software FOR UPDATE TO authenticated
  USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE POLICY "dj_software_delete" ON public.dj_software FOR DELETE TO authenticated
  USING (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_software_touch BEFORE UPDATE ON public.dj_software
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.dj_software_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id uuid NOT NULL REFERENCES public.dj_software(id) ON DELETE CASCADE,
  version text NOT NULL,
  release_date date,
  platform text NOT NULL DEFAULT 'windows',
  file_path text,
  external_url text,
  file_size bigint,
  changelog text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','pending','published','rejected')),
  download_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dj_software_versions_sw_idx ON public.dj_software_versions (software_id, release_date DESC NULLS LAST);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_software_versions TO authenticated;
GRANT ALL ON public.dj_software_versions TO service_role;
ALTER TABLE public.dj_software_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_sw_versions_read" ON public.dj_software_versions FOR SELECT TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR created_by = auth.uid()
         OR (status = 'published' AND public.dj_is_member(auth.uid())));
CREATE POLICY "dj_sw_versions_insert" ON public.dj_software_versions FOR INSERT TO authenticated
  WITH CHECK (public.dj_can_manage(auth.uid())
              OR (public.dj_is_trusted(auth.uid()) AND created_by = auth.uid() AND status = 'pending'));
CREATE POLICY "dj_sw_versions_update" ON public.dj_software_versions FOR UPDATE TO authenticated
  USING (public.dj_can_manage(auth.uid())) WITH CHECK (public.dj_can_manage(auth.uid()));
CREATE POLICY "dj_sw_versions_delete" ON public.dj_software_versions FOR DELETE TO authenticated
  USING (public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_software_versions_touch BEFORE UPDATE ON public.dj_software_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ratings / favorites / playlists ============
CREATE TABLE public.dj_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.dj_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  value integer NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_ratings TO authenticated;
GRANT ALL ON public.dj_ratings TO service_role;
ALTER TABLE public.dj_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_ratings_read" ON public.dj_ratings FOR SELECT TO authenticated
  USING (public.dj_is_member(auth.uid()));
CREATE POLICY "dj_ratings_write" ON public.dj_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.dj_is_member(auth.uid()));
CREATE POLICY "dj_ratings_update" ON public.dj_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "dj_ratings_delete" ON public.dj_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_ratings_touch BEFORE UPDATE ON public.dj_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.dj_recalc_track_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_track uuid;
BEGIN
  v_track := COALESCE(NEW.track_id, OLD.track_id);
  UPDATE public.dj_tracks t
     SET rating_avg = COALESCE((SELECT round(avg(value)::numeric, 2) FROM public.dj_ratings WHERE track_id = v_track), 0),
         rating_count = (SELECT count(*) FROM public.dj_ratings WHERE track_id = v_track)
   WHERE t.id = v_track;
  RETURN NULL;
END $$;
CREATE TRIGGER dj_ratings_recalc AFTER INSERT OR UPDATE OR DELETE ON public.dj_ratings
  FOR EACH ROW EXECUTE FUNCTION public.dj_recalc_track_rating();

CREATE TABLE public.dj_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.dj_tracks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, track_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_favorites TO authenticated;
GRANT ALL ON public.dj_favorites TO service_role;
ALTER TABLE public.dj_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_favorites_own" ON public.dj_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.dj_is_member(auth.uid()));

CREATE TABLE public.dj_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_playlists TO authenticated;
GRANT ALL ON public.dj_playlists TO service_role;
ALTER TABLE public.dj_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_playlists_read" ON public.dj_playlists FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.dj_can_manage(auth.uid())
         OR (is_public AND public.dj_is_member(auth.uid())));
CREATE POLICY "dj_playlists_own_write" ON public.dj_playlists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.dj_is_member(auth.uid()));
CREATE POLICY "dj_playlists_own_update" ON public.dj_playlists FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "dj_playlists_own_delete" ON public.dj_playlists FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.dj_can_manage(auth.uid()));
CREATE TRIGGER dj_playlists_touch BEFORE UPDATE ON public.dj_playlists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.dj_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.dj_playlists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.dj_tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, track_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_playlist_items TO authenticated;
GRANT ALL ON public.dj_playlist_items TO service_role;
ALTER TABLE public.dj_playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_playlist_items_access" ON public.dj_playlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dj_playlists p WHERE p.id = playlist_id
                 AND (p.user_id = auth.uid() OR public.dj_can_manage(auth.uid())
                      OR (p.is_public AND public.dj_is_member(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dj_playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));

-- ============ threads / comments ============
CREATE TABLE public.dj_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_threads TO authenticated;
GRANT ALL ON public.dj_threads TO service_role;
ALTER TABLE public.dj_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_threads_read" ON public.dj_threads FOR SELECT TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR author_id = auth.uid()
         OR (status = 'published' AND public.dj_is_member(auth.uid())));
CREATE POLICY "dj_threads_create" ON public.dj_threads FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.dj_is_member(auth.uid()));
CREATE POLICY "dj_threads_update" ON public.dj_threads FOR UPDATE TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR (author_id = auth.uid() AND NOT locked))
  WITH CHECK (public.dj_can_manage(auth.uid()) OR author_id = auth.uid());
CREATE POLICY "dj_threads_delete" ON public.dj_threads FOR DELETE TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR author_id = auth.uid());
CREATE TRIGGER dj_threads_touch BEFORE UPDATE ON public.dj_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.dj_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  parent_id uuid REFERENCES public.dj_comments(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('track','software','thread')),
  target_id uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dj_comments_target_idx ON public.dj_comments (target_type, target_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_comments TO authenticated;
GRANT ALL ON public.dj_comments TO service_role;
ALTER TABLE public.dj_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_comments_read" ON public.dj_comments FOR SELECT TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR author_id = auth.uid()
         OR (status = 'published' AND public.dj_is_member(auth.uid())));
CREATE POLICY "dj_comments_create" ON public.dj_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.dj_is_member(auth.uid()) AND status = 'published');
CREATE POLICY "dj_comments_update" ON public.dj_comments FOR UPDATE TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR author_id = auth.uid())
  WITH CHECK (public.dj_can_manage(auth.uid()) OR author_id = auth.uid());
CREATE POLICY "dj_comments_delete" ON public.dj_comments FOR DELETE TO authenticated
  USING (public.dj_can_manage(auth.uid()) OR author_id = auth.uid());
CREATE TRIGGER dj_comments_touch BEFORE UPDATE ON public.dj_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ downloads log ============
CREATE TABLE public.dj_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('track','software')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dj_downloads_user_idx ON public.dj_downloads (user_id, created_at DESC);
GRANT SELECT ON public.dj_downloads TO authenticated;
GRANT ALL ON public.dj_downloads TO service_role;
ALTER TABLE public.dj_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_downloads_read" ON public.dj_downloads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.dj_can_manage(auth.uid()));