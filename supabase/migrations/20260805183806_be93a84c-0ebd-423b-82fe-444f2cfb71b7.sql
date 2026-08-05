CREATE TABLE public.email_senders (
  kind text PRIMARY KEY,
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  reply_to text NOT NULL DEFAULT '',
  inherit_default boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.email_senders TO authenticated;
GRANT ALL ON public.email_senders TO service_role;

ALTER TABLE public.email_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email senders"
ON public.email_senders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can insert email senders"
ON public.email_senders FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can update email senders"
ON public.email_senders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER email_senders_touch_updated_at
BEFORE UPDATE ON public.email_senders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.email_senders (kind, from_name, from_email, reply_to, inherit_default) VALUES
  ('default',   'Event Hub', 'noreply@event-hub.by', 'noreply@event-hub.by', false),
  ('orders',    '', '', '', true),
  ('quotes',    '', '', '', true),
  ('leads',     '', '', '', true),
  ('auth',      '', '', '', true),
  ('campaigns', '', '', '', true),
  ('admin',     '', '', '', true);