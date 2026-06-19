-- ============================================================================
-- Stage 5: автоматизация audit_log и order_timeline через триггеры БД
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Универсальный audit-триггер: пишет diff в public.audit_log на UPDATE/DELETE.
--    Работает как SECURITY DEFINER — обходит RLS на audit_log
--    (на таблице есть только SELECT-политика для admin).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_record_id := (to_jsonb(NEW)->>'id')::uuid;
    v_new := to_jsonb(NEW);
    v_old := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := (to_jsonb(NEW)->>'id')::uuid;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Пропускаем no-op апдейты (когда колонки не изменились).
    IF v_old IS NOT DISTINCT FROM v_new THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := (to_jsonb(OLD)->>'id')::uuid;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  END IF;

  INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Навешиваем audit-триггер на ключевые таблицы. INSERT не аудитим — он
-- виден по created_at в самой таблице; шумит и раздувает audit_log.
DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders
AFTER UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS audit_cases ON public.cases;
CREATE TRIGGER audit_cases
AFTER UPDATE OR DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS audit_blog_posts ON public.blog_posts;
CREATE TRIGGER audit_blog_posts
AFTER UPDATE OR DELETE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS audit_testimonials ON public.testimonials;
CREATE TRIGGER audit_testimonials
AFTER UPDATE OR DELETE ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- ----------------------------------------------------------------------------
-- 2. Авто-запись в order_timeline при смене status или paid в orders.
--    Формат event совпадает с тем, что уже пишет код вручную:
--      'status_changed:<new_status>' и 'paid_changed'.
--    После применения миграции ручные вставки этих событий
--    в use-order-mutations.ts и admin.orders.$id.tsx будут удалены,
--    чтобы не было дублей.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_timeline (order_id, actor_id, event, payload)
    VALUES (
      NEW.id,
      auth.uid(),
      'status_changed:' || NEW.status::text,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;

  IF NEW.paid IS DISTINCT FROM OLD.paid THEN
    INSERT INTO public.order_timeline (order_id, actor_id, event, payload)
    VALUES (
      NEW.id,
      auth.uid(),
      'paid_changed',
      jsonb_build_object('from', OLD.paid, 'to', NEW.paid)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_status_paid_timeline ON public.orders;
CREATE TRIGGER order_status_paid_timeline
AFTER UPDATE OF status, paid ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- ----------------------------------------------------------------------------
-- 3. Проверим, что touch_updated_at навешен на таблицы с колонкой updated_at,
--    у которых триггера ещё нет. Создаём отсутствующие.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_trigger tg
        JOIN pg_class cl ON cl.oid = tg.tgrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        WHERE n.nspname = 'public'
          AND cl.relname = c.table_name
          AND tg.tgname = 'set_updated_at'
          AND NOT tg.tgisinternal
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
      t.table_name
    );
  END LOOP;
END $$;
