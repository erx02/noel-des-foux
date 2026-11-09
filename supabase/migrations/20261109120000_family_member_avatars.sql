alter table public.family_members
  add column avatar_id text not null default 'santa';

alter table public.family_members
  add constraint family_members_avatar_id_check
  check (avatar_id in (
    'santa',
    'reindeer',
    'snowman',
    'tree',
    'gift',
    'star',
    'elf',
    'cookie'
  ));

grant update (avatar_id) on public.family_members to authenticated;
