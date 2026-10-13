import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_ROWS,
  buildImportPlan,
  detectDateFormat,
  needsDefaultMeter,
  parseCsv,
  parseDate,
  parseQuantity,
  suggestMapping,
  templateCsv,
  type Field,
  type PlanOptions,
} from "./csv";
import { MODULE_UNITS, defaultUnitId, toCanonical } from "./units";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside a field", () => {
    expect(parseCsv('a,b\n"Main, Block","He said ""hi""\nand left"\n')).toEqual([
      ["a", "b"],
      ["Main, Block", 'He said "hi"\nand left'],
    ]);
  });
  it("copes with a BOM, CRLF and a missing final newline", () => {
    expect(parseCsv("﻿a,b\r\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("does not mistake commas inside quotes for the delimiter", () => {
    expect(parseCsv('"a;b,c";d\n1;2')).toEqual([["a;b,c", "d"], ["1", "2"]]);
  });
  it("skips blank lines and # comment lines", () => {
    expect(parseCsv("# note\n\na,b\n\n1,2\n# trailing\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("keeps empty cells in place", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });
});

describe("suggestMapping", () => {
  it("maps the design's own example: Bill Date -> period end", () => {
    const m = suggestMapping(["Bill Date", "Start", "Usage (kWh)", "Meter No", "Site"], "energy");
    expect(m.period_end).toBe(0);
    expect(m.period_start).toBe(1);
    expect(m.meter_number).toBe(3);
    expect(m.meter_location).toBe(4);
  });
  it("maps the template headers exactly", () => {
    const m = suggestMapping(
      ["meter_location", "meter_number", "period_start", "period_end", "consumption_kwh"],
      "energy",
    );
    expect(m).toEqual({ meter_location: 0, meter_number: 1, period_start: 2, period_end: 3, quantity: 4 });
  });
  it("uses a column only once", () => {
    const m = suggestMapping(["Date", "Date"], "energy");
    const used = Object.values(m).filter((v) => v !== null);
    expect(new Set(used).size).toBe(used.length);
  });
  it("leaves a field unmapped rather than guessing", () => {
    expect(suggestMapping(["foo", "bar"], "energy").quantity).toBeNull();
  });
  it("knows each module's quantity header", () => {
    expect(suggestMapping(["from", "to", "m3"], "water").quantity).toBe(2);
    expect(suggestMapping(["from", "to", "weight_tonnes"], "waste").quantity).toBe(2);
  });
});

describe("dates", () => {
  it("parses ISO, DMY and MDY, and rejects impossible dates", () => {
    expect(parseDate("2025-09-30", "iso")).toBe("2025-09-30");
    expect(parseDate("30/09/2025", "dmy")).toBe("2025-09-30");
    expect(parseDate("09/30/2025", "mdy")).toBe("2025-09-30");
    expect(parseDate("31/04/2025", "dmy")).toBeNull();
    expect(parseDate("2025-02-29", "iso")).toBeNull();
    expect(parseDate("2024-02-29", "iso")).toBe("2024-02-29");
    expect(parseDate("nope", "iso")).toBeNull();
  });
  it("detects ISO", () => {
    expect(detectDateFormat(["2025-01-01", "2025-02-01"])).toEqual({ format: "iso", ambiguous: false });
  });
  it("lets the data decide day-first or month-first", () => {
    expect(detectDateFormat(["31/01/2025", "01/02/2025"]).format).toBe("dmy");
    expect(detectDateFormat(["01/31/2025", "02/01/2025"]).format).toBe("mdy");
  });
  it("refuses to guess when 03/04/2025 could be either", () => {
    expect(detectDateFormat(["03/04/2025", "05/06/2025"])).toEqual({ format: null, ambiguous: true });
  });
  it("reports no format for mixed junk", () => {
    expect(detectDateFormat(["2025-01-01", "soon"])).toEqual({ format: null, ambiguous: false });
  });
});

describe("parseQuantity", () => {
  it.each([
    ["1109200", 1109200],
    ["1,109,200", 1109200],
    ["1 109 200", 1109200],
    ["1,109,200.5", 1109200.5],
    ["1.109.200,5", 1109200.5],
    ["12,5", 12.5],
    ["1,234", 1234],
    ["0.25", 0.25],
    ["  42 ", 42],
  ])("reads %s as %s", (input, expected) => expect(parseQuantity(input)).toBe(expected));
  it.each(["", "abc", "12kWh", "1,2,3x", "--5", "£100"])("rejects %j", (input) =>
    expect(parseQuantity(input)).toBeNull(),
  );
});

describe("units", () => {
  it("converts exactly by definition", () => {
    expect(toCanonical("energy", "MWh", 2)).toBe(2000);
    expect(toCanonical("energy", "MJ", 3600)).toBe(1000);
    expect(toCanonical("energy", "GJ", 3.6)).toBe(1000);
    expect(toCanonical("energy", "therms", 1)).toBeCloseTo(29.307, 3);
    expect(toCanonical("water", "litre", 5000)).toBe(5);
    expect(toCanonical("water", "US gallons", 1000)).toBeCloseTo(3.785, 3);
    expect(toCanonical("water", "UK gallons", 1000)).toBeCloseTo(4.546, 3);
    expect(toCanonical("waste", "kg", 4200)).toBe(4.2);
    expect(toCanonical("transportation", "US gallons", 10)).toBeCloseTo(37.854, 3);
  });
  it("throws on an unknown unit rather than treating it as 1", () => {
    expect(() => toCanonical("energy", "BTU", 1)).toThrow(/Unknown unit/);
  });
  it("defaults to the profile's unit when this module can convert it", () => {
    expect(defaultUnitId("energy", "therms")).toBe("therms");
    expect(defaultUnitId("water", "litre")).toBe("litre");
    expect(defaultUnitId("energy", "furlongs")).toBe("kWh");
    expect(defaultUnitId("waste", undefined)).toBe("tonne");
    expect(MODULE_UNITS.water.canonical).toBe("m3");
  });
});

// ---------------------------------------------------------------------------
describe("buildImportPlan", () => {
  const HEAD = ["meter_location", "meter_number", "period_start", "period_end", "kwh"];
  const mapping: Record<Field, number | null> = {
    meter_location: 0,
    meter_number: 1,
    period_start: 2,
    period_end: 3,
    quantity: 4,
  };
  const opts = (rows: string[][], over: Partial<PlanOptions> = {}): PlanOptions => ({
    module: "energy",
    table: [HEAD, ...rows],
    mapping,
    dateFormat: "iso",
    unitId: "kWh",
    meters: [],
    existing: [],
    ...over,
  });
  const main = { id: "m1", location: "Main Building", meter_number: "DEWA-1" };

  it("matches an existing meter by number, ignoring case and spacing around it", () => {
    const p = buildImportPlan(opts([["whatever", " dewa-1 ", "2025-01-01", "2025-01-31", "100"]], { meters: [main] }));
    expect(p.rows[0]).toMatchObject({ status: "ok", meterId: "m1" });
    expect(p.newMeters).toEqual([]);
  });

  it("matches by location when the row has no number", () => {
    const p = buildImportPlan(opts([["main building", "", "2025-01-01", "2025-01-31", "100"]], { meters: [main] }));
    expect(p.rows[0]).toMatchObject({ status: "ok", meterId: "m1" });
  });

  it("rejects a number that contradicts the number on file for that location", () => {
    const p = buildImportPlan(opts([["Main Building", "OTHER-9", "2025-01-01", "2025-01-31", "100"]], { meters: [main] }));
    expect(p.rows[0].status).toBe("error");
    expect(p.rows[0].message).toMatch(/does not match DEWA-1/);
  });

  it("proposes new meters, once each, and only if a row will use them", () => {
    const p = buildImportPlan(
      opts([
        ["Annex", "A-1", "2025-01-01", "2025-01-31", "10"],
        ["Annex", "A-1", "2025-02-01", "2025-02-28", "12"],
        ["Gym", "", "2025-02-30", "2025-03-31", "5"], // bad date -> Gym never created
      ]),
    );
    expect(p.newMeters).toEqual([{ key: "n:a-1", location: "Annex", meterNumber: "A-1" }]);
    expect(p.counts).toEqual({ ok: 2, duplicate: 0, error: 1 });
  });

  it("will not create a meter from a number with no location", () => {
    const p = buildImportPlan(opts([["", "ZZ-5", "2025-01-01", "2025-01-31", "10"]]));
    expect(p.rows[0].status).toBe("error");
    expect(p.rows[0].message).toMatch(/no location/);
  });

  it("asks rather than guesses when a row has no meter columns, unless a default is chosen", () => {
    const rows = [["", "", "2025-01-01", "2025-01-31", "10"]];
    expect(needsDefaultMeter(opts(rows).table, mapping)).toBe(true);
    expect(buildImportPlan(opts(rows, { meters: [main] })).rows[0].status).toBe("error");
    const withDefault = buildImportPlan(opts(rows, { meters: [main], defaultMeterId: "m1" }));
    expect(withDefault.rows[0]).toMatchObject({ status: "ok", meterId: "m1" });
  });

  it("enforces the database's rule that end is after start", () => {
    const p = buildImportPlan(opts([["A", "", "2025-01-31", "2025-01-31", "10"], ["A", "", "2025-02-10", "2025-02-01", "10"]]));
    expect(p.rows.map((r) => r.status)).toEqual(["error", "error"]);
    expect(p.rows[0].message).toMatch(/after the start/);
  });

  it("rejects non-numeric, zero, negative and absurd quantities", () => {
    const p = buildImportPlan(
      opts([
        ["A", "", "2025-01-01", "2025-01-31", "lots"],
        ["A", "", "2025-02-01", "2025-02-28", "0"],
        ["A", "", "2025-03-01", "2025-03-31", "-4"],
        ["A", "", "2025-04-01", "2025-04-30", "1e15"],
      ]),
    );
    expect(p.rows.map((r) => r.status)).toEqual(["error", "error", "error", "error"]);
  });

  it("converts to the canonical unit", () => {
    const p = buildImportPlan(opts([["A", "", "2025-01-01", "2025-01-31", "2"]], { unitId: "MWh" }));
    expect(p.rows[0].quantity).toBe(2000);
  });

  it("skips an exact repeat of a saved reading, but blocks one that only overlaps it", () => {
    const existing = [{ meter_id: "m1", period_start: "2025-01-01", period_end: "2025-01-31", quantity: 100 }];
    const p = buildImportPlan(
      opts(
        [
          ["Main Building", "", "2025-01-01", "2025-01-31", "100"], // exact repeat
          ["Main Building", "", "2025-01-15", "2025-02-14", "100"], // overlaps
          ["Main Building", "", "2025-02-01", "2025-02-28", "90"], // clean
        ],
        { meters: [main], existing },
      ),
    );
    expect(p.rows.map((r) => r.status)).toEqual(["duplicate", "error", "ok"]);
    expect(p.rows[1].message).toMatch(/double-count/);
  });

  it("catches overlaps and repeats within the file itself", () => {
    const p = buildImportPlan(
      opts([
        ["A", "", "2025-01-01", "2025-01-31", "10"],
        ["A", "", "2025-01-01", "2025-01-31", "10"],
        ["A", "", "2025-01-20", "2025-02-20", "10"],
        ["B", "", "2025-01-20", "2025-02-20", "10"], // a different meter may overlap A
      ]),
    );
    expect(p.rows.map((r) => r.status)).toEqual(["ok", "duplicate", "error", "ok"]);
    expect(p.rows[2].message).toMatch(/Overlaps line 2/);
  });

  it("reports file-level problems instead of a half-plan", () => {
    expect(buildImportPlan(opts([])).fatal).toMatch(/no data rows/);
    expect(buildImportPlan(opts([["A", "", "2025-01-01", "2025-01-31", "1"]], { mapping: { ...mapping, quantity: null } })).fatal).toMatch(
      /Quantity/,
    );
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ["A", "", "2025-01-01", "2025-01-31", "1"]);
    expect(buildImportPlan(opts(many)).fatal).toMatch(/limit/);
  });

  it("reports the file's own line numbers (header is line 1)", () => {
    const p = buildImportPlan(opts([["A", "", "2025-01-01", "2025-01-31", "x"]]));
    expect(p.rows[0].line).toBe(2);
  });
});

describe("the downloadable template", () => {
  it.each(["energy", "water", "waste", "transportation"] as const)("imports cleanly as %s", (module) => {
    const table = parseCsv(templateCsv(module));
    const mapping = suggestMapping(table[0], module);
    expect(Object.values(mapping).every((v) => v !== null)).toBe(true);
    const fmt = detectDateFormat(table.slice(1).map((r) => r[mapping.period_start!]));
    expect(fmt.format).toBe("iso");
    const p = buildImportPlan({
      module,
      table,
      mapping,
      dateFormat: "iso",
      unitId: MODULE_UNITS[module].choices[0].id,
      meters: [],
      existing: [],
    });
    expect(p.fatal).toBeNull();
    expect(p.counts).toEqual({ ok: 2, duplicate: 0, error: 0 });
    expect(p.newMeters).toHaveLength(1);
  });
});
