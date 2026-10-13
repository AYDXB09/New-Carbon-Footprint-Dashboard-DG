/**
 * Guided CSV import for meter readings. Everything here is pure: parsing, column
 * mapping, date handling, and turning rows into an import PLAN that the page shows
 * the school before anything is saved. Nothing is written without that preview, and
 * nothing is guessed silently: a row that cannot be placed is reported, not dropped
 * or force-fitted.
 */

import { toCanonical, type QuantityModule } from "./units";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 1_000_000;

/**
 * RFC 4180-style parser: quoted fields, "" escapes, newlines inside quotes, CRLF,
 * a UTF-8 BOM, and comma / semicolon / tab delimiters (Excel in much of the world
 * saves CSV with semicolons). Blank lines and lines starting with # are skipped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let lineIsComment = false;
  let atLineStart = true;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    const blank = row.every((c) => c.trim() === "");
    if (!blank && !lineIsComment) rows.push(row);
    row = [];
    lineIsComment = false;
    atLineStart = true;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (atLineStart && ch === "#") lineIsComment = true;
    atLineStart = false;
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) endField();
    else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
    } else if (ch === "\n") endRow();
    else field += ch;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

function detectDelimiter(src: string): string {
  // Look at the first non-comment line only, outside quotes.
  const line =
    src
      .split(/\r?\n/)
      .find((l) => l.trim() !== "" && !l.trimStart().startsWith("#")) ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"]) {
    let n = 0;
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (!q && ch === d) n++;
    }
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export type Field = "meter_location" | "meter_number" | "period_start" | "period_end" | "quantity";

export const FIELDS: readonly { key: Field; label: string; required: boolean }[] = [
  { key: "period_start", label: "Period start", required: true },
  { key: "period_end", label: "Period end", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "meter_location", label: "Meter location", required: false },
  { key: "meter_number", label: "Meter number", required: false },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const BASE_ALIASES: Record<Field, string[]> = {
  meter_location: ["meterlocation", "location", "site", "building", "premises", "area", "metername", "name", "siteaddress"],
  meter_number: ["meternumber", "meterno", "meterid", "meterref", "meterreference", "meter", "serial", "serialnumber", "mprn", "mpan"],
  period_start: ["periodstart", "start", "startdate", "from", "fromdate", "billstart", "readingstart", "periodfrom", "billingstart"],
  period_end: ["periodend", "end", "enddate", "to", "todate", "billend", "readingend", "periodto", "billdate", "billingend"],
  quantity: ["quantity", "consumption", "usage", "use", "used", "units", "volume"],
};

/** Extra quantity header names per module (the unit often is the header). */
const QUANTITY_ALIASES: Record<QuantityModule, string[]> = {
  energy: ["kwh", "consumptionkwh", "kwhused", "mwh", "energy", "electricity"],
  water: ["m3", "cubicmetres", "cubicmeters", "consumptionm3", "litres", "liters", "water", "gallons"],
  waste: ["tonnes", "tons", "weight", "kg", "weighttonnes", "wasteweight"],
  transportation: ["litres", "liters", "fuel", "fuellitres", "gallons"],
};

/** Best guess at which column holds each field. A column is used at most once. */
export function suggestMapping(
  headers: readonly string[],
  module: QuantityModule,
): Record<Field, number | null> {
  const normalised = headers.map(norm);
  const used = new Set<number>();
  const out: Record<Field, number | null> = {
    meter_location: null,
    meter_number: null,
    period_start: null,
    period_end: null,
    quantity: null,
  };
  // Most specific fields first, so "meter" is not taken as a location.
  const order: Field[] = ["period_start", "period_end", "quantity", "meter_number", "meter_location"];
  for (const field of order) {
    const aliases = field === "quantity" ? [...BASE_ALIASES.quantity, ...QUANTITY_ALIASES[module]] : BASE_ALIASES[field];
    // Exact alias match wins over a looser one, in alias priority order.
    for (const alias of aliases) {
      const idx = normalised.findIndex((h, i) => h === alias && !used.has(i));
      if (idx >= 0) {
        out[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dates and numbers
// ---------------------------------------------------------------------------

export type DateFormat = "iso" | "dmy" | "mdy";

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  iso: "2025-09-30 (year-month-day)",
  dmy: "30/09/2025 (day/month/year)",
  mdy: "09/30/2025 (month/day/year)",
};

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Parse in an explicit format. Returns an ISO date, or null if it is not a real date. */
export function parseDate(value: string, format: DateFormat): string | null {
  const v = value.trim();
  if (format === "iso") {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? `${pad(y, 4)}-${pad(mo)}-${pad(d)}` : null;
  }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = Number(m[3]);
  const [d, mo] = format === "dmy" ? [a, b] : [b, a];
  return isRealDate(y, mo, d) ? `${pad(y, 4)}-${pad(mo)}-${pad(d)}` : null;
}

/**
 * Work out which date format a column uses. ISO is unambiguous. Slash dates are
 * only decided when the data settles it (some value has a first part above 12 =>
 * day first; a second part above 12 => month first). Otherwise `ambiguous` is
 * true and the school must choose — guessing 03/04/2025 would silently swap March
 * and April.
 */
export function detectDateFormat(values: readonly string[]): { format: DateFormat | null; ambiguous: boolean } {
  const vs = values.map((v) => v.trim()).filter((v) => v !== "");
  if (vs.length === 0) return { format: null, ambiguous: false };
  if (vs.every((v) => parseDate(v, "iso") !== null)) return { format: "iso", ambiguous: false };
  const slash = vs.map((v) => /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v));
  if (slash.some((m) => m === null)) return { format: null, ambiguous: false };
  const dayFirst = slash.some((m) => Number(m![1]) > 12);
  const monthFirst = slash.some((m) => Number(m![2]) > 12);
  if (dayFirst && monthFirst) return { format: null, ambiguous: false }; // contradictory
  if (dayFirst) return { format: "dmy", ambiguous: false };
  if (monthFirst) return { format: "mdy", ambiguous: false };
  return { format: null, ambiguous: true };
}

/**
 * "1109200", "1,109,200", "1 109 200", "1,109,200.5", "1.109.200,5", "12,5".
 * A lone comma is a decimal mark only when it is followed by 1-2 digits;
 * groups of exactly three digits are thousands. Returns null for anything else.
 */
export function parseQuantity(value: string): number | null {
  let v = value.trim().replace(/[\s_']/g, "");
  if (v === "" || !/^[-+]?[\d.,]+$/.test(v)) return null;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever comes last is the decimal mark; the other is a thousands separator.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    v = v.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const parts = v.split(",");
    const thousandsLike = parts.slice(1).every((p) => p.length === 3) && parts[0].replace(/^[-+]/, "").length <= 3;
    v = thousandsLike || parts.length > 2 ? parts.join("") : v.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = v.split(".");
    if (parts.length > 2) v = parts.join(""); // 1.109.200
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// The import plan
// ---------------------------------------------------------------------------

export interface KnownMeter {
  id: string;
  location: string;
  meter_number: string | null;
}

export interface KnownReading {
  meter_id: string;
  period_start: string;
  period_end: string;
  quantity: number;
}

export type RowStatus = "ok" | "duplicate" | "error";

export interface PlannedRow {
  /** 1-based line in the file as the school sees it (the header is line 1). */
  line: number;
  status: RowStatus;
  message: string | null;
  /** Meter this row lands on: an existing id, or the key of a meter to create. */
  meterId: string | null;
  newMeterKey: string | null;
  meterLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** In the module's canonical unit. */
  quantity: number | null;
}

export interface NewMeter {
  key: string;
  location: string;
  meterNumber: string | null;
}

export interface ImportPlan {
  rows: PlannedRow[];
  newMeters: NewMeter[];
  /** Rows that will be saved. */
  importable: PlannedRow[];
  counts: { ok: number; duplicate: number; error: number };
  /** A file-level problem that stops the whole import, if any. */
  fatal: string | null;
}

export interface PlanOptions {
  module: QuantityModule;
  /** Row 0 is the header. */
  table: readonly (readonly string[])[];
  mapping: Record<Field, number | null>;
  dateFormat: DateFormat;
  unitId: string;
  meters: readonly KnownMeter[];
  existing: readonly KnownReading[];
  /** Where rows with no meter columns (or blank ones) go. */
  defaultMeterId?: string | null;
}

const key = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function emptyPlan(fatal: string): ImportPlan {
  return { rows: [], newMeters: [], importable: [], counts: { ok: 0, duplicate: 0, error: 0 }, fatal };
}

/** Do two inclusive date ranges share a day? ISO strings compare correctly as text. */
export function overlaps(a: { s: string; e: string }, b: { s: string; e: string }): boolean {
  return a.s <= b.e && b.s <= a.e;
}

export function buildImportPlan(opts: PlanOptions): ImportPlan {
  const { table, mapping } = opts;
  if (table.length < 2) return emptyPlan("The file has no data rows below the header.");
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return emptyPlan(`The file has ${table.length - 1} rows; the limit is ${MAX_IMPORT_ROWS}. Split it and import in parts.`);
  }
  for (const f of FIELDS) {
    if (f.required && mapping[f.key] === null) return emptyPlan(`Choose which column holds "${f.label}".`);
  }

  const cell = (row: readonly string[], field: Field): string => {
    const idx = mapping[field];
    return idx === null ? "" : (row[idx] ?? "").trim();
  };

  const meterById = new Map(opts.meters.map((m) => [m.id, m]));
  const byNumber = new Map<string, KnownMeter>();
  const byLocation = new Map<string, KnownMeter>();
  for (const m of opts.meters) {
    if (m.meter_number) byNumber.set(key(m.meter_number), m);
    byLocation.set(key(m.location), m);
  }

  // Readings already placed per meter (existing, then earlier rows of this file),
  // so an overlap is caught whether it is with saved data or within the file.
  const placed = new Map<string, { s: string; e: string; q: number; line: number | null }[]>();
  for (const r of opts.existing) {
    const list = placed.get(r.meter_id) ?? [];
    list.push({ s: r.period_start, e: r.period_end, q: r.quantity, line: null });
    placed.set(r.meter_id, list);
  }

  const newMeterMap = new Map<string, NewMeter>();
  const rows: PlannedRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    const line = i + 1;
    const out: PlannedRow = {
      line,
      status: "ok",
      message: null,
      meterId: null,
      newMeterKey: null,
      meterLabel: "",
      periodStart: null,
      periodEnd: null,
      quantity: null,
    };
    const fail = (msg: string) => {
      out.status = "error";
      out.message = msg;
      rows.push(out);
    };

    // ---- meter ----
    const location = cell(row, "meter_location");
    const number = cell(row, "meter_number");
    let meter: KnownMeter | undefined;
    if (number) {
      meter = byNumber.get(key(number));
      if (!meter && location) {
        const byLoc = byLocation.get(key(location));
        if (byLoc && byLoc.meter_number && key(byLoc.meter_number) !== key(number)) {
          fail(`Meter number ${number} does not match ${byLoc.meter_number}, which is on file for "${byLoc.location}".`);
          continue;
        }
        meter = byLoc;
      }
    } else if (location) {
      meter = byLocation.get(key(location));
    } else if (opts.defaultMeterId) {
      meter = meterById.get(opts.defaultMeterId);
    } else {
      fail("No meter location or number on this row. Pick a meter for rows like this, or fill the column in.");
      continue;
    }

    if (meter) {
      out.meterId = meter.id;
      out.meterLabel = meter.location;
    } else {
      if (!location) {
        fail(`Meter number ${number} is not registered and the row has no location to create it with.`);
        continue;
      }
      const k = number ? `n:${key(number)}` : `l:${key(location)}`;
      if (!newMeterMap.has(k)) newMeterMap.set(k, { key: k, location, meterNumber: number || null });
      out.newMeterKey = k;
      out.meterLabel = location;
    }

    // ---- dates ----
    const start = parseDate(cell(row, "period_start"), opts.dateFormat);
    const end = parseDate(cell(row, "period_end"), opts.dateFormat);
    if (!start) {
      fail(`Start date "${cell(row, "period_start")}" is not a valid ${opts.dateFormat === "iso" ? "year-month-day" : opts.dateFormat === "dmy" ? "day/month/year" : "month/day/year"} date.`);
      continue;
    }
    if (!end) {
      fail(`End date "${cell(row, "period_end")}" is not a valid ${opts.dateFormat === "iso" ? "year-month-day" : opts.dateFormat === "dmy" ? "day/month/year" : "month/day/year"} date.`);
      continue;
    }
    if (end <= start) {
      fail("The end date must be after the start date.");
      continue;
    }
    out.periodStart = start;
    out.periodEnd = end;

    // ---- quantity ----
    const rawQty = parseQuantity(cell(row, "quantity"));
    if (rawQty === null) {
      fail(`Quantity "${cell(row, "quantity")}" is not a number.`);
      continue;
    }
    if (!(rawQty > 0)) {
      fail("Quantity must be greater than zero.");
      continue;
    }
    const qty = toCanonical(opts.module, opts.unitId, rawQty);
    if (qty > 99_999_999_999) {
      fail("Quantity is too large to store.");
      continue;
    }
    if (!(qty > 0)) {
      fail("Quantity rounds to zero in the stored unit.");
      continue;
    }
    out.quantity = qty;

    // ---- duplicates and overlaps, against saved data and earlier rows ----
    const placeKey = out.meterId ?? out.newMeterKey!;
    const existingForMeter = placed.get(placeKey) ?? [];
    const here = { s: start, e: end };
    const same = existingForMeter.find((p) => p.s === start && p.e === end && p.q === qty);
    if (same) {
      out.status = "duplicate";
      out.message = same.line === null ? "Already saved for this meter." : `Same as line ${same.line}.`;
      rows.push(out);
      continue;
    }
    const clash = existingForMeter.find((p) => overlaps(here, p));
    if (clash) {
      fail(
        clash.line === null
          ? `Overlaps a reading already saved for this meter (${clash.s} to ${clash.e}). Importing it would double-count those days.`
          : `Overlaps line ${clash.line} (${clash.s} to ${clash.e}) for the same meter.`,
      );
      continue;
    }
    existingForMeter.push({ s: start, e: end, q: qty, line });
    placed.set(placeKey, existingForMeter);
    rows.push(out);
  }

  const importable = rows.filter((r) => r.status === "ok");
  // Only create meters that at least one importable row will use.
  const usedKeys = new Set(importable.map((r) => r.newMeterKey).filter((k): k is string => k !== null));
  const newMeters = [...newMeterMap.values()].filter((m) => usedKeys.has(m.key));
  const counts = {
    ok: importable.length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  return { rows, newMeters, importable, counts, fatal: null };
}

/** True when some row has neither a location nor a number to place it by. */
export function needsDefaultMeter(
  table: readonly (readonly string[])[],
  mapping: Record<Field, number | null>,
): boolean {
  for (let i = 1; i < table.length; i++) {
    const loc = mapping.meter_location === null ? "" : (table[i][mapping.meter_location] ?? "").trim();
    const num = mapping.meter_number === null ? "" : (table[i][mapping.meter_number] ?? "").trim();
    if (!loc && !num) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const TEMPLATE_QUANTITY: Record<QuantityModule, { header: string; examples: [string, string] }> = {
  energy: { header: "consumption_kwh", examples: ["412300", "389950"] },
  water: { header: "consumption_m3", examples: ["3120", "2985"] },
  waste: { header: "weight_tonnes", examples: ["4.2", "3.9"] },
  transportation: { header: "fuel_litres", examples: ["1850", "1720"] },
};

/** A downloadable starting file. Lines beginning with # are ignored on import. */
export function templateCsv(module: QuantityModule): string {
  const q = TEMPLATE_QUANTITY[module];
  return [
    "# CarbonTally import template. Lines starting with # are ignored - delete the example rows below.",
    "# Dates are year-month-day. period_end must be after period_start. Quantity is in the unit named in the last header.",
    `meter_location,meter_number,period_start,period_end,${q.header}`,
    `Main Building,EX-1001,2025-09-01,2025-09-30,${q.examples[0]}`,
    `Main Building,EX-1001,2025-10-01,2025-10-31,${q.examples[1]}`,
    "",
  ].join("\n");
}
