ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';

DELETE FROM public.user_roles WHERE role = 'marketer';

DROP POLICY IF EXISTS "Marketers manage campaigns" ON public.campaigns;
CREATE POLICY "Staff manage campaigns"
ON public.campaigns FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Marketers read logs" ON public.marketing_logs;
CREATE POLICY "Staff read marketing logs"
ON public.marketing_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));