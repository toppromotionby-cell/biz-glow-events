CREATE OR REPLACE FUNCTION public.increment_promo_usage(p_code text)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.promo_codes
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE code = upper(trim(p_code))
    AND active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_to   IS NULL OR valid_to   >= now())
    AND (max_uses   IS NULL OR used_count < max_uses)
  RETURNING promo_codes.id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_promo_usage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_usage(text) TO service_role;