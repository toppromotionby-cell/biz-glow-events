
create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.support_threads(user_id);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender text not null check (sender in ('user','admin')),
  content text not null check (char_length(content) between 1 and 4000),
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);
create index on public.support_messages(thread_id, created_at);
create index on public.support_messages(telegram_message_id) where telegram_message_id is not null;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create policy "users see own threads" on public.support_threads
  for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "users create own thread" on public.support_threads
  for insert to authenticated with check (auth.uid() = user_id);
create policy "admins update threads" on public.support_threads
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "users see own messages" on public.support_messages
  for select to authenticated using (
    exists (select 1 from public.support_threads t where t.id = thread_id
      and (t.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );
create policy "users insert own messages" on public.support_messages
  for insert to authenticated with check (
    sender = 'user' and exists (
      select 1 from public.support_threads t where t.id = thread_id and t.user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.support_messages;
alter table public.support_messages replica identity full;
