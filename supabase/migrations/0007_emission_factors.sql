-- Emission-factor library — gives reports.factor_set_version something real to
-- point at, and backs the sourced-derivation table designed 2026-08-27
-- (CLAUDE.md "Energy module — whole-flow design pass", Screen 06).
--
-- Three things the derivation table needs that a hardcoded constant cannot give:
--   1. Provenance — source, publisher, vintage, URL — so a factor can be cited.
--      This is the direct answer to the consultant's critique that emission
--      factors go stale and calculators hide it.
--   2. A verification cadence — last_verified_at / review_due_at drive the
--      "overdue for review" flag, using the same visual language as the
--      meter-log coverage warning.
--   3. Named alternatives — several rows may exist for one factor_key, so the
--      "change source" picker offers real choices rather than an empty control
--      implying choice exists.
--
-- Uncertainty lives here too, not in the engine: the Monte Carlo band is a
-- property of how well a factor is known, and belongs with the factor.
--
-- This is REFERENCE DATA, not tenant data — global to the platform, readable by
-- every authenticated user, writable only by the service role (no insert/update
-- policies for `authenticated` are defined, so RLS denies those by default).

create type factor_scope as enum (
  'global',    -- worldwide fallback
  'region',    -- multi-country region, e.g. 'EU', 'GCC'
  'country',   -- ISO 3166-1 alpha-2 match
  'grid'       -- sub-national grid / utility territory, e.g. a single utility's published mix
);

create table emission_factors (
  id              uuid primary key default gen_random_uuid(),
  module          module_key not null,

  -- What this factor IS, e.g. 'grid_intensity', 'thermal_benchmark'.
  factor_key      text not null,
  -- What this factor is FOR, in the school's language. Surfaced as the
  -- derivation table's "Used for" column so a conversion factor applied to
  -- every reading doesn't read as an alternative to a gap-filling benchmark.
  used_for        text not null,

  value           numeric(14, 6) not null,
  unit            text not null,          -- e.g. 'kgCO2e/kWh', 'kWh/m2/yr'

  -- Monte Carlo input uncertainty. Wider band = wider output band, which is how
  -- the tier system produces its confidence range with no separate scoring
  -- logic (CLAUDE.md "Why Monte Carlo").
  uncertainty_pct numeric(5, 2),          -- 1-sigma, as a percentage of value

  -- Applicability, for the region-match-then-recency default rule below.
  scope           factor_scope not null,
  country_code    text,                   -- required when scope = 'country'
  region_label    text,                   -- e.g. 'GCC', or a utility name for scope='grid'
  -- Which countries a region-scoped factor actually applies to. Added in 0009
  -- after testing showed region rows were otherwise eligible for every country.
  region_countries text[],
  climate_zone    climate_zone,           -- set only where a factor is climate-specific

  -- Provenance — every column here exists to be rendered in the derivation table.
  source_name     text not null,          -- the specific dataset/publication
  source_org      text not null,          -- the publisher
  source_url      text,
  vintage_year    integer not null,       -- the year the DATA describes, not the year
                                          -- the page was last touched. A source can be
                                          -- "current edition" and still have 2008 content.
  last_verified_at date,
  review_due_at    date,                  -- past due => "overdue for review" flag

  notes            text,
  superseded_by    uuid references emission_factors (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint country_code_required_for_country_scope
    check (scope <> 'country' or country_code is not null)
);

create index emission_factors_lookup_idx
  on emission_factors (module, factor_key, scope, country_code);

alter table emission_factors enable row level security;

create policy "any signed-in user can read the factor library"
  on emission_factors for select to authenticated using (true);

create trigger emission_factors_set_updated_at
  before update on emission_factors
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Default-selection rule, as an algorithm rather than a manual judgment call.
--
-- Decided 2026-08-27: REGIONAL MATCH FIRST, most-recent VINTAGE as the fallback
-- when no regional source exists — explicitly not "whichever source happened to
-- get cited first in early research".
--
-- Ordering: grid > country > region > global, then newest vintage within a tier.
-- Superseded factors are never selected.
-- ---------------------------------------------------------------------------

create or replace function default_emission_factor(
  p_module       module_key,
  p_factor_key   text,
  p_country_code text default null
)
returns emission_factors
language sql
stable
as $$
  select f.*
  from emission_factors f
  where f.module = p_module
    and f.factor_key = p_factor_key
    and f.superseded_by is null
    and (
      f.scope in ('global', 'region')
      or (f.scope in ('country', 'grid') and f.country_code = p_country_code)
    )
  order by
    case f.scope
      when 'grid'    then 1
      when 'country' then 2
      when 'region'  then 3
      when 'global'  then 4
    end,
    f.vintage_year desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Per-school source override — backs the "change source" picker. A school that
-- has not chosen keeps whatever default_emission_factor() returns; once chosen,
-- the choice is explicit and recorded.
--
-- Open question this table does NOT answer (CLAUDE.md "Not yet built"): what
-- happens to an ALREADY-SAVED report when a school later switches source.
-- Existing reports pin their inputs via reports.derivation, so they do not
-- silently change — but whether to offer a re-run is still undecided.
-- ---------------------------------------------------------------------------

create table school_factor_choices (
  school_id   uuid not null references schools (id) on delete cascade,
  module      module_key not null,
  factor_key  text not null,
  factor_id   uuid not null references emission_factors (id),
  chosen_at   timestamptz not null default now(),
  chosen_by   uuid references auth.users (id),
  primary key (school_id, module, factor_key)
);

alter table school_factor_choices enable row level security;

create policy "members can view their school's factor choices"
  on school_factor_choices for select to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can insert their school's factor choices"
  on school_factor_choices for insert to authenticated
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can update their school's factor choices"
  on school_factor_choices for update to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()))
  with check (school_id in (select school_id from school_members where user_id = auth.uid()));

create policy "members can delete their school's factor choices"
  on school_factor_choices for delete to authenticated
  using (school_id in (select school_id from school_members where user_id = auth.uid()));

-- NOTE: this table is intentionally created EMPTY.
--
-- Seeding it means committing to specific numbers, publishers and vintages, and
-- the entire value of this table is that those are verifiable. Inventing
-- plausible-looking factors to make the schema "look done" would put unsourced
-- numbers behind a UI whose selling point is its citation trail — the exact
-- failure the consultant described. Factors get inserted when the engine lands,
-- each one read off its actual published source.
