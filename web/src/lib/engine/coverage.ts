/**
 * Period coverage — how much of a reporting span real readings actually cover.
 *
 * This is the third axis alongside breadth (which categories) and depth (Tier
 * 1/2/3): a school can submit high-quality metered data that only covers four
 * months, and that is a different claim from a full year of the same quality.
 *
 * Readings are merged as intervals rather than summed, because summing lengths
 * is wrong in both directions: overlapping periods (a corrected re-issued bill,
 * or two meters covering the same months) would inflate coverage past 100%, and
 * summing hides gaps entirely — eleven months with a missing March looks
 * identical to eleven consecutive months. The gap list is returned so the meter
 * log can show a school exactly which months are missing.
 */

export type CoverageClass = "spot_check" | "partial_year" | "full_year";

export interface DateRange {
  /** ISO date, inclusive. */
  start: string;
  /** ISO date, inclusive. */
  end: string;
}

const MS_PER_DAY = 86_400_000;

function toUtcDay(iso: string): number {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`Invalid date: ${iso}`);
  return t / MS_PER_DAY;
}

function fromUtcDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export interface Coverage {
  /** Distinct days covered by at least one reading. */
  coveredDays: number;
  /** Whole span from earliest start to latest end. */
  spanDays: number;
  /** Uncovered stretches inside the span. Empty when coverage is contiguous. */
  gaps: DateRange[];
  /** True when any two readings cover the same day — a likely double-count. */
  hasOverlap: boolean;
  coverageClass: CoverageClass;
}

/**
 * Thresholds per the time-dimension design:
 *   < 3 months   spot check   — shown raw, never annualised, excluded from peers
 *   3-11 months  partial year — annualised via a seasonal shape factor, "modeled"
 *   >= 12 months full year    — used as-is
 *
 * 90 and 365 days stand in for "3 months" and "12 months". A full calendar or
 * academic year lands on exactly 365 inclusive days (366 in a leap year), so no
 * tolerance is needed for the ordinary cases.
 */
export const SPOT_CHECK_MAX_DAYS = 90;
export const FULL_YEAR_MIN_DAYS = 365;

export function classifyCoverage(coveredDays: number): CoverageClass {
  if (coveredDays < SPOT_CHECK_MAX_DAYS) return "spot_check";
  if (coveredDays < FULL_YEAR_MIN_DAYS) return "partial_year";
  return "full_year";
}

/** Merge reading periods and describe what they actually cover. */
export function analyseCoverage(periods: readonly DateRange[]): Coverage {
  if (periods.length === 0) {
    return {
      coveredDays: 0,
      spanDays: 0,
      gaps: [],
      hasOverlap: false,
      coverageClass: "spot_check",
    };
  }

  const intervals = periods
    .map((p) => {
      const start = toUtcDay(p.start);
      const end = toUtcDay(p.end);
      if (end < start) {
        throw new Error(`Period ends before it starts: ${p.start} to ${p.end}`);
      }
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  let hasOverlap = false;

  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      hasOverlap = true; // shares at least one day with the previous interval
      last.end = Math.max(last.end, iv.end);
    } else if (last && iv.start === last.end + 1) {
      last.end = Math.max(last.end, iv.end); // contiguous, not overlapping
    } else {
      merged.push({ ...iv });
    }
  }

  // +1 throughout because both endpoints are inclusive: a period of
  // 2025-01-01 to 2025-01-31 covers 31 days, not 30.
  const coveredDays = merged.reduce((acc, iv) => acc + (iv.end - iv.start + 1), 0);
  const spanDays = merged[merged.length - 1].end - merged[0].start + 1;

  const gaps: DateRange[] = [];
  for (let i = 1; i < merged.length; i++) {
    gaps.push({
      start: fromUtcDay(merged[i - 1].end + 1),
      end: fromUtcDay(merged[i].start - 1),
    });
  }

  return {
    coveredDays,
    spanDays,
    gaps,
    hasOverlap,
    coverageClass: classifyCoverage(coveredDays),
  };
}
