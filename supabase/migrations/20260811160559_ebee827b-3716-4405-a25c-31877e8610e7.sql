REVOKE ALL ON FUNCTION public.owns_mail_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_mail_account(uuid) TO authenticated, service_role;