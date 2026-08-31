REVOKE ALL ON FUNCTION public.dj_member_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dj_recalc_track_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dj_can_manage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dj_is_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dj_is_trusted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dj_can_manage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dj_is_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dj_is_trusted(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dj_member_status(uuid) TO service_role;