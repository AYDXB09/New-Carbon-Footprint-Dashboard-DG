-- Fix a real defect in 0007's default_emission_factor(), caught by testing the
-- selection rule against cases rather than reading it.
--
-- The bug: `region`-scoped factors were eligible for EVERY country. region_label
-- ('GCC', 'EU', ...) was descriptive text with nothing mapping a country into it,
-- so the region branch of the WHERE clause matched unconditionally. A GB school
-- with no country-specific factor was handed a GCC grid factor — silently, with
-- no warning, and looking exactly like a correct regional match.
--
-- Observed before the fix:
--   default_emission_factor('energy', <key>, 'GB')  ->  'Region 2020' (GCC)   WRONG
-- After:
--   default_emission_factor('energy', <key>, 'GB')  ->  'Global 2025'         correct
--
-- This is precisely the mismatched-peer failure the methodology exists to prevent
-- (regional intensities differ by more than an order of magnitude — a cooling-led
-- Gulf grid vs a Nordic one), so it is enforced by a constraint, not a convention:
-- a region-scoped factor cannot be inserted at all without its country list.

alter table emission_factors add column region_countries text[];

alter table emission_factors add constraint region_countries_required_for_region_scope
  check (scope <> 'region' or (region_countries is not null and array_length(region_countries, 1) > 0));

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
      f.scope = 'global'
      or (f.scope = 'region' and p_country_code = any (f.region_countries))
      or (f.scope in ('country', 'grid') and f.country_code = p_country_code)
    )
  order by
    case f.scope
      when 'grid'    then 1   -- utility/sub-national published mix
      when 'country' then 2
      when 'region'  then 3
      when 'global'  then 4
    end,
    f.vintage_year desc       -- recency only breaks ties WITHIN a proximity tier
  limit 1;
$$;

-- Verified live against four cases (2026-09-01):
--   AE, utility row present        -> utility 2019 beats global 2025   (proximity > recency)
--   SA, listed in the GCC row      -> regional 2020                    (region applies)
--   GB, not listed in the GCC row  -> global 2025                      (region does NOT apply)
--   no regional source of any kind -> newest global vintage            (recency fallback)
