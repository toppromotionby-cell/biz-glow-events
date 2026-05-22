-- Remove public-readable RLS on catalog tables. All public reads go through
-- server functions (supabaseAdmin), which now conditionally strips pricing
-- for unauthenticated visitors.
DROP POLICY IF EXISTS "Public reads published zones" ON public.zones;
DROP POLICY IF EXISTS "Public reads published tech_equipment" ON public.tech_equipment;
DROP POLICY IF EXISTS "Public reads published services" ON public.services;
DROP POLICY IF EXISTS "Public reads published production_items" ON public.production_items;

-- Authenticated users may still read published items directly (e.g. for
-- realtime, wishlist verification). Pricing is still in the row — fine,
-- since these are logged-in users.
CREATE POLICY "Authenticated reads published zones" ON public.zones
  FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "Authenticated reads published tech_equipment" ON public.tech_equipment
  FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "Authenticated reads published services" ON public.services
  FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "Authenticated reads published production_items" ON public.production_items
  FOR SELECT TO authenticated USING (published = true);

-- Order owners may read their own order timeline events
CREATE POLICY "Users view own order timeline" ON public.order_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_timeline.order_id AND o.user_id = auth.uid()
  ));
