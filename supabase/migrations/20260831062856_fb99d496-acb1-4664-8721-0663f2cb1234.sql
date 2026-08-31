-- 1. Внутренние заметки заказа → отдельная staff-only таблица
CREATE TABLE public.order_internal_notes (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_internal_notes TO authenticated;
GRANT ALL ON public.order_internal_notes TO service_role;

ALTER TABLE public.order_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage order internal notes"
ON public.order_internal_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE TRIGGER order_internal_notes_touch
BEFORE UPDATE ON public.order_internal_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.order_internal_notes (order_id, notes)
SELECT id, internal_notes FROM public.orders
WHERE internal_notes IS NOT NULL AND internal_notes <> '';

ALTER TABLE public.orders DROP COLUMN internal_notes;

-- 2. Явный WITH CHECK для staff-политики заказов
DROP POLICY "Staff manage orders" ON public.orders;
CREATE POLICY "Staff manage orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 3. DJ-хелперы: SECURITY DEFINER уводим из публичной API-схемы
CREATE OR REPLACE FUNCTION private.dj_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private'
AS $$
  SELECT private.has_role(_uid, 'admin'::public.app_role)
      OR private.has_role(_uid, 'dj_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION private.dj_is_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private'
AS $$
  SELECT private.dj_can_manage(_uid)
      OR EXISTS (SELECT 1 FROM public.dj_members m
                 WHERE m.user_id = _uid AND m.status IN ('approved','trusted'))
$$;

CREATE OR REPLACE FUNCTION private.dj_is_trusted(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private'
AS $$
  SELECT private.dj_can_manage(_uid)
      OR EXISTS (SELECT 1 FROM public.dj_members m
                 WHERE m.user_id = _uid AND m.status = 'trusted')
$$;

REVOKE ALL ON FUNCTION private.dj_can_manage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.dj_is_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.dj_is_trusted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.dj_can_manage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dj_is_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dj_is_trusted(uuid) TO authenticated, service_role;

DROP POLICY dj_categories_manage ON public.dj_categories; CREATE POLICY dj_categories_manage ON public.dj_categories AS PERMISSIVE FOR ALL TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_categories_read_members ON public.dj_categories; CREATE POLICY dj_categories_read_members ON public.dj_categories AS PERMISSIVE FOR SELECT TO authenticated USING (private.dj_is_member(auth.uid()));
DROP POLICY dj_downloads_read ON public.dj_downloads; CREATE POLICY dj_downloads_read ON public.dj_downloads AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid())));
DROP POLICY dj_formats_read ON public.dj_event_formats; CREATE POLICY dj_formats_read ON public.dj_event_formats AS PERMISSIVE FOR SELECT TO authenticated USING (private.dj_is_member(auth.uid()));
DROP POLICY dj_formats_write ON public.dj_event_formats; CREATE POLICY dj_formats_write ON public.dj_event_formats AS PERMISSIVE FOR ALL TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_favorites_own ON public.dj_favorites; CREATE POLICY dj_favorites_own ON public.dj_favorites AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK (((user_id = auth.uid()) AND private.dj_is_member(auth.uid())));
DROP POLICY dj_hygiene_log_read ON public.dj_hygiene_log; CREATE POLICY dj_hygiene_log_read ON public.dj_hygiene_log AS PERMISSIVE FOR SELECT TO authenticated USING (private.dj_can_manage(auth.uid()));
DROP POLICY dj_hygiene_settings_manage ON public.dj_hygiene_settings; CREATE POLICY dj_hygiene_settings_manage ON public.dj_hygiene_settings AS PERMISSIVE FOR ALL TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_members_delete ON public.dj_members; CREATE POLICY dj_members_delete ON public.dj_members AS PERMISSIVE FOR DELETE TO authenticated USING (private.dj_can_manage(auth.uid()));
DROP POLICY dj_members_manage ON public.dj_members; CREATE POLICY dj_members_manage ON public.dj_members AS PERMISSIVE FOR UPDATE TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_members_self_select ON public.dj_members; CREATE POLICY dj_members_self_select ON public.dj_members AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid())));
DROP POLICY dj_playlist_items_access ON public.dj_playlist_items; CREATE POLICY dj_playlist_items_access ON public.dj_playlist_items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.dj_playlists p
  WHERE ((p.id = dj_playlist_items.playlist_id) AND ((p.user_id = auth.uid()) OR private.dj_can_manage(auth.uid()) OR (p.is_public AND private.dj_is_member(auth.uid()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.dj_playlists p
  WHERE ((p.id = dj_playlist_items.playlist_id) AND (p.user_id = auth.uid())))));
DROP POLICY dj_playlists_own_delete ON public.dj_playlists; CREATE POLICY dj_playlists_own_delete ON public.dj_playlists AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid())));
DROP POLICY dj_playlists_own_write ON public.dj_playlists; CREATE POLICY dj_playlists_own_write ON public.dj_playlists AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND private.dj_is_member(auth.uid())));
DROP POLICY dj_playlists_read ON public.dj_playlists; CREATE POLICY dj_playlists_read ON public.dj_playlists AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid()) OR (is_public AND private.dj_is_member(auth.uid()))));
DROP POLICY dj_ratings_delete ON public.dj_ratings; CREATE POLICY dj_ratings_delete ON public.dj_ratings AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid())));
DROP POLICY dj_ratings_read ON public.dj_ratings; CREATE POLICY dj_ratings_read ON public.dj_ratings AS PERMISSIVE FOR SELECT TO authenticated USING (private.dj_is_member(auth.uid()));
DROP POLICY dj_ratings_write ON public.dj_ratings; CREATE POLICY dj_ratings_write ON public.dj_ratings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND private.dj_is_member(auth.uid())));
DROP POLICY dj_software_delete ON public.dj_software; CREATE POLICY dj_software_delete ON public.dj_software AS PERMISSIVE FOR DELETE TO authenticated USING (private.dj_can_manage(auth.uid()));
DROP POLICY dj_software_insert ON public.dj_software; CREATE POLICY dj_software_insert ON public.dj_software AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((private.dj_can_manage(auth.uid()) OR (private.dj_is_trusted(auth.uid()) AND (created_by = auth.uid()) AND (status = 'pending'::text))));
DROP POLICY dj_software_read ON public.dj_software; CREATE POLICY dj_software_read ON public.dj_software AS PERMISSIVE FOR SELECT TO authenticated USING ((private.dj_can_manage(auth.uid()) OR (created_by = auth.uid()) OR ((status = 'published'::text) AND private.dj_is_member(auth.uid()))));
DROP POLICY dj_software_update ON public.dj_software; CREATE POLICY dj_software_update ON public.dj_software AS PERMISSIVE FOR UPDATE TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_sw_versions_delete ON public.dj_software_versions; CREATE POLICY dj_sw_versions_delete ON public.dj_software_versions AS PERMISSIVE FOR DELETE TO authenticated USING (private.dj_can_manage(auth.uid()));
DROP POLICY dj_sw_versions_insert ON public.dj_software_versions; CREATE POLICY dj_sw_versions_insert ON public.dj_software_versions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((private.dj_can_manage(auth.uid()) OR (private.dj_is_trusted(auth.uid()) AND (created_by = auth.uid()) AND (status = 'pending'::text))));
DROP POLICY dj_sw_versions_read ON public.dj_software_versions; CREATE POLICY dj_sw_versions_read ON public.dj_software_versions AS PERMISSIVE FOR SELECT TO authenticated USING ((private.dj_can_manage(auth.uid()) OR (created_by = auth.uid()) OR ((status = 'published'::text) AND private.dj_is_member(auth.uid()))));
DROP POLICY dj_sw_versions_update ON public.dj_software_versions; CREATE POLICY dj_sw_versions_update ON public.dj_software_versions AS PERMISSIVE FOR UPDATE TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY "dj_tg_links own or admin" ON public.dj_tg_links; CREATE POLICY "dj_tg_links own or admin" ON public.dj_tg_links AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid()))) WITH CHECK (((user_id = auth.uid()) OR private.dj_can_manage(auth.uid())));
DROP POLICY "dj_tg_outbox admin read" ON public.dj_tg_outbox; CREATE POLICY "dj_tg_outbox admin read" ON public.dj_tg_outbox AS PERMISSIVE FOR SELECT TO authenticated USING (private.dj_can_manage(auth.uid()));
DROP POLICY "dj_tg_settings admin" ON public.dj_tg_settings; CREATE POLICY "dj_tg_settings admin" ON public.dj_tg_settings AS PERMISSIVE FOR ALL TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_track_formats_read ON public.dj_track_formats; CREATE POLICY dj_track_formats_read ON public.dj_track_formats AS PERMISSIVE FOR SELECT TO authenticated USING (private.dj_is_member(auth.uid()));
DROP POLICY dj_track_formats_write ON public.dj_track_formats; CREATE POLICY dj_track_formats_write ON public.dj_track_formats AS PERMISSIVE FOR ALL TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_tracks_delete ON public.dj_tracks; CREATE POLICY dj_tracks_delete ON public.dj_tracks AS PERMISSIVE FOR DELETE TO authenticated USING (private.dj_can_manage(auth.uid()));
DROP POLICY dj_tracks_read ON public.dj_tracks; CREATE POLICY dj_tracks_read ON public.dj_tracks AS PERMISSIVE FOR SELECT TO authenticated USING ((private.dj_can_manage(auth.uid()) OR (uploaded_by = auth.uid()) OR ((status = 'published'::text) AND private.dj_is_member(auth.uid()))));
DROP POLICY dj_tracks_update ON public.dj_tracks; CREATE POLICY dj_tracks_update ON public.dj_tracks AS PERMISSIVE FOR UPDATE TO authenticated USING (private.dj_can_manage(auth.uid())) WITH CHECK (private.dj_can_manage(auth.uid()));
DROP POLICY dj_tracks_upload ON public.dj_tracks; CREATE POLICY dj_tracks_upload ON public.dj_tracks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((private.dj_can_manage(auth.uid()) OR (private.dj_is_trusted(auth.uid()) AND (uploaded_by = auth.uid()) AND (status = 'pending'::text))));

DROP FUNCTION IF EXISTS public.dj_can_manage(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.dj_is_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.dj_is_trusted(uuid) CASCADE;