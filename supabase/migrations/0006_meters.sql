-- Registered meters — implements the meter identity model decided 2026-08-27
-- (CLAUDE.md "Meter identity model"): a school registers each meter ONCE, with
--   Location     (required, free text, doubles as the meter's name)
--   Meter number (optional, from the physical meter or the bill)
-- and every reading attaches to a registered meter rather than carrying its own
-- free-text label.
--
-- Why this replaces meter_log.meter_label: CSV and AI imports are specified to
-- auto-match an incoming reading to the right meter on meter number, and to ask
-- the school to confirm when the number is absent. Neither is possible against a
-- free-text label that can be spelled differently on every row.
--
-- Meter number is deliberately distinct from the account/billing number, which
-- the AI extraction schema never requests and this table never stores.

create table meters (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools (id) on delete cascade,
  module        module_key not null,

  location      text not null,   -- e.g. 'Main Building', 'Main Building — Chiller'
  meter_number  text,            -- from the physical meter / bill; not the account number

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Location doubles as the meter's name, so it must be unambiguous within a
  -- school's module. Not tied to a formal buildings registry — one doesn't
  -- exist elsewhere in the product.
  unique (school_id, module, location)
);

create index meters_school_module_idx on meters (school_id, module);

-- Partial unique index: a meter number, when given, identifies exactly one
-- meter per school — this is what import auto-matching keys off. Nulls are
-- unconstrained, since meter number is optional.
create unique index meters_school_number_idx
  on meters (school_id, meter_number)
  where meter_number is not null;

alter table meters enable row level security;

create policy "members can view their school's meters"
  on meters for select to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can insert their school's meters"
  on meters for insert to authenticated
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can update their school's meters"
  on meters for update to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()))
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can delete their school's meters"
  on meters for delete to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create trigger meters_set_updated_at
  before update on meters
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Point meter_log at the registered meter.
-- ---------------------------------------------------------------------------

alter table meter_log add column meter_id uuid references meters (id) on delete restrict;

-- Backfill: register one meter per distinct label already in the log. A no-op
-- in practice (meter_log is empty at migration time) but kept correct, matching
-- the 0005 precedent. Rows with no label at all get an explicit placeholder
-- rather than being silently left unattached.
insert into meters (school_id, module, location)
select distinct school_id, module, coalesce(nullif(trim(meter_label), ''), 'Unspecified meter')
from meter_log
on conflict (school_id, module, location) do nothing;

update meter_log ml
set meter_id = m.id
from meters m
where m.school_id = ml.school_id
  and m.module    = ml.module
  and m.location  = coalesce(nullif(trim(ml.meter_label), ''), 'Unspecified meter');

-- Every reading must now attach to a registered meter — this is the whole point
-- of the model, so it is enforced rather than left as a convention.
alter table meter_log alter column meter_id set not null;
alter table meter_log drop column meter_label;

create index meter_log_meter_idx on meter_log (meter_id, period_end desc);
