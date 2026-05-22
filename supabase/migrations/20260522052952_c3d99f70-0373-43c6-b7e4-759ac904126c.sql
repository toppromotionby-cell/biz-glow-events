-- 1. Revoke direct column access to pricing on catalog tables
REVOKE SELECT (pricing) ON public.zones FROM anon, authenticated;
REVOKE SELECT (pricing) ON public.services FROM anon, authenticated;
REVOKE SELECT (pricing) ON public.tech_equipment FROM anon, authenticated;
REVOKE SELECT (pricing) ON public.production_items FROM anon, authenticated;

-- Grant SELECT on all other columns explicitly to preserve client reads
GRANT SELECT (id, slug, title, short_description, description, photo_urls, video_urls, features, faq, requirements, seo_title, seo_description, category, published, created_at, updated_at)
  ON public.zones TO anon, authenticated;
GRANT SELECT (id, slug, title, short_description, description, photo_urls, video_urls, features, faq, requirements, seo_title, seo_description, category, published, created_at, updated_at)
  ON public.services TO anon, authenticated;
GRANT SELECT (id, slug, title, short_description, description, photo_urls, video_urls, features, faq, requirements, seo_title, seo_description, category, published, created_at, updated_at)
  ON public.tech_equipment TO anon, authenticated;
GRANT SELECT (id, slug, title, short_description, description, photo_urls, video_urls, features, faq, requirements, seo_title, seo_description, category, published, created_at, updated_at)
  ON public.production_items TO anon, authenticated;

-- Content editors / admins still need full access including pricing
GRANT SELECT (pricing), INSERT (pricing), UPDATE (pricing) ON public.zones TO authenticated;
GRANT SELECT (pricing), INSERT (pricing), UPDATE (pricing) ON public.services TO authenticated;
GRANT SELECT (pricing), INSERT (pricing), UPDATE (pricing) ON public.tech_equipment TO authenticated;
GRANT SELECT (pricing), INSERT (pricing), UPDATE (pricing) ON public.production_items TO authenticated;
-- Note: above re-grants pricing to authenticated. We need a different approach.
-- Revoke again and rely on service role for pricing reads.
REVOKE SELECT (pricing) ON public.zones FROM authenticated;
REVOKE SELECT (pricing) ON public.services FROM authenticated;
REVOKE SELECT (pricing) ON public.tech_equipment FROM authenticated;
REVOKE SELECT (pricing) ON public.production_items FROM authenticated;
-- Keep INSERT/UPDATE on pricing for editors (RLS still gates by role)
-- (already granted above)

-- 2. Realtime channel authorization: restrict subscriptions to known public topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read public realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read public realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() IN ('site_sections', 'text_overrides', 'public:site_sections', 'public:text_overrides'))
);

DROP POLICY IF EXISTS "Anon can read public realtime topics" ON realtime.messages;
CREATE POLICY "Anon can read public realtime topics"
ON realtime.messages
FOR SELECT
TO anon
USING (
  (realtime.topic() IN ('site_sections', 'text_overrides', 'public:site_sections', 'public:text_overrides'))
);