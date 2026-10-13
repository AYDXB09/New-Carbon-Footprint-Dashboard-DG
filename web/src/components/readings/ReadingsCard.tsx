import { useState, type ReactNode } from "react";
import "../../pages/Profile/Profile.css";
import "../../pages/Energy/Energy.css";
import "./readings.css";
import CsvImportPanel from "./CsvImportPanel";
import { overlaps } from "../../lib/csv";
import { READING_SOURCE_LABEL, type Meter, type MeterReading } from "../../lib/energy";
import { formatError } from "../../lib/formatError";
import type { ModuleConfig } from "../../lib/modules";
import { deleteReading, insertReadings } from "../../lib/readings";
import { fmt, fmtDate } from "../../lib/reportView";
import type { SchoolRow } from "../../lib/school";
import { MODULE_UNITS, defaultUnitId, toCanonical } from "../../lib/units";

type Tab = "one" | "csv" | "bill";

type Props = {
  school: SchoolRow;
  config: ModuleConfig;
  meters: Meter[];
  readings: MeterReading[];
  onChanged: () => void | Promise<void>;
  /** The AI bill reader, when it is available for this module. */
  billPanel?: ReactNode;
};

/** Add readings (one at a time, from a CSV, or from a bill), and see every reading on file. */
export default function ReadingsCard({ school, config, meters, readings, onChanged, billPanel }: Props) {
  const units = MODULE_UNITS[config.key];
  const profileUnit = config.profileUnitKey ? school[config.profileUnitKey] : null;
  const defaultUnit = defaultUnitId(config.key, profileUnit);

  const [tab, setTab] = useState<Tab>("one");
  const [meterId, setMeterId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [qty, setQty] = useState("");
  const [unitId, setUnitId] = useState(defaultUnit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const selectedMeter = meterId || (meters.length === 1 ? meters[0].id : "");

  async function saveOne() {
    setError(null);
    if (!selectedMeter) return setError(`Choose a ${config.noun}.`);
    if (!start || !end) return setError("Enter both a start and an end date.");
    if (end <= start) return setError("The end date must be after the start date.");
    const n = Number(qty);
    if (!(n > 0)) return setError("Enter a quantity greater than zero.");
    const q = toCanonical(config.key, unitId, n);
    if (!(q > 0)) return setError("That quantity rounds to zero in the stored unit.");
    const clash = readings.find((r) => r.meter_id === selectedMeter && overlaps({ s: start, e: end }, { s: r.period_start, e: r.period_end }));
    if (clash) {
      return setError(
        `That overlaps a reading already saved for this ${config.noun} (${fmtDate(clash.period_start)} → ${fmtDate(clash.period_end)}). Saving it would double-count those days. Delete the old one first if it is wrong.`,
      );
    }
    setBusy(true);
    try {
      await insertReadings({
        schoolId: school.id,
        module: config.key,
        canonicalUnit: units.canonical,
        source: "manual",
        rows: [{ meterId: selectedMeter, quantity: q, periodStart: start, periodEnd: end }],
      });
      setStart("");
      setEnd("");
      setQty("");
      await onChanged();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteReading(id);
      setConfirmDelete(null);
      await onChanged();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const meterName = (id: string) => meters.find((m) => m.id === id)?.location ?? "—";
  const sorted = [...readings].sort(
    (a, b) => meterName(a.meter_id).localeCompare(meterName(b.meter_id)) || a.period_start.localeCompare(b.period_start),
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "one", label: "Add one" },
    { key: "csv", label: "Import a CSV" },
    ...(billPanel ? [{ key: "bill" as Tab, label: "Read a bill" }] : []),
  ];

  return (
    <div className="card">
      <div className="rd-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`rd-tab${tab === t.key ? " on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "one" && (
        <div className="rd-form">
          {meters.length === 0 ? (
            <p className="rd-empty">Add a {config.noun} in step 1 first — or import a CSV, which can create it for you.</p>
          ) : (
            <>
              <div className="field-grid">
                {meters.length > 1 && (
                  <div className="field rd-wide">
                    <label htmlFor="rdMeter">{config.noun}</label>
                    <select id="rdMeter" value={selectedMeter} onChange={(e) => setMeterId(e.target.value)}>
                      <option value="">— choose —</option>
                      {meters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.location}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="rdStart">Period start</label>
                  <input id="rdStart" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="rdEnd">Period end</label>
                  <input id="rdEnd" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <div className="field rd-wide">
                  <label htmlFor="rdQty">{config.quantityLabel}</label>
                  <div className="unit-row">
                    <input
                      id="rdQty"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 1109200"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                    <select aria-label="Unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                      {units.choices.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={saveOne} disabled={busy}>
                  {busy ? "Saving…" : "Save reading →"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "csv" && (
        <CsvImportPanel
          schoolId={school.id}
          config={config}
          meters={meters}
          readings={readings}
          defaultUnitId={defaultUnit}
          onImported={onChanged}
        />
      )}

      {tab === "bill" && billPanel}

      {error && <p className="error-text">{error}</p>}

      <h4 className="rd-h4 rd-h4-top">Readings on file ({readings.length})</h4>
      {readings.length === 0 ? (
        <p className="rd-empty">Nothing yet. A full year is used as-is; anything shorter is flagged, never scaled up.</p>
      ) : (
        <div className="rd-tablewrap">
          <table className="rd-table">
            <thead>
              <tr>
                <th>{config.noun}</th>
                <th>Period</th>
                <th className="r">Quantity</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>{meterName(r.meter_id)}</td>
                  <td>
                    {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                  </td>
                  <td className="r">
                    {fmt(r.quantity, r.quantity < 100 ? 3 : 0)} {units.canonicalLabel}
                  </td>
                  <td>
                    <span className="rd-pill">{READING_SOURCE_LABEL[r.source]}</span>
                  </td>
                  <td className="r">
                    {confirmDelete === r.id ? (
                      <>
                        <button className="btn-link rd-danger" onClick={() => remove(r.id)} disabled={busy}>
                          Delete
                        </button>{" "}
                        <button className="btn-link" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button className="btn-link" onClick={() => setConfirmDelete(r.id)} disabled={busy}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
