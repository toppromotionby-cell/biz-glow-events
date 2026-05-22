
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Revoke broad EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten marketing_logs insert: only authenticated visitors
DROP POLICY IF EXISTS "Anyone inserts logs" ON public.marketing_logs;
CREATE POLICY "Authenticated inserts logs" ON public.marketing_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Move btree_gist out of public
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
