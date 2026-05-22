-- Tighten orders INSERT policy: explicitly require authenticated user
DROP POLICY IF EXISTS "Users create orders" ON public.orders;
CREATE POLICY "Users create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Allow public (anon + authenticated) read of media bucket objects
-- so published catalog images render for site visitors. Bucket stays private
-- (no listing), but individual object reads via known path are permitted.
CREATE POLICY "Public reads media objects"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media');
