import { useMemo, useRef, useState } from "react";
import { createMeter, type Meter, type MeterReading } from "../../lib/energy";
import {
  DATE_FORMAT_LABELS,
  FIELDS,
  MAX_IMPORT_BYTES,
  buildImportPlan,
  detectDateFormat,
  needsDefaultMeter,
  parseCsv,
  suggestMapping,
  templateCsv,
  type DateFormat,
  type Field,
} from "../../lib/csv";
import { formatError } from "../../lib/formatError";
import type { ModuleConfig } from "../../lib/modules";
import { insertReadings } from "../../lib/readings";
import { fmt, fmtDate } from "../../lib/reportView";
import { MODULE_UNITS } from "../../lib/units";

type Props = {
  schoolId: string;
  config: ModuleConfig;
  meters: Meter[];
  readings: MeterReading[];
  /** The unit pre-selected for the file, usually the school's own setting. */
  defaultUnitId: string;
  onImported: (saved: number) => void | Promise<void>;
};

const NOT_IN_FILE = "";

/**
 * Guided import: choose a file, check which column is which, and read the plan
 * back BEFORE anything is saved. Rows that can't be placed are shown with the
 * reason; nothing is silently dropped, merged or guessed.
 */
export default function CsvImportPanel({ schoolId, config, meters, readings, defaultUnitId, onImported }: Props) {
  const units = MODULE_UNITS[config.key];
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<Field, number | null> | null>(null);
  const [dateChoice, setDateChoice] = useState<DateFormat | "auto">("auto");
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [defaultMeterId, setDefaultMeterId] = useState("");
  const [newKind, setNewKind] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const headers = table?.[0] ?? [];

  const detected = useMemo(() => {
    if (!table || !mapping || mapping.period_start === null || mapping.period_end === null) {
      return { format: null, ambiguous: false } as ReturnType<typeof detectDateFormat>;
    }
    const vals = table.slice(1).flatMap((r) => [r[mapping.period_start!] ?? "", r[mapping.period_end!] ?? ""]);
    return detectDateFormat(vals);
  }, [table, mapping]);

  const dateFormat: DateFormat | null = dateChoice !== "auto" ? dateChoice : detected.format;

  const plan = useMemo(() => {
    if (!table || !mapping || !dateFormat) return null;
    return buildImportPlan({
      module: config.key,
      table,
      mapping,
      dateFormat,
      unitId,
      meters,
      existing: readings.map((r) => ({
        meter_id: r.meter_id,
        period_start: r.period_start,
        period_end: r.period_end,
        quantity: r.quantity,
      })),
      defaultMeterId: defaultMeterId || null,
    });
  }, [table, mapping, dateFormat, unitId, meters, readings, defaultMeterId, config.key]);

  const askDefault = table && mapping ? needsDefaultMeter(table, mapping) : false;

  async function onFile(file: File | undefined) {
    setDone(null);
    setImportError(null);
    setReadError(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setReadError("That file is larger than 1 MB. Split it into smaller files.");
      return;
    }
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) {
        setReadError("That file has no data rows. It needs a header row and at least one reading.");
        return;
      }
      setFileName(file.name);
      setTable(rows);
      setMapping(suggestMapping(rows[0], config.key));
      setDateChoice("auto");
      setDefaultMeterId("");
    } catch (e) {
      setReadError(formatError(e));
    }
  }

  function reset() {
    setTable(null);
    setMapping(null);
    setFileName("");
    setDone(null);
    setImportError(null);
    if (input.current) input.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv(config.key)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carbontally-${config.key}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!plan || plan.importable.length === 0) return;
    if (config.kinds && plan.newMeters.length > 0 && !newKind) {
      setImportError("Choose what the new " + config.nounPlural + " are, so the right emission factor is used.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const idByKey = new Map<string, string>();
      for (const nm of plan.newMeters) {
        const created = await createMeter(schoolId, config.key, nm.location, nm.meterNumber, config.kinds ? newKind : null);
        idByKey.set(nm.key, created.id);
      }
      const { saved } = await insertReadings({
        schoolId,
        module: config.key,
        canonicalUnit: units.canonical,
        source: "csv_import",
        rows: plan.importable.map((r) => ({
          meterId: r.meterId ?? idByKey.get(r.newMeterKey!)!,
          quantity: r.quantity!,
          periodStart: r.periodStart!,
          periodEnd: r.periodEnd!,
        })),
      });
      setDone(saved);
      setTable(null);
      setMapping(null);
      setFileName("");
      if (input.current) input.current.value = "";
      await onImported(saved);
    } catch (e) {
      setImportError(formatError(e));
      await onImported(0); // pick up anything that did save
    } finally {
      setImporting(false);
    }
  }

  const unpricedMatches =
    config.kinds && plan
      ? [...new Set(plan.importable.map((r) => r.meterId).filter((id): id is string => id !== null))]
          .map((id) => meters.find((m) => m.id === id))
          .filter((m): m is Meter => !!m && !m.factor_key)
      : [];

  const shownRows = plan ? (onlyProblems ? plan.rows.filter((r) => r.status !== "ok") : plan.rows) : [];

  return (
    <div className="rd-csv">
      <div className="rd-csv-top">
        <button className="btn btn-ghost" onClick={downloadTemplate}>
          ↓ Download the template
        </button>
        <label className="rd-file">
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      <p className="hint">
        Any CSV works — an export from your utility, or the template. You'll check which column is which before
        anything is saved. Dates should be year-month-day; the end date must be after the start.
      </p>
      {readError && <p className="error-text">{readError}</p>}
      {done !== null && (
        <p className="rd-ok">
          ✓ Saved {done} reading{done === 1 ? "" : "s"} from your file.
        </p>
      )}

      {table && mapping && (
        <>
          <div className="rd-csv-file">
            <b>{fileName}</b> · {table.length - 1} row{table.length === 2 ? "" : "s"}
            <button className="btn-link" onClick={reset}>
              Choose a different file
            </button>
          </div>

          <h4 className="rd-h4">1 · Which column is which?</h4>
          <div className="rd-map">
            {FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label htmlFor={`map-${f.key}`}>
                  {f.key === "quantity" ? `${f.label} (${units.canonicalLabel} or the unit below)` : f.label}
                  {f.required ? " *" : ""}
                </label>
                <select
                  id={`map-${f.key}`}
                  value={mapping[f.key] === null ? NOT_IN_FILE : String(mapping[f.key])}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f.key]: e.target.value === NOT_IN_FILE ? null : Number(e.target.value) })
                  }
                >
                  <option value={NOT_IN_FILE}>— not in my file —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `(column ${i + 1})`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h4 className="rd-h4">2 · Dates and units</h4>
          <div className="rd-map">
            <div className="field">
              <label htmlFor="rd-datefmt">Date format</label>
              <select
                id="rd-datefmt"
                value={dateChoice}
                onChange={(e) => setDateChoice(e.target.value as DateFormat | "auto")}
              >
                <option value="auto">
                  {detected.format ? `Detected: ${DATE_FORMAT_LABELS[detected.format]}` : "— choose —"}
                </option>
                {(Object.keys(DATE_FORMAT_LABELS) as DateFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {DATE_FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
              {!dateFormat && detected.ambiguous && (
                <div className="error-text">
                  These dates could be day/month or month/day (e.g. 03/04/2025). Pick which — guessing could swap two months.
                </div>
              )}
              {!dateFormat && !detected.ambiguous && (
                <div className="error-text">These dates don't match a format we know. Pick one, or fix the file.</div>
              )}
            </div>
            <div className="field">
              <label htmlFor="rd-unit">Quantities in the file are in</label>
              <select id="rd-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                {units.choices.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
              <div className="hint">Converted to {units.canonicalLabel} when saved.</div>
            </div>
            {askDefault && (
              <div className="field">
                <label htmlFor="rd-default">Rows with no {config.noun} named go to</label>
                <select id="rd-default" value={defaultMeterId} onChange={(e) => setDefaultMeterId(e.target.value)}>
                  <option value="">— choose, or those rows are skipped —</option>
                  {meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.location}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {plan?.fatal && <p className="error-text">{plan.fatal}</p>}

          {plan && !plan.fatal && (
            <>
              <h4 className="rd-h4">3 · Check before saving</h4>
              <p className="rd-summary">
                <b>{plan.counts.ok}</b> will be saved
                {plan.counts.duplicate > 0 && (
                  <>
                    {" "}
                    · <b>{plan.counts.duplicate}</b> already saved (skipped)
                  </>
                )}
                {plan.counts.error > 0 && (
                  <>
                    {" "}
                    · <b className="rd-bad">{plan.counts.error}</b> need fixing (not imported)
                  </>
                )}
              </p>

              {plan.newMeters.length > 0 && (
                <div className="rd-newmeters">
                  <b>
                    {plan.newMeters.length} new {plan.newMeters.length === 1 ? config.noun : config.nounPlural} will be
                    created:
                  </b>{" "}
                  {plan.newMeters.map((m) => (m.meterNumber ? `${m.location} (${m.meterNumber})` : m.location)).join(", ")}
                  {config.kinds && (
                    <div className="field" style={{ marginTop: 8, maxWidth: 360 }}>
                      <label htmlFor="rd-newkind">{config.kindLabel}</label>
                      <select id="rd-newkind" value={newKind} onChange={(e) => setNewKind(e.target.value)}>
                        <option value="">— choose —</option>
                        {config.kinds.map((k) => (
                          <option key={k.key} value={k.key}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {unpricedMatches.length > 0 && (
                <p className="rd-warn">
                  {unpricedMatches.map((m) => m.location).join(", ")} {unpricedMatches.length === 1 ? "has" : "have"} no
                  type set, so {unpricedMatches.length === 1 ? "its" : "their"} readings can be saved but not yet counted.
                  Set the type in step 1.
                </p>
              )}

              <label className="rd-check">
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show
                only rows that need attention
              </label>
              <div className="rd-tablewrap">
                <table className="rd-table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>{config.noun}</th>
                      <th>Period</th>
                      <th className="r">Quantity</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.slice(0, 200).map((r) => (
                      <tr key={r.line} className={`rd-row-${r.status}`}>
                        <td>{r.line}</td>
                        <td>{r.meterLabel || "—"}</td>
                        <td>{r.periodStart && r.periodEnd ? `${fmtDate(r.periodStart)} → ${fmtDate(r.periodEnd)}` : "—"}</td>
                        <td className="r">{r.quantity != null ? `${fmt(r.quantity, r.quantity < 100 ? 3 : 0)} ${units.canonicalLabel}` : "—"}</td>
                        <td>
                          {r.status === "ok" && <span className="rd-pill good">Will save</span>}
                          {r.status === "duplicate" && <span className="rd-pill">Skipped · {r.message}</span>}
                          {r.status === "error" && <span className="rd-pill bad">{r.message}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {shownRows.length > 200 && <p className="hint">Showing the first 200 of {shownRows.length} rows.</p>}
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={runImport}
                  disabled={importing || plan.importable.length === 0}
                >
                  {importing ? "Importing…" : `Import ${plan.counts.ok} reading${plan.counts.ok === 1 ? "" : "s"} →`}
                </button>
                {plan.counts.error > 0 && plan.counts.ok > 0 && (
                  <span className="hint">The {plan.counts.error} problem row(s) will be left out.</span>
                )}
              </div>
            </>
          )}
          {importError && <p className="error-text">{importError}</p>}
        </>
      )}
    </div>
  );
}
