-- Self-service account deletion, plus one grant hardening found while writing it.
--
-- NOT YET APPLIED to EmissionsSQL (zzoervdobfuvnldqaicn) — written 2026-10-10
-- when the Supabase connector had no permission on the project. Apply it by
-- pasting this file into the dashboard SQL editor, then run
-- supabase/tests/delete_own_account.sql (everything in it rolls back) before
-- relying on the in-app Danger zone button.
--
-- What it does, for the signed-in caller only (auth.uid()):
--   * any school where they are the ONLY member is deleted with everything in
--     it (contacts, meters, readings, reports, module + factor settings)
--   * a school shared with other members is left alone — only this user's
--     membership and their name on factor choices are removed
--   * their login (auth.users) is deleted last
--
-- Why it deletes in explicit order instead of leaning on ON DELETE CASCADE:
--   * meter_log.meter_id -> meters is ON DELETE RESTRICT (0006). When a school
--     is deleted, meters and meter_log are both cascaded from it, and RESTRICT
--     is checked immediately, not at end of statement — so depending on which
--     cascade trigger fires first, the delete can fail on a perfectly valid
--     school. Deleting meter_log before meters sidesteps the race entirely.
--   * school_factor_choices.chosen_by -> auth.users (0007) has NO cascade, so a
--     user who ever picked an emission-factor source could never be deleted.
--     It is nulled out first.
--   * reports has RLS with no delete policy by design (immutable snapshots);
--     a SECURITY DEFINER function runs as the owner and is not subject to it.

create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_school uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  for v_school in
    select sm.school_id
    from school_members sm
    where sm.user_id = v_uid
      and not exists (
        select 1 from school_members other
        where other.school_id = sm.school_id
          and other.user_id <> v_uid
      )
  loop
    delete from reports               where school_id = v_school;
    delete from meter_log             where school_id = v_school;
    delete from meters                where school_id = v_school;
    delete from school_factor_choices where school_id = v_school;
    delete from school_modules        where school_id = v_school;
    delete from school_contacts       where school_id = v_school;
    delete from school_members        where school_id = v_school;
    delete from schools               where id        = v_school;
  end loop;

  update school_factor_choices set chosen_by = null where chosen_by = v_uid;
  delete from school_members where user_id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, and Supabase's
-- default privileges also hand it to anon — so without this, an
-- unauthenticated caller could invoke it (harmlessly here, since auth.uid()
-- would be null and it raises, but there is no reason to leave it open).
revoke all on function delete_own_account() from public, anon;
grant execute on function delete_own_account() to authenticated;

-- Same trap, already live since 0002: create_my_school() was granted to
-- authenticated but never revoked from PUBLIC/anon. An anon call inserts a
-- school, then fails on the null user_id and rolls back — nothing persists —
-- but it is still an open door that does work before refusing.
revoke execute on function create_my_school(text) from public, anon;
grant execute on function create_my_school(text) to authenticated;
