-- Normalized contacts table, replaces the flat contact_name/contact_email
-- columns on schools. rank 1 = primary, 2 = secondary — scales to a 3rd/4th
-- contact later with zero schema change. See CLAUDE.md "Contact block
-- redesign" (2026-08-26) for the design this implements.
--
-- Applied live 2026-08-26 to EmissionsSQL (zzoervdobfuvnldqaicn). No rows
-- existed with contact_name/contact_email set at migration time, so the
-- backfill insert below was a no-op in practice — kept for correctness.

create table school_contacts (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references schools (id) on delete cascade,
  rank               smallint not null check (rank >= 1),
  name               text,
  title              text,
  email              text,
  email_provenance   field_provenance not null default 'manual',
  phone_country_code text,   -- e.g. '+971'
  phone_number       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (school_id, rank)
);

create index school_contacts_school_id_idx on school_contacts (school_id);

alter table school_contacts enable row level security;

create policy "members can view their school's contacts"
  on school_contacts
  for select
  to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can insert their school's contacts"
  on school_contacts
  for insert
  to authenticated
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can update their school's contacts"
  on school_contacts
  for update
  to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()))
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can delete their school's contacts"
  on school_contacts
  for delete
  to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create trigger school_contacts_set_updated_at
  before update on school_contacts
  for each row execute function set_updated_at();

-- Migrate existing flat contact data into rank-1 rows.
insert into school_contacts (school_id, rank, name, email, email_provenance)
select id, 1, contact_name, contact_email, contact_provenance
from schools
where contact_name is not null or contact_email is not null;

-- Flat columns superseded by school_contacts — drop them.
alter table schools drop column if exists contact_name;
alter table schools drop column if exists contact_email;
alter table schools drop column if exists contact_provenance;
