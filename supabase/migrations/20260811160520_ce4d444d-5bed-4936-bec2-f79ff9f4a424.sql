CREATE OR REPLACE FUNCTION public.owns_mail_account(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mail_accounts a
    WHERE a.id = _account_id
      AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

DROP POLICY IF EXISTS "Staff can manage mail messages" ON public.mail_messages;
CREATE POLICY "Owners or admins can manage mail messages"
ON public.mail_messages FOR ALL TO authenticated
USING (public.owns_mail_account(account_id))
WITH CHECK (public.owns_mail_account(account_id));

DROP POLICY IF EXISTS "Staff can manage mail folders" ON public.mail_folders;
CREATE POLICY "Owners or admins can manage mail folders"
ON public.mail_folders FOR ALL TO authenticated
USING (public.owns_mail_account(account_id))
WITH CHECK (public.owns_mail_account(account_id));

DROP POLICY IF EXISTS "Staff can manage mail rules" ON public.mail_rules;
CREATE POLICY "Owners or admins can manage mail rules"
ON public.mail_rules FOR ALL TO authenticated
USING (public.owns_mail_account(account_id))
WITH CHECK (public.owns_mail_account(account_id));

DROP POLICY IF EXISTS "Staff can view mail account checks" ON public.mail_account_checks;
CREATE POLICY "Owners or admins can view mail account checks"
ON public.mail_account_checks FOR SELECT TO authenticated
USING (public.owns_mail_account(account_id));

DROP POLICY IF EXISTS "Staff can insert mail account checks" ON public.mail_account_checks;
CREATE POLICY "Owners or admins can insert mail account checks"
ON public.mail_account_checks FOR INSERT TO authenticated
WITH CHECK (public.owns_mail_account(account_id));

DROP POLICY IF EXISTS "Staff can manage mail attachments" ON public.mail_attachments;
CREATE POLICY "Owners or admins can manage mail attachments"
ON public.mail_attachments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.mail_messages m
  WHERE m.id = mail_attachments.message_id
    AND public.owns_mail_account(m.account_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.mail_messages m
  WHERE m.id = mail_attachments.message_id
    AND public.owns_mail_account(m.account_id)
));