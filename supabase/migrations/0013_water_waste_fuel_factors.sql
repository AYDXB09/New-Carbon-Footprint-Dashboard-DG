-- Sourced emission factors for Water, Waste and school-vehicle fuel, plus the two small
-- columns the new modules need. Written 2026-10-13.
--
-- EVERY number below was read out of the UK Government's "Greenhouse gas reporting:
-- conversion factors 2026" flat file (workbook version 1.2, sheet "Factors by Category") by its
-- row ID, which is recorded in each row's notes — nothing here is typed from memory. The
-- generating script asserted the unit and gas columns of every row before emitting it.
--
-- WHAT IS NOT HERE, ON PURPOSE
--   * Digital: no number could be traced to its published source, so none is invented.
--   * Commuting by car/bus per passenger-km: DESNZ publishes UK fleet averages; commuting needs a
--     survey design (mode share, occupancy) that does not exist yet.
--   * Any UAE/GCC-specific water or waste factor: none was found that could be read from a primary
--     source. The UK rows below are marked stand_in_ok so a school outside the UK can use them ONLY
--     after being shown the caveat and with a deliberately wide uncertainty (see the app).
--
-- Apply by pasting into the Supabase SQL editor. It only adds two nullable/defaulted columns and
-- inserts rows, so it cannot disturb existing data. Safe to run once; the unique check below
-- stops a second run from inserting duplicates.

-- Which factor prices a meter's readings. Energy meters leave it null (they use the grid factor);
-- a water meter picks supply or wastewater, a waste "meter" is a disposal stream, a vehicle picks
-- its fuel. The value is an emission_factors.factor_key.
alter table meters add column if not exists factor_key text;

-- True for a factor published for one country that may be offered, with a warning, to schools
-- elsewhere when nothing local exists. Never used silently.
alter table emission_factors add column if not exists stand_in_ok boolean not null default false;

insert into emission_factors (
  module, factor_key, used_for, value, unit, uncertainty_pct, scope, country_code,
  source_name, source_org, source_url, vintage_year, last_verified_at, review_due_at,
  notes, stand_in_ok
)
select v.module::module_key, v.factor_key, v.used_for, v.value, v.unit, v.uncertainty_pct,
       v.scope::factor_scope, v.country_code, v.source_name, v.source_org, v.source_url,
       v.vintage_year, v.last_verified_at::date, v.review_due_at::date, v.notes, v.stand_in_ok
from (values
('water', 'supply_intensity',
  'Converts a school''s mains water supplied (m3) into emissions (kgCO2e).',
  0.1913, 'kgCO2e/m3', 25, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Water supply > Water supply > Water supply', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2023, '2026-10-13', '2027-07-01',
  'DESNZ row ID 17_404_4005_1_1. Published for UK water companies: weighted average of 2023 data from the companies'' Carbon Accounting Workbooks (the figures they report to the regulator), unchanged since the 2025 edition. The methodology report says incomplete company reporting ''introduces uncertainty'' in this factor. It describes UK water systems; where water is largely desalinated (e.g. the UAE) real emissions per m3 can be much higher, so outside the UK this row is offered only as a stand-in. Uncertainty (25%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('water', 'treatment_intensity',
  'Converts a school''s wastewater sent for treatment (m3) into emissions (kgCO2e).',
  0.17088, 'kgCO2e/m3', 25, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Water treatment > Water treatment > Water treatment', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2023, '2026-10-13', '2027-07-01',
  'DESNZ row ID 18_405_4006_1_1. Published for UK water companies: weighted average of 2023 data from the companies'' Carbon Accounting Workbooks (the figures they report to the regulator), unchanged since the 2025 edition. The methodology report says incomplete company reporting ''introduces uncertainty'' in this factor. It describes UK water systems; where water is largely desalinated (e.g. the UAE) real emissions per m3 can be much higher, so outside the UK this row is offered only as a stand-in. Uncertainty (25%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_general_landfill',
  'Converts general (mixed) waste sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  520.58023, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Commercial and industrial waste > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5313_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_general_incineration',
  'Converts general (mixed) waste sent to incineration / energy recovery (tonnes) into emissions (kgCO2e) for its disposal route.',
  4.65358, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Commercial and industrial waste > Combustion', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5311_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_food_landfill',
  'Converts food waste sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  700.33263, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Organic: food and drink waste > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5292_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_food_composting',
  'Converts food waste sent to composting (tonnes) into emissions (kgCO2e) for its disposal route.',
  9.00687, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Organic: food and drink waste > Composting', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5291_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_food_anaerobic',
  'Converts food waste sent to anaerobic digestion (tonnes) into emissions (kgCO2e) for its disposal route.',
  9.00687, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Organic: food and drink waste > Anaerobic digestion', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5293_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_garden_landfill',
  'Converts garden waste sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  646.72934, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Organic: garden waste > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5299_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_garden_composting',
  'Converts garden waste sent to composting (tonnes) into emissions (kgCO2e) for its disposal route.',
  9.00687, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Refuse > Organic: garden waste > Composting', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_507_5298_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_paper_landfill',
  'Converts paper and card sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  1164.51317, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Paper > Paper and board: mixed > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_506_5453_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_paper_recycled',
  'Converts paper and card sent for recycling (tonnes) into emissions (kgCO2e) for its disposal route.',
  4.65358, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Paper > Paper and board: mixed > Closed-loop', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_506_5450_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_plastic_landfill',
  'Converts plastics sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  9.00687, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Plastic > Plastics: average plastics > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_505_5383_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_plastic_recycled',
  'Converts plastics sent for recycling (tonnes) into emissions (kgCO2e) for its disposal route.',
  4.65358, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Plastic > Plastics: average plastics > Closed-loop', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_505_5380_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_metal_landfill',
  'Converts metal cans sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  9.00687, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Metal > Metal: mixed cans > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_504_5362_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_metal_recycled',
  'Converts metal cans sent for recycling (tonnes) into emissions (kgCO2e) for its disposal route.',
  4.65358, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Metal > Metal: mixed cans > Closed-loop', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_504_5359_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_glass_landfill',
  'Converts glass sent to landfill (tonnes) into emissions (kgCO2e) for its disposal route.',
  9.00687, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Other > Glass > Landfill', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_501_5271_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('waste', 'waste_glass_recycled',
  'Converts glass sent for recycling (tonnes) into emissions (kgCO2e) for its disposal route.',
  4.65358, 'kgCO2e/tonne', 30, 'country', 'GB',
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 3 > Waste disposal > Other > Glass > Closed-loop', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 20_501_5268_15_1. Scope 3 waste-disposal accounting figure: covers collection and transport to the first point of processing, plus a UK landfill model (MELMod) for landfill. The methodology report states these factors ''exclude the majority of emissions from waste management and cannot be used to compare the impacts of different waste management options''. UK transport distances and landfill gas capture are built in, so outside the UK this row is offered only as a stand-in. Uncertainty (30%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  true),
('transportation', 'diesel_litre',
  'Converts diesel burned by school-owned vehicles (litres) into emissions (kgCO2e).',
  2.66155, 'kgCO2e/litre', 5, 'global', null,
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 1 > Fuels > Liquid fuels > Diesel (100% mineral diesel)', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 1_101_1012_8_1. Combustion of 100% mineral fuel, which is what is sold in most countries. DESNZ also publishes a UK ''average biofuel blend'' row that depends on UK pump blending; it is deliberately not used. Uncertainty (5%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  false),
('transportation', 'petrol_litre',
  'Converts petrol burned by school-owned vehicles (litres) into emissions (kgCO2e).',
  2.35372, 'kgCO2e/litre', 5, 'global', null,
  'Greenhouse gas reporting: conversion factors 2026 (flat file) - Scope 1 > Fuels > Liquid fuels > Petrol (100% mineral petrol)', 'UK Government (DESNZ)', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  2026, '2026-10-13', '2027-07-01',
  'DESNZ row ID 1_101_1018_8_1. Combustion of 100% mineral fuel, which is what is sold in most countries. DESNZ also publishes a UK ''average biofuel blend'' row that depends on UK pump blending; it is deliberately not used. Uncertainty (5%) is an engineering estimate, not a published statistic: the methodology report publishes no numeric uncertainty for this factor.',
  false)
) as v(module, factor_key, used_for, value, unit, uncertainty_pct, scope, country_code,
       source_name, source_org, source_url, vintage_year, last_verified_at, review_due_at,
       notes, stand_in_ok)
where not exists (
  select 1 from emission_factors e
  where e.module = v.module::module_key and e.factor_key = v.factor_key
);
