-- Snapshot the denominators onto each report.
--
-- Every peer comparison in the methodology is an INTENSITY, never an absolute:
-- kWh/m2/yr and kWh/student/yr for energy, L/m2/yr and L/student/day for water.
-- Each divides by a composition/scale figure that currently lives only on
-- `schools` — where it is mutable.
--
-- The failure this prevents: a school corrects its conditioned floor area, or
-- enrolment changes between academic years, and every historical report becomes
-- un-normalizable. The stored result_median is an absolute; without the divisor
-- that was true when it was generated, its intensity can never be recomputed and
-- the report drops out of any peer ranking permanently.
--
-- reports rows are already specified as immutable snapshots, so the denominators
-- belong in the snapshot for the same reason the seed and factor_set_version do:
-- a report should be fully reproducible from its own row.
--
-- Adding these columns before real reports exist costs nothing. Adding them
-- after means backfilling values that were never recorded — which is not
-- possible, only guessable.

alter table reports
  add column denom_gfa_total_m2       numeric(10, 1),
  add column denom_gfa_conditioned_m2 numeric(10, 1),
  add column denom_students_total     integer,
  add column denom_students_boarding  integer,
  add column denom_staff_headcount    integer,
  -- When the snapshot was taken. Normally equal to generated_at; kept separate
  -- so a backfilled or re-run report can be honest about the fact that its
  -- denominators came from a different moment than its result.
  add column denom_captured_at        timestamptz;

comment on column reports.denom_gfa_conditioned_m2 is
  'Conditioned (heated/cooled) floor area at report time. The per-area intensity '
  'formulas divide by CONDITIONED area, not total footprint — using total would '
  'understate intensity for any campus with large uncovered outdoor space.';

comment on column reports.denom_students_boarding is
  'Boarding students at report time. Boarding buildings run 24/7 and day '
  'buildings do not; peer grouping needs the split, not just the total.';
