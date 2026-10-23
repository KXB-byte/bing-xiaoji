create table if not exists public.xiaoji_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('item', 'template', 'options')),
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, record_type, record_id)
);

create index if not exists xiaoji_sync_records_updated_at_idx
  on public.xiaoji_sync_records (user_id, updated_at);

alter table public.xiaoji_sync_records enable row level security;

revoke all on public.xiaoji_sync_records from anon;
grant select, insert, update, delete on public.xiaoji_sync_records to authenticated;
grant select on public.xiaoji_sync_records to service_role;

drop policy if exists "Users can read their own Xiaoji records" on public.xiaoji_sync_records;
create policy "Users can read their own Xiaoji records"
  on public.xiaoji_sync_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own Xiaoji records" on public.xiaoji_sync_records;
create policy "Users can insert their own Xiaoji records"
  on public.xiaoji_sync_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Xiaoji records" on public.xiaoji_sync_records;
create policy "Users can update their own Xiaoji records"
  on public.xiaoji_sync_records
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own Xiaoji records" on public.xiaoji_sync_records;
create policy "Users can delete their own Xiaoji records"
  on public.xiaoji_sync_records
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.xiaoji_push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  time_zone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.xiaoji_push_subscriptions enable row level security;

revoke all on public.xiaoji_push_subscriptions from anon;
grant select, insert, update, delete on public.xiaoji_push_subscriptions to authenticated;
grant select, delete on public.xiaoji_push_subscriptions to service_role;

drop policy if exists "Users can read their own push subscriptions" on public.xiaoji_push_subscriptions;
create policy "Users can read their own push subscriptions"
  on public.xiaoji_push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own push subscriptions" on public.xiaoji_push_subscriptions;
create policy "Users can insert their own push subscriptions"
  on public.xiaoji_push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own push subscriptions" on public.xiaoji_push_subscriptions;
create policy "Users can update their own push subscriptions"
  on public.xiaoji_push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own push subscriptions" on public.xiaoji_push_subscriptions;
create policy "Users can delete their own push subscriptions"
  on public.xiaoji_push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.xiaoji_reminder_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  reminder_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (user_id, item_id, reminder_at)
);

alter table public.xiaoji_reminder_deliveries enable row level security;
revoke all on public.xiaoji_reminder_deliveries from anon, authenticated;
grant select, insert, update, delete on public.xiaoji_reminder_deliveries to service_role;
