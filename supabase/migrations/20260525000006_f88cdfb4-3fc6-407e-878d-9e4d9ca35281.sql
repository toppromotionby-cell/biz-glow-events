-- Remove anon/authenticated SELECT policy on private 'media' bucket; staff-only read remains
DROP POLICY IF EXISTS "Public reads media objects" ON storage.objects;

-- Remove direct authenticated reads on catalog tables; reads must go through server fns (supabaseAdmin) which strip pricing
DROP POLICY IF EXISTS "Authenticated reads published services" ON public.services;
DROP POLICY IF EXISTS "Authenticated reads published zones" ON public.zones;
DROP POLICY IF EXISTS "Authenticated reads published tech_equipment" ON public.tech_equipment;
DROP POLICY IF EXISTS "Authenticated reads published production_items" ON public.production_items;
