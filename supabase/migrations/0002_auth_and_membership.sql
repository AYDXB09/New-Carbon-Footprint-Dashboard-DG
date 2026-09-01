-- Real auth: schools are scoped to the users who belong to them via
-- school_members, rather than "whichever row exists first". Replaces the
-- GROUNDWORK_NO_AUTH_SHIM originally noted in web/src/lib/school.ts.
--
-- Applied live 2026-08-25 to EmissionsSQL (zzoervdobfuvnldqaicn).

create table school_members (
  school_id   uuid not null references schools (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'owner',
  created_at  timestamptz not null default now(),
  primary key (school_id, user_id)
);

alter table school_members enable row level security;

create policy "users can view their own memberships"
  on school_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- Schools: visible/editable only to members. No insert policy — creation
-- only happens through create_my_school() below, which runs as the table
-- owner (security definer) so it can insert both the school row and the
-- matching membership row atomically.
create policy "members can view their school"
  on schools
  for select
  to authenticated
  using (id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can update their school"
  on schools
  for update
  to authenticated
  using (id in (select school_id from school_members where user_id = auth.uid()))
  with check (id in (select school_id from school_members where user_id = auth.uid()));

create or replace function create_my_school(p_name text)
returns schools
language plpgsql
security definer
set search_path = public
as $$
declare
  new_school schools;
begin
  insert into schools (name) values (p_name) returning * into new_school;
  insert into school_members (school_id, user_id, role) values (new_school.id, auth.uid(), 'owner');
  return new_school;
end;
$$;

grant execute on function create_my_school(text) to authenticated;
