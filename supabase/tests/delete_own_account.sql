-- Test for delete_own_account() (migration 0012). Paste into the Supabase SQL
-- editor AFTER applying 0012. Runs as the postgres owner and ALWAYS rolls
-- back, so it leaves nothing behind — pass or fail. A failure raises an
-- exception naming the assertion; success prints a NOTICE and then rolls back.
--
-- Status when written (2026-10-10): NOT RUN — no database access from the
-- session that wrote it. Treat 0012 as unverified until this passes.

begin;

do $$
declare
  u1 uuid := gen_random_uuid();   -- owns a solo school and half of a shared one
  u2 uuid := gen_random_uuid();   -- the other member of the shared school
  s_solo   uuid;
  s_shared uuid;
  m_solo   uuid;
  n int;
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-test-1@example.invalid'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-test-2@example.invalid');

  -- act as u1
  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u1, 'role', 'authenticated')::text, true);

  -- solo school with a contact, a meter and a reading (the RESTRICT case)
  select (create_my_school('DELETE TEST solo')).id into s_solo;
  insert into school_contacts (school_id, rank, name) values (s_solo, 1, 'Test Person');
  insert into meters (school_id, module, location) values (s_solo, 'energy', 'Main Building')
    returning id into m_solo;
  insert into meter_log (school_id, module, meter_id, quantity, canonical_unit, period_start, period_end, source)
    values (s_solo, 'energy', m_solo, 1000, 'kWh', '2025-01-01', '2026-01-01', 'manual');

  -- shared school: u1 creates it, u2 is added as a second member
  select (create_my_school('DELETE TEST shared')).id into s_shared;
  insert into school_members (school_id, user_id, role) values (s_shared, u2, 'member');

  -- u1 picked an emission-factor source on the shared school (the no-cascade FK),
  -- if any reference factor exists to point at
  if exists (select 1 from emission_factors) then
    insert into school_factor_choices (school_id, module, factor_key, factor_id, chosen_by)
    select s_shared, 'energy', 'grid_intensity', id, u1 from emission_factors limit 1;
  end if;

  perform delete_own_account();

  -- 1. u1's login is gone
  select count(*) into n from auth.users where id = u1;
  if n <> 0 then raise exception 'FAIL: auth user still exists'; end if;

  -- 2. the solo school and everything in it is gone
  select count(*) into n from schools where id = s_solo;
  if n <> 0 then raise exception 'FAIL: solo school survived'; end if;
  select count(*) into n from meters where school_id = s_solo;
  if n <> 0 then raise exception 'FAIL: solo meters survived'; end if;
  select count(*) into n from meter_log where school_id = s_solo;
  if n <> 0 then raise exception 'FAIL: solo readings survived'; end if;
  select count(*) into n from school_contacts where school_id = s_solo;
  if n <> 0 then raise exception 'FAIL: solo contacts survived'; end if;

  -- 3. the shared school survives, with u2 still a member and u1 gone from it
  select count(*) into n from schools where id = s_shared;
  if n <> 1 then raise exception 'FAIL: shared school was deleted'; end if;
  select count(*) into n from school_members where school_id = s_shared and user_id = u2;
  if n <> 1 then raise exception 'FAIL: other member lost their membership'; end if;
  select count(*) into n from school_members where school_id = s_shared and user_id = u1;
  if n <> 0 then raise exception 'FAIL: deleted user still a member'; end if;

  -- 4. nothing still points at u1 on factor choices
  select count(*) into n from school_factor_choices where chosen_by = u1;
  if n <> 0 then raise exception 'FAIL: chosen_by still references deleted user'; end if;

  -- 5. no session -> refused
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform delete_own_account();
    raise exception 'FAIL: unauthenticated call was allowed';
  exception when sqlstate '28000' then
    null; -- expected
  end;

  raise notice 'PASS: delete_own_account (solo deleted, shared kept, FK traps handled, anon refused)';
end;
$$;

rollback;
