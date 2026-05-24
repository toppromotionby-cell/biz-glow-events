-- Restrict Realtime channel subscriptions for support chat to the thread owner or admins.
-- Channels are named "support-<threadId>" in src/components/SupportChat.tsx.

-- Drop any prior versions (idempotent re-run).
drop policy if exists "support chat: thread owner or admin can subscribe" on realtime.messages;
drop policy if exists "deny anon support realtime" on realtime.messages;

-- Authenticated users may receive Realtime events ONLY for their own support thread topic.
create policy "support chat: thread owner or admin can subscribe"
on realtime.messages
for select
to authenticated
using (
  -- Non-support topics: not constrained by this policy.
  case
    when (realtime.topic()) like 'support-%' then
      exists (
        select 1
        from public.support_threads t
        where t.id::text = substring((realtime.topic()) from 9)
          and (t.user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::app_role))
      )
    else true
  end
);

-- Block anon role from any support-* topic explicitly.
create policy "deny anon support realtime"
on realtime.messages
for select
to anon
using (
  (realtime.topic()) not like 'support-%'
);
