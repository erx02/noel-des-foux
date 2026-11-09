-- Supabase migration for the family gift-list application.
-- Invitation and initial family provisioning are intentionally operator-only.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

revoke all on schema public from public, anon, authenticated;
grant usage on schema public to authenticated;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  constraint families_name_length check (char_length(btrim(name)) between 1 and 100)
);

create table public.family_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint family_members_family_user_unique unique (family_id, user_id),
  constraint family_members_display_name_length
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint family_members_role_check check (role in ('admin', 'member'))
);

create function private.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select fm.family_id
  from public.family_members as fm
  where fm.user_id = auth.uid()
$$;

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.current_family_id(),
  owner_id uuid not null default auth.uid(),
  title varchar(150) not null,
  description varchar(2000),
  product_url text,
  image_url text,
  estimated_price_cents integer,
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wishes_id_family_unique unique (id, family_id),
  constraint wishes_owner_family_fk
    foreign key (family_id, owner_id)
    references public.family_members(family_id, user_id)
    on delete cascade,
  constraint wishes_title_length
    check (char_length(btrim(title)) between 1 and 150),
  constraint wishes_description_length
    check (description is null or char_length(description) <= 2000),
  constraint wishes_product_url_check
    check (
      product_url is null
      or (
        char_length(product_url) <= 2048
        and btrim(product_url) ~* '^https?://[^[:space:]]+$'
      )
    ),
  constraint wishes_image_url_check
    check (
      image_url is null
      or (
        char_length(image_url) <= 2048
        and btrim(image_url) ~* '^https?://[^[:space:]]+$'
      )
    ),
  constraint wishes_price_check
    check (
      estimated_price_cents is null
      or estimated_price_cents between 1 and 10000000
    ),
  constraint wishes_priority_check check (priority in ('low', 'normal', 'high'))
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null,
  family_id uuid not null,
  reserved_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint reservations_one_per_wish unique (wish_id),
  constraint reservations_wish_family_fk
    foreign key (wish_id, family_id)
    references public.wishes(id, family_id)
    on delete cascade,
  constraint reservations_member_family_fk
    foreign key (family_id, reserved_by)
    references public.family_members(family_id, user_id)
    on delete cascade
);

create index family_members_family_idx on public.family_members (family_id);
create index wishes_family_owner_created_idx
  on public.wishes (family_id, owner_id, created_at desc);
create index reservations_family_idx on public.reservations (family_id);
create index reservations_reserved_by_idx on public.reservations (reserved_by);

create function private.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.family_members as fm
      where fm.family_id = p_family_id
        and fm.user_id = auth.uid()
    )
$$;

create function private.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.family_members as fm
      where fm.family_id = p_family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
$$;

create function private.set_reservation_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wish_family_id uuid;
  wish_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Reservation not allowed';
  end if;

  select w.family_id, w.owner_id
    into wish_family_id, wish_owner_id
  from public.wishes as w
  where w.id = new.wish_id;

  if not found
     or wish_owner_id = auth.uid()
     or not private.is_family_member(wish_family_id) then
    raise exception using errcode = '42501', message = 'Reservation not allowed';
  end if;

  new.family_id := wish_family_id;
  new.reserved_by := auth.uid();
  return new;
end
$$;

create function private.set_wish_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function private.current_family_id() from public, anon, authenticated;
revoke all on function private.is_family_member(uuid) from public, anon, authenticated;
revoke all on function private.is_family_admin(uuid) from public, anon, authenticated;
revoke all on function private.set_reservation_identity() from public, anon, authenticated;
revoke all on function private.set_wish_updated_at() from public, anon, authenticated;
grant execute on function private.current_family_id() to authenticated;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.is_family_admin(uuid) to authenticated;

create trigger reservations_set_identity
before insert on public.reservations
for each row execute function private.set_reservation_identity();

create trigger wishes_set_updated_at
before update on public.wishes
for each row execute function private.set_wish_updated_at();

alter table public.families enable row level security;
alter table public.families force row level security;
alter table public.family_members enable row level security;
alter table public.family_members force row level security;
alter table public.wishes enable row level security;
alter table public.wishes force row level security;
alter table public.reservations enable row level security;
alter table public.reservations force row level security;

-- A family member reads only their own family's record; only its admins may rename it.
create policy families_select_own_family
on public.families for select to authenticated
using (private.is_family_member(id));

create policy families_update_admin
on public.families for update to authenticated
using (private.is_family_admin(id))
with check (private.is_family_admin(id));

-- Members may see limited profiles in their family. Members may edit their own
-- display name; admins may edit any display name in that same family.
create policy family_members_select_own_family
on public.family_members for select to authenticated
using (private.is_family_member(family_id));

create policy family_members_insert_admin
on public.family_members for insert to authenticated
with check (
  role = 'member'
  and private.is_family_admin(family_id)
  and user_id <> auth.uid()
);

create policy family_members_update_names
on public.family_members for update to authenticated
using (
  private.is_family_member(family_id)
  and (user_id = auth.uid() or private.is_family_admin(family_id))
)
with check (
  private.is_family_member(family_id)
  and (user_id = auth.uid() or private.is_family_admin(family_id))
);

create policy family_members_delete_admin
on public.family_members for delete to authenticated
using (
  user_id <> auth.uid()
  and private.is_family_admin(family_id)
);

-- Every family member can read family wishes; only the owner may mutate a wish.
create policy wishes_select_own_family
on public.wishes for select to authenticated
using (private.is_family_member(family_id));

create policy wishes_insert_self
on public.wishes for insert to authenticated
with check (
  owner_id = auth.uid()
  and family_id = private.current_family_id()
  and private.is_family_member(family_id)
);

create policy wishes_update_owner
on public.wishes for update to authenticated
using (
  owner_id = auth.uid()
  and private.is_family_member(family_id)
)
with check (
  owner_id = auth.uid()
  and family_id = private.current_family_id()
  and private.is_family_member(family_id)
);

create policy wishes_delete_owner
on public.wishes for delete to authenticated
using (
  owner_id = auth.uid()
  and private.is_family_member(family_id)
);

-- The wish owner cannot read their reservation row, including reserved_by.
-- Reservation rows are intentionally excluded from Realtime publication below:
-- even an event without columns could reveal a surprise's reservation status.
create policy reservations_select_non_owner_family
on public.reservations for select to authenticated
using (
  private.is_family_member(family_id)
  and exists (
    select 1
    from public.wishes as w
    where w.id = wish_id
      and w.family_id = family_id
      and w.owner_id <> auth.uid()
  )
);

create policy reservations_insert_other_member_wish
on public.reservations for insert to authenticated
with check (
  reserved_by = auth.uid()
  and private.is_family_member(family_id)
  and exists (
    select 1
    from public.wishes as w
    where w.id = wish_id
      and w.family_id = family_id
      and w.owner_id <> auth.uid()
  )
);

create policy reservations_delete_own
on public.reservations for delete to authenticated
using (
  reserved_by = auth.uid()
  and private.is_family_member(family_id)
  and exists (
    select 1
    from public.wishes as w
    where w.id = wish_id
      and w.family_id = family_id
      and w.owner_id <> auth.uid()
  )
);

-- Deny by default, then grant only the needed table/column operations.
revoke all on public.families, public.family_members, public.wishes, public.reservations
  from public, anon, authenticated;

grant select on public.families to authenticated;
grant update (name) on public.families to authenticated;

grant select on public.family_members to authenticated;
grant insert (family_id, user_id, display_name) on public.family_members to authenticated;
grant update (display_name) on public.family_members to authenticated;
grant delete on public.family_members to authenticated;

grant select on public.wishes to authenticated;
grant insert (title, description, product_url, image_url, estimated_price_cents, priority)
  on public.wishes to authenticated;
grant update (title, description, product_url, image_url, estimated_price_cents, priority)
  on public.wishes to authenticated;
grant delete on public.wishes to authenticated;

grant select on public.reservations to authenticated;
grant insert (wish_id) on public.reservations to authenticated;
grant delete on public.reservations to authenticated;

-- Do not publish reservation changes: Realtime event timing itself could reveal
-- whether a wish is reserved to its owner. Clients revalidate via RLS polling.
do $$
declare
  publishes_all_tables boolean;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Supabase publication supabase_realtime is required';
  end if;

  select puballtables into publishes_all_tables
  from pg_publication
  where pubname = 'supabase_realtime';

  if publishes_all_tables then
    raise exception 'supabase_realtime must not publish all tables; reservation privacy requires an explicit table list';
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservations'
  ) then
    execute 'alter publication supabase_realtime drop table public.reservations';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'families'
  ) then
    execute 'alter publication supabase_realtime add table public.families';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_members'
  ) then
    execute 'alter publication supabase_realtime add table public.family_members';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wishes'
  ) then
    execute 'alter publication supabase_realtime add table public.wishes';
  end if;
end
$$;
