-- Fix: realtime.messages had an `ELSE true` branch that let any authenticated
-- user subscribe to non-`support-%` Realtime topics, exposing other users'
-- orders and order_timeline broadcasts.

DROP POLICY IF EXISTS "support chat: thread owner or admin can subscribe" ON realtime.messages;

-- Support chat: only the thread owner or an admin may subscribe to support-<thread_id>.
CREATE POLICY "Support chat owner or admin can subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'support-%'
  AND EXISTS (
    SELECT 1
    FROM public.support_threads t
    WHERE t.id::text = substring(realtime.topic() FROM 9)
      AND (t.user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  )
);

-- Profile/orders channel: each user subscribes only to their own personal topic
-- (client uses channel name `profile-orders-<auth.uid()>`).
CREATE POLICY "Users subscribe to own profile orders channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'profile-orders-' || (SELECT auth.uid())::text
);

-- Admin orders channel: only admins / managers may subscribe.
CREATE POLICY "Staff subscribe to admin orders channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'admin-orders-rt'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'manager'::public.app_role)
  )
);
