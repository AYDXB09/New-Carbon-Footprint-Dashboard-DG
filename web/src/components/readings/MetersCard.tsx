import { useState } from "react";
import "../../pages/Profile/Profile.css";
import "../../pages/Energy/Energy.css";
import "./readings.css";
import { createMeter, updateMeter, type Meter, type MeterReading } from "../../lib/energy";
import { formatError } from "../../lib/formatError";
import { kindLabel, type ModuleConfig } from "../../lib/modules";
import { deleteMeter } from "../../lib/readings";
import { fmtDate } from "../../lib/reportView";

type Props = {
  schoolId: string;
  config: ModuleConfig;
  meters: Meter[];
  readings: MeterReading[];
  onChanged: () => void | Promise<void>;
};

/** Register the things readings attach to: meters, waste streams or vehicle groups. */
export default function MetersCard({ schoolId, config, meters, readings, onChanged }: Props) {
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [location, setLocation] = useState("");
  const [number, setNumber] = useState("");
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const startNew = () => {
    setEditing("new");
    setLocation("");
    setNumber("");
    setKind("");
    setError(null);
  };
  const startEdit = (m: Meter) => {
    setEditing(m.id);
    setLocation(m.location);
    setNumber(m.meter_number ?? "");
    setKind(m.factor_key ?? "");
    setError(null);
  };

  async function save() {
    const loc = location.trim();
    if (!loc) return setError(`Enter a ${config.locationLabel.toLowerCase()}.`);
    if (config.kinds && !kind) return setError("Choose one of the options so the right emission factor is used.");
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") {
        await createMeter(schoolId, config.key, loc, number.trim() || null, config.kinds ? kind : null);
      } else if (editing) {
        await updateMeter(editing, {
          location: loc,
          meter_number: number.trim() || null,
          ...(config.kinds ? { factor_key: kind } : {}),
        });
      }
      setEditing(null);
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
      await deleteMeter(id);
      setConfirmDelete(null);
      await onChanged();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <div className="rd-form">
      <div className="field-grid">
        <div className="field">
          <label htmlFor="rdLoc">{config.locationLabel}</label>
          <input
            id="rdLoc"
            type="text"
            placeholder={config.locationPlaceholder}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="rdNum">{config.numberLabel}</label>
          <input
            id="rdNum"
            type="text"
            placeholder={config.numberPlaceholder}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            autoComplete="off"
          />
          <div className="hint">Lets a CSV import match readings to this {config.noun} on its own.</div>
        </div>
        {config.kinds && (
          <div className="field rd-wide">
            <label htmlFor="rdKind">{config.kindLabel}</label>
            <select id="rdKind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">— choose —</option>
              {config.kinds.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
            {kind && <div className="hint">{config.kinds.find((k) => k.key === kind)?.hint}</div>}
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : editing === "new" ? `Add ${config.noun} →` : "Save changes"}
        </button>
        <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="card">
      {meters.length === 0 && editing === null && (
        <p className="rd-empty">
          No {config.nounPlural} yet. Add one here, or import a CSV in the next step — it can set them up for you.
        </p>
      )}

      {meters.length > 0 && (
        <ul className="rd-meters">
          {meters.map((m) => {
            const mine = readings.filter((r) => r.meter_id === m.id);
            const first = mine.length ? mine.map((r) => r.period_start).sort()[0] : null;
            const last = mine.length ? mine.map((r) => r.period_end).sort().slice(-1)[0] : null;
            const kl = kindLabel(config.key, m.factor_key);
            return (
              <li key={m.id}>
                {editing === m.id ? (
                  form
                ) : (
                  <div className="rd-meter">
                    <div className="rd-meter-main">
                      <b>{m.location}</b>
                      {m.meter_number && <span className="rd-muted"> · {m.meter_number}</span>}
                      {kl && <span className="rd-kind">{kl}</span>}
                      {config.kinds && !kl && <span className="rd-kind warn">Choose a type</span>}
                      <div className="rd-muted">
                        {mine.length === 0
                          ? "No readings yet"
                          : `${mine.length} reading${mine.length === 1 ? "" : "s"} · ${fmtDate(first!)} → ${fmtDate(last!)}`}
                      </div>
                    </div>
                    <div className="rd-actions">
                      <button className="btn-link" onClick={() => startEdit(m)} disabled={busy}>
                        Edit
                      </button>
                      {confirmDelete === m.id ? (
                        <>
                          <button className="btn-link rd-danger" onClick={() => remove(m.id)} disabled={busy}>
                            Yes, delete
                          </button>
                          <button className="btn-link" onClick={() => setConfirmDelete(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-link"
                          onClick={() => setConfirmDelete(m.id)}
                          disabled={busy || mine.length > 0}
                          title={mine.length > 0 ? "Delete its readings first" : undefined}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing === "new" && form}
      {editing === null && (
        <div className="form-actions" style={{ marginTop: meters.length ? 14 : 4 }}>
          <button className="btn btn-ghost" onClick={startNew}>
            + Add a {config.noun}
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
