CREATE TABLE public.mail_account_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ok boolean NOT NULL,
  status_code integer,
  message text,
  details jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mail_account_checks_account_id_created_at_idx
  ON public.mail_account_checks (account_id, created_at DESC);

GRANT SELECT, INSERT ON public.mail_account_checks TO authenticated;
GRANT ALL ON public.mail_account_checks TO service_role;

ALTER TABLE public.mail_account_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view mail account checks"
  ON public.mail_account_checks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can insert mail account checks"
  ON public.mail_account_checks FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
