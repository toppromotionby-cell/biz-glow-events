delete from public.order_timeline where order_id = '5d6950e7-cde1-48f5-b361-e70ea39eb129';
delete from public.order_items where order_id = '5d6950e7-cde1-48f5-b361-e70ea39eb129';
delete from public.telegram_logs where order_id = '5d6950e7-cde1-48f5-b361-e70ea39eb129';
delete from public.orders where id = '5d6950e7-cde1-48f5-b361-e70ea39eb129';
delete from auth.users where email like 'e2e%@example.com';