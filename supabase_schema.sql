-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. Tables
-- ==========================================

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Shopping Lists
create table lists (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users not null,
  store_id text,
  store_name text,
  color text default '#4CAF50',
  is_archived boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sync_version integer default 0
);

-- List Access (Collaborators)
create table list_members (
  list_id uuid references lists on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('owner', 'editor', 'viewer')) default 'editor',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (list_id, user_id)
);

-- List Items
create table items (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references lists on delete cascade not null,
  name text not null,
  category text not null,
  quantity numeric,
  unit text,
  notes text,
  is_checked boolean default false,
  is_in_pantry boolean default false,
  added_by uuid references auth.users,
  checked_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sync_version integer default 0
);

-- ==========================================
-- 2. Row Level Security (RLS)
-- ==========================================

-- Enable RLS
alter table profiles enable row level security;
alter table lists enable row level security;
alter table list_members enable row level security;
alter table items enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone." on profiles
  for select using ( true );

create policy "Users can insert their own profile." on profiles
  for insert with check ( auth.uid() = id );

create policy "Users can update own profile." on profiles
  for update using ( auth.uid() = id );

-- Lists Policies
-- Users can see lists they are a member of (or owner)
create policy "Users can view lists they joined" on lists
  for select using (
    exists (
      select 1 from list_members
      where list_members.list_id = lists.id
      and list_members.user_id = auth.uid()
    )
    or owner_id = auth.uid() -- redundant if owner is also in list_members, but safe
  );

create policy "Users can insert lists" on lists
  for insert with check ( auth.uid() = owner_id );

create policy "Owners and editors can update lists" on lists
  for update using (
    exists (
      select 1 from list_members
      where list_members.list_id = lists.id
      and list_members.user_id = auth.uid()
      and list_members.role in ('owner', 'editor')
    )
  );

create policy "Owners can delete lists" on lists
  for delete using ( owner_id = auth.uid() );

-- List Members Policies
create policy "Members can view other members of the same list" on list_members
  for select using (
    exists (
      select 1 from list_members as lm
      where lm.list_id = list_members.list_id
      and lm.user_id = auth.uid()
    )
  );

-- Items Policies
create policy "Members can view items in their lists" on items
  for select using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
      and list_members.user_id = auth.uid()
    )
  );

create policy "Members can insert items" on items
  for insert with check (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
      and list_members.user_id = auth.uid()
      and list_members.role in ('owner', 'editor')
    )
  );

create policy "Members can update items" on items
  for update using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
      and list_members.user_id = auth.uid()
      and list_members.role in ('owner', 'editor')
    )
  );

create policy "Members can delete items" on items
  for delete using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
      and list_members.user_id = auth.uid()
      and list_members.role in ('owner', 'editor')
    )
  );

-- ==========================================
-- 3. Functions & Triggers
-- ==========================================

-- Function to handle new user signup (Profile creation)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to automatically add owner to list_members on list creation
create or replace function public.handle_new_list()
returns trigger as $$
begin
  insert into public.list_members (list_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_list_created
  after insert on lists
  for each row execute procedure public.handle_new_list();

-- Helper function to join a list via code (RPC)
create or replace function join_list(list_id_input uuid)
returns void as $$
begin
  if not exists (select 1 from lists where id = list_id_input) then
    raise exception 'List not found';
  end if;

  insert into list_members (list_id, user_id, role)
  values (list_id_input, auth.uid(), 'editor')
  on conflict (list_id, user_id) do nothing;
end;
$$ language plpgsql security definer;
