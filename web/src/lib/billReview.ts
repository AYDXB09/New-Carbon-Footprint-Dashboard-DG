/**
 * The review step for a bill read by AI. Pure: turn what the Edge Function returned into rows the
 * school can edit, and decide whether each row is fit to save. Nothing here saves anything.
 *
 * The AI's output is a draft, never a record: every field is editable, every doubt is shown, and
 * the school confirms the whole set against the original document before it reaches meter_log.
 */

import { overlaps, parseDate, parseQuantity, type KnownMeter, type KnownReading } from "./csv";
import { MODULE_UNITS, defaultUnitId, toCanonical, type QuantityModule } from "./units";

export const BILL_MAX_BYTES = 5_000_000;
export const BILL_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export type Confidence = "high" | "medium" | "low";

export interface ReviewRow {
  key: string;
  /** As read from the bill — editable. */
  meterNumber: string;
  periodStart: string;
  periodEnd: string;
  quantity: string;
  unitId: string;
  /** Registered meter this reading will be saved against, or "" until chosen. */
  meterId: string;
  confidence: Confidence;
  ambiguity: string | null;
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which of the module's units does the text printed on the bill mean? Null when unsure — never a guess. */
export function matchUnitId(module: QuantityModule, text: string): string | null {
  const t = compact(text.replace(/³/g, "3")); // m³ is how most water bills print cubic metres
  const table: Record<QuantityModule, Record<string, string>> = {
    energy: { kwh: "kWh", mwh: "MWh", mj: "MJ", gj: "GJ", therm: "therms", therms: "therms" },
    water: {
      m3: "m3", cubicmetres: "m3", cubicmeters: "m3", cubicmetre: "m3", cubicmeter: "m3",
      kl: "m3", kilolitres: "m3", kiloliters: "m3", kilolitre: "m3", kiloliter: "m3", // 1 kL = 1 m3
      l: "litre", litre: "litre", litres: "litre", liter: "litre", liters: "litre",
      usgal: "US gallons", usgallons: "US gallons", ukgal: "UK gallons", impgal: "UK gallons", ukgallons: "UK gallons",
    },
    waste: { t: "tonne", tonne: "tonne", tonnes: "tonne", kg: "kg" },
    transportation: {
      l: "litre", litre: "litre", litres: "litre", liter: "litre", liters: "litre",
      usgal: "US gallons", usgallons: "US gallons", ukgal: "UK gallons", ukgallons: "UK gallons",
    },
  };
  return table[module][t] ?? null; // a bare "gal" is deliberately NOT mapped: US and UK gallons differ by 20%
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Read the function's response defensively and build editable review rows. */
export function toReviewRows(
  raw: unknown,
  module: QuantityModule,
  meters: readonly KnownMeter[],
  profileUnit?: string | null,
): { rows: ReviewRow[]; notes: string | null } {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.readings) ? rec.readings : [];
  const rows: ReviewRow[] = [];
  list.forEach((item, i) => {
    if (!isRecord(item)) return;
    const number = s(item.meter_number);
    const matched = number ? meters.find((m) => m.meter_number && compact(m.meter_number) === compact(number)) : undefined;
    const meter = matched ?? (meters.length === 1 ? meters[0] : undefined);
    const start = s(item.period_start);
    const end = s(item.period_end);
    const q = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? String(item.quantity) : "";
    const conf = item.confidence === "high" || item.confidence === "medium" ? item.confidence : "low";
    const printedUnit = s(item.unit);
    rows.push({
      key: `r${i}`,
      meterNumber: number,
      // A date the model returned in the wrong shape is blanked for the school to fill in, not "fixed".
      periodStart: parseDate(start, "iso") ?? "",
      periodEnd: parseDate(end, "iso") ?? "",
      quantity: q,
      unitId: matchUnitId(module, printedUnit) ?? "",
      meterId: meter?.id ?? "",
      confidence: conf,
      ambiguity: s(item.ambiguity) || (matchUnitId(module, printedUnit) ? null : printedUnit ? `The bill's unit “${printedUnit}” needs choosing.` : null),
    });
  });
  void profileUnit;
  return { rows, notes: s(rec.notes) || null };
}

/** The first thing wrong with a row, or null if it can be saved. */
export function checkReviewRow(
  row: ReviewRow,
  module: QuantityModule,
  existing: readonly KnownReading[],
  others: readonly ReviewRow[],
): string | null {
  if (!row.meterId) return "Choose which meter this belongs to.";
  if (!row.periodStart || !row.periodEnd) return "Both dates are needed (year-month-day).";
  if (row.periodEnd <= row.periodStart) return "The end date must be after the start date.";
  const q = parseQuantity(row.quantity);
  if (q === null || !(q > 0)) return "Enter the quantity as a number above zero.";
  if (!row.unitId) return "Choose the unit.";
  if (!MODULE_UNITS[module].choices.some((c) => c.id === row.unitId)) return "Choose the unit.";
  if (!(toCanonical(module, row.unitId, q) > 0)) return "That quantity rounds to zero.";
  const here = { s: row.periodStart, e: row.periodEnd };
  const saved = existing.find((r) => r.meter_id === row.meterId && overlaps(here, { s: r.period_start, e: r.period_end }));
  if (saved) return `Overlaps a reading already saved for this meter (${saved.period_start} to ${saved.period_end}).`;
  const clash = others.find(
    (o) => o.key !== row.key && o.meterId === row.meterId && o.periodStart && o.periodEnd && overlaps(here, { s: o.periodStart, e: o.periodEnd }),
  );
  if (clash) return "Overlaps another reading in this bill for the same meter.";
  return null;
}

export function reviewRowToReading(row: ReviewRow, module: QuantityModule) {
  return {
    meterId: row.meterId,
    quantity: toCanonical(module, row.unitId, parseQuantity(row.quantity)!),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
  };
}

/** A single 0-1 figure stored with the readings: the weakest confidence among them. */
export function overallConfidence(rows: readonly ReviewRow[]): number {
  const score = { high: 0.9, medium: 0.6, low: 0.3 } as const;
  return rows.length === 0 ? 0 : Math.min(...rows.map((r) => score[r.confidence]));
}

export { defaultUnitId };
