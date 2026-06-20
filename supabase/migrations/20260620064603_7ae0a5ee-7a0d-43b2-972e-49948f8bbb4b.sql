CREATE TABLE public.email_templates (
  template_key text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('transactional','auth','order-status')),
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates admin/manager full"
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_email_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();