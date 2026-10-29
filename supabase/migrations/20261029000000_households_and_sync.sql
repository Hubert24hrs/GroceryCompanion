-- GroceryCompanion v2: households, offline sync, pantry/recipes/meal plans/purchases,
-- invite codes and a locked-down subscription entitlement.
--
-- Safe to run on a database that already has the v1 schema: existing lists and
-- items are moved into a household owned by each list owner, and v1
-- collaborators join that household with their list role.

begin;

-- ════════════════════════════ households ════════════════════════════

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household' check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members (user_id);

create table if not exists public.household_invites (
  code text primary key check (code ~ '^[A-Z0-9]{10}$'),
  household_id uuid not null references public.households on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses int not null default 5 check (max_uses between 1 and 50),
  use_count int not null default 0,
  revoked boolean not null default false
);

-- Written only by the RevenueCat webhook (service role). Clients can read their own row.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  is_pro boolean not null default false,
  product_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Membership helpers. SECURITY DEFINER so policies can call them without
-- recursing into household_members' own RLS.
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.household_role(hid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from household_members where household_id = hid and user_id = auth.uid();
$$;

create or replace function public.can_edit_household(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.household_role(hid) in ('owner', 'editor'), false);
$$;

-- ════════════════════════════ profiles ════════════════════════════

alter table public.profiles add column if not exists display_name text check (char_length(display_name) <= 80);
alter table public.profiles add column if not exists household_size int not null default 2 check (household_size between 1 and 20);
alter table public.profiles add column if not exists dietary_preferences text[] not null default '{}';
alter table public.profiles add column if not exists monthly_budget numeric check (monthly_budget >= 0);
alter table public.profiles add column if not exists currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$');

-- v1 let any user grant themselves Pro. Remove every path to that.
drop function if exists public.upgrade_to_pro();
drop policy if exists "Update own profile" on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, household_size, dietary_preferences, monthly_budget, currency, updated_at)
  on public.profiles to authenticated;

create policy "profiles: read self and household" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from household_members mine
    join household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "profiles: update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ════════════════════════════ evolve lists & items ════════════════════════════

alter table public.lists add column if not exists household_id uuid references public.households on delete cascade;
alter table public.lists add column if not exists icon text not null default 'cart';
alter table public.lists add column if not exists budget numeric check (budget >= 0);
alter table public.lists add column if not exists sort_order int not null default 0;
alter table public.lists add column if not exists is_template boolean not null default false;
alter table public.lists add column if not exists deleted_at timestamptz;
alter table public.lists add column if not exists server_updated_at timestamptz not null default clock_timestamp();
alter table public.lists alter column owner_id drop not null;
alter table public.lists alter column color set default '#1F8A4C';
alter table public.lists alter column is_archived set not null;

alter table public.items add column if not exists household_id uuid references public.households on delete cascade;
alter table public.items add column if not exists price numeric check (price >= 0);
alter table public.items add column if not exists checked_at timestamptz;
alter table public.items add column if not exists barcode text check (char_length(barcode) <= 64);
alter table public.items add column if not exists recipe_id uuid;
alter table public.items add column if not exists deleted_at timestamptz;
alter table public.items add column if not exists server_updated_at timestamptz not null default clock_timestamp();
alter table public.items alter column is_checked set not null;

-- ════════════════════════════ new household tables ════════════════════════════

create table if not exists public.pantry_items (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'other',
  quantity numeric not null default 1 check (quantity >= 0),
  unit text check (char_length(unit) <= 20),
  low_stock_threshold numeric check (low_stock_threshold >= 0),
  expires_on date,
  location text not null default 'pantry' check (location in ('fridge', 'freezer', 'pantry', 'other')),
  barcode text check (char_length(barcode) <= 64),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.recipes (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  source_name text check (char_length(source_name) <= 120),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  prep_minutes int check (prep_minutes between 0 and 10000),
  cook_minutes int check (cook_minutes between 0 and 10000),
  servings numeric not null default 2 check (servings > 0 and servings <= 100),
  calories int check (calories >= 0),
  ingredients jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array' and pg_column_size(ingredients) < 100000),
  instructions jsonb not null default '[]' check (jsonb_typeof(instructions) = 'array' and pg_column_size(instructions) < 100000),
  tags text[] not null default '{}',
  collection text check (char_length(collection) <= 80),
  is_favorite boolean not null default false,
  estimated_cost numeric check (estimated_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.meal_plan_entries (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid,
  title text check (char_length(title) <= 200),
  servings numeric check (servings > 0 and servings <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  check (recipe_id is not null or title is not null)
);

create table if not exists public.purchases (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  list_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'other',
  quantity numeric check (quantity >= 0),
  unit text check (char_length(unit) <= 20),
  price numeric not null check (price >= 0 and price < 1000000),
  store_name text check (char_length(store_name) <= 120),
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- ════════════════════════════ backfill v1 data ════════════════════════════

-- One household per existing list owner.
insert into public.households (id, name, owner_id)
select gen_random_uuid(), 'My Household', o.owner_id
from (select distinct owner_id from public.lists where owner_id is not null and household_id is null) o
where not exists (select 1 from public.household_members m where m.user_id = o.owner_id and m.role = 'owner');

insert into public.household_members (household_id, user_id, role)
select h.id, h.owner_id, 'owner' from public.households h
on conflict do nothing;

update public.lists l set household_id = m.household_id
from public.household_members m
where l.household_id is null and m.user_id = l.owner_id and m.role = 'owner';

-- v1 per-list collaborators join the owner's household.
insert into public.household_members (household_id, user_id, role)
select distinct on (l.household_id, lm.user_id) l.household_id, lm.user_id, case when lm.role = 'viewer' then 'viewer' else 'editor' end
from public.list_members lm join public.lists l on l.id = lm.list_id
where l.household_id is not null and lm.user_id <> l.owner_id
on conflict do nothing;

update public.items i set household_id = l.household_id
from public.lists l where i.list_id = l.id and i.household_id is null;

-- v1 "pantry" was a flag on list items: copy them into the pantry, then tombstone them.
insert into public.pantry_items (id, household_id, name, category, quantity, unit, created_at, updated_at)
select gen_random_uuid(), household_id, name, category, coalesce(quantity, 1), unit, created_at, updated_at
from public.items where is_in_pantry and deleted_at is null and household_id is not null;
update public.items set deleted_at = now(), updated_at = now() where is_in_pantry and deleted_at is null;

alter table public.lists alter column household_id set not null;
alter table public.items alter column household_id set not null;

-- v1 sharing artefacts.
drop trigger if exists on_list_created on public.lists;
drop function if exists public.handle_new_list();
drop function if exists public.join_list(uuid);

-- Category whitelist on every table that stores one.
do $$
declare t text;
begin
  foreach t in array array['items', 'pantry_items', 'purchases'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_category_check');
    execute format(
      'alter table public.%I add constraint %I check (category in (''produce'',''dairy'',''meat'',''seafood'',''bakery'',''frozen'',''pantry'',''snacks'',''beverages'',''household'',''personal_care'',''baby'',''pets'',''other''))',
      t, t || '_category_check');
  end loop;
end $$;

-- ════════════════════════════ sync triggers ════════════════════════════

-- Last-writer-wins: a write older than the stored row is ignored (returns null
-- so the upsert becomes a no-op). Client clocks running ahead are clamped.
-- server_updated_at is the pull cursor and is always server time.
create or replace function public.sync_row_guard()
returns trigger language plpgsql as $$
begin
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

-- Items must belong to a list in the same household.
create or replace function public.items_household_matches_list()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lists where id = new.list_id and household_id = new.household_id) then
    raise exception 'item household does not match its list' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists items_household_check on public.items;
create trigger items_household_check before insert or update of list_id, household_id on public.items
  for each row execute function public.items_household_matches_list();

do $$
declare t text;
begin
  foreach t in array array['lists', 'items', 'pantry_items', 'recipes', 'meal_plan_entries', 'purchases'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_sync_guard', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.sync_row_guard()', t || '_sync_guard', t);
    execute format('create index if not exists %I on public.%I (server_updated_at, id)', t || '_pull_idx', t);
    execute format('create index if not exists %I on public.%I (household_id)', t || '_household_idx', t);
  end loop;
end $$;

-- ════════════════════════════ row level security ════════════════════════════

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.purchases enable row level security;

-- Replace every v1 policy on lists/items/list_members (the list_members one recursed).
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('lists', 'items', 'list_members') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "list_members: own rows (deprecated)" on public.list_members for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['lists', 'items', 'pantry_items', 'recipes', 'meal_plan_entries', 'purchases'] loop
    execute format('create policy %I on public.%I for select using (public.is_household_member(household_id))', t || ': members read', t);
    execute format('create policy %I on public.%I for insert with check (public.can_edit_household(household_id))', t || ': editors insert', t);
    execute format('create policy %I on public.%I for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id))', t || ': editors update', t);
    execute format('create policy %I on public.%I for delete using (public.can_edit_household(household_id))', t || ': editors delete', t);
  end loop;
end $$;

create policy "households: members read" on public.households for select using (public.is_household_member(id));
create policy "households: owner renames" on public.households for update
  using (public.household_role(id) = 'owner') with check (owner_id = auth.uid());
create policy "households: owner deletes" on public.households for delete using (owner_id = auth.uid());

create policy "members: members read" on public.household_members for select using (public.is_household_member(household_id));
create policy "members: owner changes roles" on public.household_members for update
  using (public.household_role(household_id) = 'owner' and user_id <> auth.uid())
  with check (role in ('editor', 'viewer'));
create policy "members: leave or owner removes" on public.household_members for delete using (
  (user_id = auth.uid() and role <> 'owner')
  or (public.household_role(household_id) = 'owner' and user_id <> auth.uid())
);

create policy "invites: editors read" on public.household_invites for select using (public.can_edit_household(household_id));
create policy "invites: editors revoke" on public.household_invites for update
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
create policy "invites: editors delete" on public.household_invites for delete using (public.can_edit_household(household_id));

create policy "subscriptions: read own" on public.subscriptions for select using (user_id = auth.uid());

revoke insert on public.households, public.household_members, public.household_invites from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke all on public.list_members from anon;

-- ════════════════════════════ RPCs ════════════════════════════

-- Called after sign-in. Returns the user's household, creating one (with the
-- id the device already uses offline) when they have none.
create or replace function public.bootstrap_household(p_household_id uuid default null, p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select household_id into hid from household_members
  where user_id = uid order by (role = 'owner') desc, joined_at limit 1;
  if hid is not null then return hid; end if;

  hid := p_household_id;
  if hid is null or exists (select 1 from households where id = hid) then
    hid := gen_random_uuid();
  end if;
  insert into households (id, name, owner_id) values (hid, coalesce(nullif(trim(p_name), ''), 'My Household'), uid);
  insert into household_members (household_id, user_id, role) values (hid, uid, 'owner');
  return hid;
end $$;

create or replace function public.household_members_view(p_household_id uuid)
returns table (user_id uuid, role text, email text, display_name text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, p.email, p.display_name, m.joined_at
  from household_members m left join profiles p on p.id = m.user_id
  where m.household_id = p_household_id and public.is_household_member(p_household_id)
  order by (m.role = 'owner') desc, m.joined_at;
$$;

create or replace function public.create_invite(p_household_id uuid, p_role text default 'editor')
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  exp timestamptz := now() + interval '7 days';
begin
  if not public.can_edit_household(p_household_id) then
    raise exception 'not allowed to invite' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  loop
    -- 10 chars from a v4 UUID (cryptographically random): 40 bits, expires in a week.
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from household_invites i where i.code = new_code);
  end loop;
  insert into household_invites (code, household_id, role, created_by, expires_at)
  values (new_code, p_household_id, p_role, auth.uid(), exp);
  return query select new_code, exp;
end $$;

create or replace function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv household_invites%rowtype;
  owner_pro boolean;
  member_count int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select * into inv from household_invites where code = upper(trim(p_code)) for update;
  if not found or inv.revoked or inv.expires_at < now() or inv.use_count >= inv.max_uses then
    raise exception 'invite_invalid' using errcode = 'P0001', hint = 'This invite code is invalid or has expired.';
  end if;

  if exists (select 1 from household_members where household_id = inv.household_id and user_id = uid) then
    return inv.household_id;
  end if;

  select coalesce(s.is_pro and (s.expires_at is null or s.expires_at > now()), false) into owner_pro
  from households h left join subscriptions s on s.user_id = h.owner_id
  where h.id = inv.household_id;

  select count(*) into member_count from household_members where household_id = inv.household_id;
  if not coalesce(owner_pro, false) and member_count >= 3 then
    raise exception 'household_full' using errcode = 'P0001', hint = 'This household is full. The owner can upgrade to Pro to add more people.';
  end if;

  insert into household_members (household_id, user_id, role) values (inv.household_id, uid, inv.role);
  update household_invites set use_count = use_count + 1 where code = inv.code;
  return inv.household_id;
end $$;

-- Functions are executable by PUBLIC by default; only signed-in users may call these.
revoke execute on function public.bootstrap_household(uuid, text), public.household_members_view(uuid),
  public.create_invite(uuid, text), public.accept_invite(text) from public, anon;
grant execute on function public.bootstrap_household(uuid, text), public.household_members_view(uuid),
  public.create_invite(uuid, text), public.accept_invite(text) to authenticated;

-- ════════════════════════════ realtime ════════════════════════════

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['lists', 'items', 'pantry_items', 'recipes', 'meal_plan_entries', 'purchases', 'household_members'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

commit;
