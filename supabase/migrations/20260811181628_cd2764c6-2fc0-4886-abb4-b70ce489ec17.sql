CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.owns_mail_account(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.mail_accounts a
    WHERE a.id = _account_id
      AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$function$;

REVOKE ALL ON FUNCTION private.owns_mail_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_mail_account(uuid) TO authenticated, service_role;

DROP POLICY "Owners or admins can manage mail messages" ON public.mail_messages;
CREATE POLICY "Owners or admins can manage mail messages" ON public.mail_messages
  FOR ALL TO authenticated
  USING (private.owns_mail_account(account_id))
  WITH CHECK (private.owns_mail_account(account_id));

DROP POLICY "Owners or admins can manage mail folders" ON public.mail_folders;
CREATE POLICY "Owners or admins can manage mail folders" ON public.mail_folders
  FOR ALL TO authenticated
  USING (private.owns_mail_account(account_id))
  WITH CHECK (private.owns_mail_account(account_id));

DROP POLICY "Owners or admins can manage mail rules" ON public.mail_rules;
CREATE POLICY "Owners or admins can manage mail rules" ON public.mail_rules
  FOR ALL TO authenticated
  USING (private.owns_mail_account(account_id))
  WITH CHECK (private.owns_mail_account(account_id));

DROP POLICY "Owners or admins can view mail account checks" ON public.mail_account_checks;
CREATE POLICY "Owners or admins can view mail account checks" ON public.mail_account_checks
  FOR SELECT TO authenticated
  USING (private.owns_mail_account(account_id));

DROP POLICY "Owners or admins can insert mail account checks" ON public.mail_account_checks;
CREATE POLICY "Owners or admins can insert mail account checks" ON public.mail_account_checks
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_mail_account(account_id));

DROP POLICY "Owners or admins can manage mail attachments" ON public.mail_attachments;
CREATE POLICY "Owners or admins can manage mail attachments" ON public.mail_attachments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mail_messages m WHERE m.id = mail_attachments.message_id AND private.owns_mail_account(m.account_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mail_messages m WHERE m.id = mail_attachments.message_id AND private.owns_mail_account(m.account_id)));

DROP FUNCTION IF EXISTS public.owns_mail_account(uuid);