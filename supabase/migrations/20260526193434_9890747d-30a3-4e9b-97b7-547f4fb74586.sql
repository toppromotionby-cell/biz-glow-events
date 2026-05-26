ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_timeline REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_timeline;