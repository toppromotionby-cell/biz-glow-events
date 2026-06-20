
-- Stage 5: attach audit_log and order_timeline triggers.
-- The trigger functions public.write_audit_log() and public.log_order_status_change()
-- already exist. This migration wires them to the relevant tables.

-- Audit log triggers: capture INSERT/UPDATE/DELETE diffs for sensitive tables.
DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS audit_cases ON public.cases;
CREATE TRIGGER audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS audit_blog_posts ON public.blog_posts;
CREATE TRIGGER audit_blog_posts
  AFTER INSERT OR UPDATE OR DELETE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS audit_testimonials ON public.testimonials;
CREATE TRIGGER audit_testimonials
  AFTER INSERT OR UPDATE OR DELETE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- Order timeline trigger: auto-write status/paid transitions.
DROP TRIGGER IF EXISTS order_status_timeline ON public.orders;
CREATE TRIGGER order_status_timeline
  AFTER UPDATE OF status, paid ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Ensure updated_at is maintained everywhere it should be.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'orders','order_items','cases','blog_posts','testimonials',
    'services','zones','tech_equipment','production_items',
    'catalog_categories','profiles','campaigns','promo_codes',
    'site_sections','text_overrides','availability'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='updated_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND tg.tgname = 'set_updated_at_'||t
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END$$;
