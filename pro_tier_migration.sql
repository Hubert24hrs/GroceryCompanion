-- Add is_pro column to profiles
alter table profiles add column if not exists is_pro boolean default false;

-- Add policy to allow users to update their own profile (for upgrading status in MVP)
create policy "Update own profile" on profiles for update using (auth.uid() = id);

-- Function to handle upgrade (optional, but good for RPC)
create or replace function upgrade_to_pro()
returns void as $$
begin
  update profiles set is_pro = true where id = auth.uid();
end;
$$ language plpgsql security definer;
