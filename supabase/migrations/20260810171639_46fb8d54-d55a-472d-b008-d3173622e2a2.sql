DROP POLICY IF EXISTS "Staff can view mail accounts" ON public.mail_accounts;
DROP POLICY IF EXISTS "Staff can update mail accounts" ON public.mail_accounts;
DROP POLICY IF EXISTS "Staff can delete mail accounts" ON public.mail_accounts;

CREATE POLICY "Owners or admins can view mail accounts"
ON public.mail_accounts FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins can update mail accounts"
ON public.mail_accounts FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admins can delete mail accounts"
ON public.mail_accounts FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can manage mail drafts" ON public.mail_drafts;

CREATE POLICY "Owners or admins can manage mail drafts"
ON public.mail_drafts FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));