-- First real rows in emission_factors, researched live (2026-09-02) rather
-- than invented — this is the moment the "deliberately seeded with nothing"
-- table (0007) actually gets something in it, because the /energy build now
-- needs a real factor to run the engine against.
--
-- Two rows only. A THIRD, grid-scope (DEWA-specific) row was deliberately
-- attempted and deliberately NOT added — see the note at the bottom. Adding
-- a plausible-looking number there to complete the grid/country/global demo
-- triad would be exactly the failure this table's design exists to prevent.

insert into emission_factors (
  module, factor_key, used_for, value, unit, uncertainty_pct, scope, country_code,
  source_name, source_org, source_url, vintage_year, last_verified_at, review_due_at, notes
) values

-- Country-level, United Arab Emirates. Read directly from the source table
-- (fetched and read this session, not paraphrased): row "United Arab
-- Emirates (AE) ... 358.2" in a document titled "2025 Electricity Emission
-- Factors, Source: IEA (2025)".
(
  'energy', 'grid_intensity',
  'Converts a school''s metered electricity consumption (kWh) into emissions (kgCO2e).',
  0.3582, 'kgCO2e/kWh', 10.0, 'country', 'AE',
  '2025 Electricity Emission Factors', 'IEA',
  'https://library.e.abb.com/public/bb45e69a3f44492da7594ae927bc1b74/9AKK108472A2616_en_A_2025%20Electricity%20Emission%20Factors.pdf',
  2023, '2026-09-02', '2027-09-02',
  'Value read directly from the source table this session. The document states "Source: IEA (2025)" but does '
  || 'not itself state which generation year the 2025 edition''s AE figure describes; 2023 is inferred from IEA''s '
  || 'own documentation of that edition series (the 2024 edition covers "provisional 2023" data for non-OECD '
  || 'countries, which includes the UAE) rather than read verbatim off this specific page — flagged as inferred, '
  || 'not confirmed, and worth checking against IEA''s own emissions-factors product page directly (iea.org '
  || 'blocked automated fetching when tried). Uncertainty (10%) is an engineering estimate of how well a single '
  || 'national average represents one school''s actual draw — not a published statistic from IEA.'
),

-- Global fallback, for any school outside a region with its own factor.
(
  'energy', 'grid_intensity',
  'Converts a school''s metered electricity consumption (kWh) into emissions (kgCO2e).',
  0.473, 'kgCO2e/kWh', 20.0, 'global', null,
  'Global Electricity Review 2025', 'Ember',
  'https://ember-energy.org/latest-insights/global-electricity-review-2025/',
  2024, '2026-09-02', '2027-09-02',
  'Global average carbon intensity of electricity, 2024 (down from 484 gCO2/kWh in 2023 per the same review). '
  || 'Cross-confirmed across two independent secondary summaries of the report with consistent figures and '
  || 'trend context, but the primary report page could not be fetched directly in this session (site blocked '
  || 'automated fetching) — worth a direct read against ember-energy.org before treating this as fully verified. '
  || 'Uncertainty (20%, wider than the country-level row) reflects that a global blend is a much rougher stand-in '
  || 'for any one specific school''s grid than a national figure is — an engineering estimate, not a published '
  || 'statistic from Ember.'
);

-- NOT added: a grid-scope (DEWA-specific) row for Dubai, which is the one that
-- would actually demonstrate "grid beats country" in default_emission_factor().
-- Searched directly for DEWA's own published grid emission factor (DEWA
-- reports one annually in its Sustainability Report, confirmed via multiple
-- secondary sources referencing "DEWA Grid Emission Factor 2023") but could
-- not retrieve an actual numeric value: DEWA's Sustainability Report PDF
-- exceeded fetch size limits, iea.org and ember-energy.org blocked automated
-- fetching, and every secondary source that mentions DEWA's factor existing
-- stops short of quoting the number. Left for whoever has direct access to
-- DEWA's Sustainability Report to add as its own row — until then, an AE
-- school correctly falls through to the IEA country row above, which is
-- exactly default_emission_factor()'s designed behaviour when no closer
-- match exists, not a gap in the function.
