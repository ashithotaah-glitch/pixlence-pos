-- OmniPOS multi-store foundation
-- Run this in Supabase SQL Editor before enabling cloud workspace sync.

create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  type text default 'General retail',
  website text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Owner',
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.store_states (
  store_id uuid primary key references public.stores(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_states enable row level security;

drop policy if exists "members can view stores" on public.stores;
create policy "members can view stores"
on public.stores for select
using (
  exists (
    select 1 from public.store_members sm
    where sm.store_id = stores.id and sm.user_id = auth.uid()
  )
);

drop policy if exists "owners can create stores" on public.stores;
create policy "owners can create stores"
on public.stores for insert
with check (owner_id = auth.uid());

drop policy if exists "owners can update stores" on public.stores;
create policy "owners can update stores"
on public.stores for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "members can view memberships" on public.store_members;
create policy "members can view memberships"
on public.store_members for select
using (user_id = auth.uid());

drop policy if exists "owners can create memberships" on public.store_members;
create policy "owners can create memberships"
on public.store_members for insert
with check (user_id = auth.uid());

drop policy if exists "members can view store state" on public.store_states;
create policy "members can view store state"
on public.store_states for select
using (
  exists (
    select 1 from public.store_members sm
    where sm.store_id = store_states.store_id and sm.user_id = auth.uid()
  )
);

drop policy if exists "members can write store state" on public.store_states;
create policy "members can write store state"
on public.store_states for all
using (
  exists (
    select 1 from public.store_members sm
    where sm.store_id = store_states.store_id and sm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_members sm
    where sm.store_id = store_states.store_id and sm.user_id = auth.uid()
  )
);
