-- Groundwork — initial schema
-- Multi-tenant, breadth x depth (Tier 1/2/3), coverage-tiered carbon accounting.
-- Grounded in New-Carbon-Footprint-Dashboard-DG/CLAUDE.md — see that file for the
-- methodology this schema encodes. This is a starting point, not a finished design:
-- auth/roles, benchmarking cache, and modules beyond Energy are intentionally thin.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

create type school_type as enum (
  'independent_day',
  'boarding',
  'mixed_day_boarding',
  'public_district'
);

create type climate_zone as enum (
  'cold',
  'temperate',
  'warm',
  'hot'
);

-- Breadth: which categories a school can opt into. Add to this list as new
-- modules are designed (Water, Waste/Food already planned; see CLAUDE.md).
create type module_key as enum (
  'energy',
  'water',
  'transportation',
  'digital',
  'waste'
);

-- Depth: per-category data-quality tier. Confidence band width in the Monte
-- Carlo engine is driven directly by this, not a separate confidence score.
create type data_tier as enum (
  'tier_1_estimate',
  'tier_2_actual',
  'tier_3_granular'
);

-- Coverage: how much of a reporting period real data covers, layered on top
-- of data_tier (CLAUDE.md "Time dimension" section). Independent of quality.
create type coverage_class as enum (
  'spot_check',    -- < 3 months: shown raw, not annualized, excluded from peer percentiles
  'partial_year',  -- 3-11 months: annualized via seasonal shape factor, tagged "modeled"
  'full_year'      -- >= 12 consecutive months: used as-is, full confidence
);

create type entry_source as enum (
  'ai_bill_upload',
  'csv_import',
  'manual'
);

create type field_provenance as enum (
  'manual',              -- school typed it in directly
  'detected_unconfirmed', -- pulled from website lookup / geocoding, not yet confirmed
  'detected_confirmed'    -- pulled automatically, school has explicitly confirmed it
);

-- ---------------------------------------------------------------------------
-- SCHOOLS — one row per tenant. Profile fields per CLAUDE.md "School profile /
-- settings page" + "Composition & scale fields" sections.
-- ---------------------------------------------------------------------------

create table schools (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Identity
  name                  text not null,
  website_url           text,
  school_type           school_type,
  contact_email         text,
  contact_provenance    field_provenance not null default 'manual',

  -- Location — geocoded pin is the canonical source of truth for climate zone,
  -- grid region, and transportation postcode-distance banding; the address
  -- string is a display convenience, not what downstream lookups should key off.
  address_text          text,
  address_provenance    field_provenance not null default 'manual',
  latitude              numeric(9, 6),
  longitude             numeric(9, 6),
  location_provenance   field_provenance not null default 'manual',
  climate_zone          climate_zone,
  climate_zone_provenance field_provenance not null default 'manual',
  country_code          text,  -- ISO 3166-1 alpha-2, seeds unit + grid-region defaults

  -- Composition & scale — the denominators every module's per-area / per-capita
  -- formula divides by (CLAUDE.md, "Composition & scale fields — gap caught 2026-08-25").
  students_total        integer,
  students_boarding      integer default 0,
  staff_headcount        integer,
  grade_range_low        text,  -- e.g. 'KG1', 'Grade 1'
  grade_range_high       text,  -- e.g. 'Grade 12'
  gfa_total_m2           numeric(10, 1),
  gfa_conditioned_m2     numeric(10, 1),

  -- Unit preferences — display/entry units only; every module stores in the
  -- canonical set (kWh, litres, km, m2) regardless of what's set here.
  unit_energy            text not null default 'kWh',
  unit_water              text not null default 'litre',
  unit_distance           text not null default 'km',
  unit_area                text not null default 'm2',

  constraint students_boarding_le_total
    check (students_boarding is null or students_total is null or students_boarding <= students_total)
);

create index schools_climate_zone_idx on schools (climate_zone);
create index schools_country_code_idx on schools (country_code);

-- ---------------------------------------------------------------------------
-- SCHOOL_MODULES — breadth: which categories a school has opted into, and at
-- what tier each currently reports (surfaced as the dashboard's per-module
-- tier badge). One row per (school, module).
-- ---------------------------------------------------------------------------

create table school_modules (
  school_id     uuid not null references schools (id) on delete cascade,
  module        module_key not null,
  enabled       boolean not null default true,
  current_tier  data_tier,
  enabled_at    timestamptz not null default now(),
  primary key (school_id, module)
);

-- ---------------------------------------------------------------------------
-- METER_LOG — canonical entry table for all metered/billed activity data
-- across modules (CLAUDE.md "Energy module — data entry design": one meter
-- log table with mandatory period start/end regardless of entry method).
-- Generalized beyond Energy so Water can reuse it without a new table.
-- ---------------------------------------------------------------------------

create table meter_log (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references schools (id) on delete cascade,
  module            module_key not null,
  created_at        timestamptz not null default now(),

  -- What was read/billed, in canonical units (kWh for energy, litres for water).
  meter_label       text,               -- school-facing name, e.g. "Main building electric"
  quantity          numeric(14, 3) not null,
  canonical_unit    text not null,      -- 'kWh' | 'litre' | ... — denormalized for clarity/audit

  -- Time dimension — never a "year" label, always an explicit span.
  period_start      date not null,
  period_end        date not null,

  source            entry_source not null,
  source_confidence numeric(4, 3),      -- for ai_bill_upload: extraction confidence, 0-1
  reviewed_by       uuid,               -- references a future users table; AI extractions
                                          -- must pass human review before being trusted
                                          -- (CLAUDE.md: "never writes directly to the meter log")
  reviewed_at       timestamptz,

  raw_document_url  text,               -- original bill/photo, shown side-by-side on review

  constraint period_valid check (period_end > period_start),
  constraint ai_needs_review check (
    source <> 'ai_bill_upload' or reviewed_at is not null
  )
);

create index meter_log_school_module_idx on meter_log (school_id, module);
create index meter_log_period_idx on meter_log (period_start, period_end);

-- ---------------------------------------------------------------------------
-- REPORTS — one row per (school, module, reporting period) snapshot: the
-- Monte Carlo result actually shown on the dashboard/export. Immutable once
-- created — a new submission creates a new report row, it doesn't overwrite.
-- ---------------------------------------------------------------------------

create table reports (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references schools (id) on delete cascade,
  module              module_key not null,
  generated_at        timestamptz not null default now(),

  period_start        date not null,
  period_end          date not null,
  coverage            coverage_class not null,
  tier                data_tier not null,

  -- Monte Carlo output, tCO2e. p10/p90 is the headline range shown to users
  -- (CLAUDE.md "Why Monte Carlo"); median is the point estimate for trends.
  result_p10          numeric(12, 3),
  result_median        numeric(12, 3),
  result_p90          numeric(12, 3),
  simulation_seed      bigint,          -- report is reproducible given this seed
  simulation_runs      integer not null default 10000,

  -- Derivation trace + factor versioning, so a report never silently changes
  -- when factor data is updated later (mirrors the client-repo precedent's
  -- FACTOR_SET_VERSION pattern, reimplemented independently — see CLAUDE.md
  -- "Prior-art find" section on why we don't copy that repo's code directly).
  factor_set_version   text not null,
  derivation           jsonb not null default '{}'::jsonb,

  constraint report_period_valid check (period_end > period_start)
);

create index reports_school_module_idx on reports (school_id, module, period_end desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for schools
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_set_updated_at
  before update on schools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — stubbed on, deny-by-default. Real per-school-user
-- policies depend on the auth/roles design, which CLAUDE.md flags as not yet
-- designed ("Next steps": authentication/multi-user-per-school). Enabling RLS
-- now with no policies means the tables are inert until that design lands,
-- rather than silently open.
-- ---------------------------------------------------------------------------

alter table schools enable row level security;
alter table school_modules enable row level security;
alter table meter_log enable row level security;
alter table reports enable row level security;
