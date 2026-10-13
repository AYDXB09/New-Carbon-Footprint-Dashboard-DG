/** Shapes shared by every module's engine. */

/** A factor as stored in the emission_factors table. */
export interface Factor {
  value: number;
  unit: string;
  /** 1-sigma as a percentage of value. Null/0 => treated as known exactly. */
  uncertaintyPct: number | null;
  sourceName: string;
  sourceOrg: string;
  vintageYear: number;
}

export interface DerivationStep {
  label: string;
  detail: string;
  value?: number;
  unit?: string;
  source?: string;
}
