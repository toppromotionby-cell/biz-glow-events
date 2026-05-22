
-- 1. promo_codes: drop public read; validation is done server-side via supabaseAdmin
DROP POLICY IF EXISTS "Public reads active promo codes" ON public.promo_codes;

-- 2. availability: drop overly broad public read
DROP POLICY IF EXISTS "Public reads availability" ON public.availability;

-- 3. storage.objects: restrict media bucket read to staff only
DROP POLICY IF EXISTS "Authenticated read media" ON storage.objects;
CREATE POLICY "Staff read media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'content_editor'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- 4. newsletter_subscribers: replace permissive INSERT with a basic shape check
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND char_length(email) BETWEEN 5 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND confirmed = false
    AND unsubscribed_at IS NULL
  );

-- 5. Restrict direct execution of has_role; RLS policies still call it as table owner
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
