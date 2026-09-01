-- Structured address components for benchmarking/analysis — address_text
-- alone (a single printed line) can't be grouped or filtered on. city/region
-- are extracted alongside address_text by school-lookup where possible;
-- country_code already existed.
--
-- Applied live 2026-08-26 to EmissionsSQL (zzoervdobfuvnldqaicn).

alter table schools add column if not exists city text;
alter table schools add column if not exists region text; -- state/province/emirate, optional

create index if not exists schools_city_idx on schools (city);
