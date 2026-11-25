create table public.child_wish_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default private.current_family_id(),
  owner_id uuid not null default auth.uid(),
  name varchar(80) not null,
  created_at timestamptz not null default now(),
  constraint child_wish_lists_id_family_owner_unique unique (id, family_id, owner_id),
  constraint child_wish_lists_owner_family_fk
    foreign key (family_id, owner_id)
    references public.family_members(family_id, user_id)
    on delete cascade,
  constraint child_wish_lists_name_length
    check (char_length(btrim(name)) between 1 and 80)
);

create index child_wish_lists_family_owner_idx
  on public.child_wish_lists (family_id, owner_id);

alter table public.wishes
  add column child_list_id uuid;

alter table public.wishes
  add constraint wishes_child_list_owner_fk
  foreign key (child_list_id, family_id, owner_id)
  references public.child_wish_lists(id, family_id, owner_id)
  on delete cascade;

create index wishes_child_list_idx on public.wishes (child_list_id);

alter table public.child_wish_lists enable row level security;
alter table public.child_wish_lists force row level security;

create policy child_wish_lists_select_family
on public.child_wish_lists for select to authenticated
using (private.is_family_member(family_id));

create policy child_wish_lists_insert_owner
on public.child_wish_lists for insert to authenticated
with check (
  owner_id = auth.uid()
  and family_id = private.current_family_id()
  and private.is_family_member(family_id)
);

create policy child_wish_lists_update_owner
on public.child_wish_lists for update to authenticated
using (
  owner_id = auth.uid()
  and private.is_family_member(family_id)
)
with check (
  owner_id = auth.uid()
  and family_id = private.current_family_id()
  and private.is_family_member(family_id)
);

create policy child_wish_lists_delete_owner
on public.child_wish_lists for delete to authenticated
using (
  owner_id = auth.uid()
  and private.is_family_member(family_id)
);

revoke all on public.child_wish_lists from public, anon, authenticated;
grant select on public.child_wish_lists to authenticated;
grant insert (name) on public.child_wish_lists to authenticated;
grant update (name) on public.child_wish_lists to authenticated;
grant delete on public.child_wish_lists to authenticated;

grant insert (child_list_id) on public.wishes to authenticated;
grant update (child_list_id) on public.wishes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'child_wish_lists'
  ) then
    execute 'alter publication supabase_realtime add table public.child_wish_lists';
  end if;
end
$$;
