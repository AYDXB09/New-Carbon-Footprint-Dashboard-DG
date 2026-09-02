-- Close a gap that outlived its reason: meter_log, reports and school_modules
-- have had RLS enabled with ZERO policies since 0001 ("stubbed on,
-- deny-by-default... inert until auth/roles land"). Auth landed in 0002.
-- Nobody came back to give these three tables real policies, so every one of
-- them has been unconditionally unusable — not just to anon, to the school's
-- own signed-in members too — this whole time. Caught while wiring the first
-- real page against them (the /energy build).
--
-- meter_log and school_modules follow the exact select/insert/update/delete-
-- scoped-to-membership pattern already established for meters (0006),
-- school_contacts (0005) and school_factor_choices (0007).
--
-- reports gets select + insert ONLY, deliberately no update or delete: reports
-- are specified as immutable snapshots ("a new submission creates a new report
-- row, it doesn't overwrite" — 0001's own comment on the table). Omitting
-- those policies enforces that at the database layer, not just as a
-- convention the application code has to remember to honour.

create policy "members can view their school's meter readings"
  on meter_log for select to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can insert their school's meter readings"
  on meter_log for insert to authenticated
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can update their school's meter readings"
  on meter_log for update to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()))
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can delete their school's meter readings"
  on meter_log for delete to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can view their school's reports"
  on reports for select to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can insert their school's reports"
  on reports for insert to authenticated
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can view their school's module settings"
  on school_modules for select to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can insert their school's module settings"
  on school_modules for insert to authenticated
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can update their school's module settings"
  on school_modules for update to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()))
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));
