begin;

set local search_path to public, extensions;

create extension if not exists pgtap with schema extensions;

create temporary table test_fixture_ids (
  label text primary key,
  id uuid not null
);

-- Synthetic identities only; these users and all family data exist only inside
-- the rolled-back test transaction.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-a1@example.invalid', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-a2@example.invalid', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-a3@example.invalid', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-admin-a@example.invalid', '', now(), now(), now()),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-b1@example.invalid', '', now(), now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-admin-b@example.invalid', '', now(), now(), now());

insert into test_fixture_ids values
  ('a1', '10000000-0000-4000-8000-000000000001'),
  ('a2', '10000000-0000-4000-8000-000000000002'),
  ('a3', '10000000-0000-4000-8000-000000000003'),
  ('admin_a', '10000000-0000-4000-8000-000000000004'),
  ('b1', '20000000-0000-4000-8000-000000000001'),
  ('admin_b', '20000000-0000-4000-8000-000000000002');

grant select on test_fixture_ids to anon, authenticated;

with new_family as (
  insert into public.families (name, created_by)
  values ('Famille de test A', '10000000-0000-4000-8000-000000000004')
  returning id
)
insert into test_fixture_ids select 'family_a', id from new_family;

with new_family as (
  insert into public.families (name, created_by)
  values ('Famille de test B', '20000000-0000-4000-8000-000000000002')
  returning id
)
insert into test_fixture_ids select 'family_b', id from new_family;

insert into public.family_members (family_id, user_id, display_name, role)
select (select id from test_fixture_ids where label = 'family_a'), id,
       case label
         when 'a1' then 'Membre A1'
         when 'a2' then 'Membre A2'
         when 'a3' then 'Membre A3'
         else 'Admin A'
       end,
       case when label = 'admin_a' then 'admin' else 'member' end
from test_fixture_ids
where label in ('a1', 'a2', 'a3', 'admin_a');

insert into public.family_members (family_id, user_id, display_name, role)
select (select id from test_fixture_ids where label = 'family_b'), id,
       case label when 'b1' then 'Membre B1' else 'Admin B' end,
       case when label = 'admin_b' then 'admin' else 'member' end
from test_fixture_ids
where label in ('b1', 'admin_b');

with new_wish as (
  insert into public.wishes (family_id, owner_id, title)
  select (select id from test_fixture_ids where label = 'family_a'),
         (select id from test_fixture_ids where label = 'a1'), 'Souhait test A1'
  returning id
)
insert into test_fixture_ids select 'wish_a1', id from new_wish;

with new_wish as (
  insert into public.wishes (family_id, owner_id, title)
  select (select id from test_fixture_ids where label = 'family_a'),
         (select id from test_fixture_ids where label = 'a3'), 'Souhait test A3'
  returning id
)
insert into test_fixture_ids select 'wish_a3', id from new_wish;

with new_wish as (
  insert into public.wishes (family_id, owner_id, title)
  select (select id from test_fixture_ids where label = 'family_b'),
         (select id from test_fixture_ids where label = 'b1'), 'Souhait test B1'
  returning id
)
insert into test_fixture_ids select 'wish_b1', id from new_wish;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

insert into public.reservations (wish_id)
select id from test_fixture_ids where label = 'wish_a3';

insert into public.reservations (wish_id)
select id from test_fixture_ids where label = 'wish_a1';

select set_config('request.jwt.claim.sub', '', true);

select plan(25);

select ok(not has_schema_privilege('anon', 'public', 'usage'),
          'anon has no public schema access');
select ok(not has_table_privilege('anon', 'public.families', 'select'),
          'anon has no family SELECT privilege');
select ok(not has_table_privilege('anon', 'public.wishes', 'select'),
          'anon has no wish SELECT privilege');
select ok(not has_table_privilege('anon', 'public.reservations', 'select'),
          'anon has no reservation SELECT privilege');
select ok(not has_table_privilege('anon', 'public.wishes', 'insert'),
          'anon has no data INSERT privilege');
select ok(not has_function_privilege('anon', 'private.current_family_id()', 'execute'),
          'anon cannot call the family helper');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.families
           where id = (select id from test_fixture_ids where label = 'family_b')),
          0, 'family A cannot read family B');
select is((select count(*)::integer from public.wishes
           where id = (select id from test_fixture_ids where label = 'wish_b1')),
          0, 'family A cannot read family B wishes');
with changed as (
  update public.families set name = 'Tentative'
  where id = (select id from test_fixture_ids where label = 'family_b')
  returning 1
)
select is((select count(*)::integer from changed), 0, 'family A cannot rename family B');

with changed as (
  update public.wishes set title = 'Tentative'
  where id = (select id from test_fixture_ids where label = 'wish_b1')
  returning 1
)
select is((select count(*)::integer from changed), 0, 'family A cannot modify family B wishes');

with changed as (
  update public.wishes set title = 'Tentative'
  where id = (select id from test_fixture_ids where label = 'wish_a3')
  returning 1
)
select is((select count(*)::integer from changed), 0, 'a member cannot modify another member wish');
select throws_ok(
  $$insert into public.wishes (title, owner_id) values ('Falsified owner', '10000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'a member cannot insert a wish for another user'
);
select throws_ok(
  $$insert into public.wishes (title, family_id) values ('Falsified family', '00000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a member cannot supply a forged family_id'
);
select lives_ok(
  $$insert into public.wishes (title) values ('Souhait créé par défaut')$$,
  'a member can create a wish using database-derived identity'
);
select throws_ok(
  $$insert into public.reservations (wish_id) select id from test_fixture_ids where label = 'wish_a1'$$,
  '42501', 'Reservation not allowed', 'a member cannot reserve their own wish'
);
with deleted as (
  delete from public.reservations
  where wish_id = (select id from test_fixture_ids where label = 'wish_a3')
  returning 1
)
select is((select count(*)::integer from deleted), 0, 'a member cannot cancel another member reservation');
select is((select count(*)::integer from public.reservations
           where wish_id = (select id from test_fixture_ids where label = 'wish_a1')),
          0, 'a wish owner cannot read the reservation row or reserved_by');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.reservations
           where wish_id = (select id from test_fixture_ids where label = 'wish_a3')),
          0, 'the reservation owner cannot infer reserved status');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select reserved_by::text from public.reservations
           where wish_id = (select id from test_fixture_ids where label = 'wish_a3')),
          '10000000-0000-4000-8000-000000000002',
          'another family member may see the authorized reserver identity');
select throws_ok(
  $$insert into public.reservations (wish_id, reserved_by) select id, '10000000-0000-4000-8000-000000000002' from test_fixture_ids where label = 'wish_a3'$$,
  '42501', null, 'reserved_by cannot be supplied by the client'
);
select throws_ok(
  $$insert into public.reservations (wish_id) select id from test_fixture_ids where label = 'wish_a3'$$,
  '23505', null, 'the unique wish constraint rejects a concurrent duplicate reservation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
with deleted as (
  delete from public.family_members
  where user_id = '20000000-0000-4000-8000-000000000001'
  returning 1
)
select is((select count(*)::integer from deleted), 0,
          'an administrator cannot remove a member of another family');

with changed as (
  update public.families set name = 'Tentative'
  where id = (select id from test_fixture_ids where label = 'family_b')
  returning 1
)
select is((select count(*)::integer from changed), 0,
          'an administrator cannot administer another family');
select throws_ok(
  $$update public.family_members set role = 'admin' where user_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'the browser cannot change membership roles'
);
reset role;

select ok(
  not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservations'
  ),
  'reservation changes are excluded from Realtime to protect surprise status'
);

select * from finish();
rollback;
