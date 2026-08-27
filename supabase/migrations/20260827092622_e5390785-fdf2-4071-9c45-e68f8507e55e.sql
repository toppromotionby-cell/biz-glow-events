DROP POLICY IF EXISTS "Staff can view company profiles" ON public.company_profiles;
CREATE POLICY "Finance staff can view company profiles"
ON public.company_profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);