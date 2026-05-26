DROP TABLE IF EXISTS public.email_campaign_recipients CASCADE;
DROP TABLE IF EXISTS public.email_campaigns CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DELETE FROM public.site_sections WHERE key IN ('footer.newsletter', 'global.exit_intent');