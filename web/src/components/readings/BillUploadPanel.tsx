import { useEffect, useMemo, useRef, useState } from "react";
import type { Meter, MeterReading } from "../../lib/energy";
import { BillReadError, extractBill } from "../../lib/billExtract";
import {
  BILL_MAX_BYTES,
  checkReviewRow,
  overallConfidence,
  reviewRowToReading,
  toReviewRows,
  type ReviewRow,
} from "../../lib/billReview";
import { formatError } from "../../lib/formatError";
import type { ModuleConfig } from "../../lib/modules";
import { insertReadings } from "../../lib/readings";
import { MODULE_UNITS } from "../../lib/units";

type Props = {
  schoolId: string;
  config: ModuleConfig;
  meters: Meter[];
  readings: MeterReading[];
  onSaved: () => void | Promise<void>;
};

const CONF_LABEL = { high: "Clear", medium: "Check this", low: "Unsure" } as const;

/**
 * Read a bill with AI, then REVIEW it. The model's answer is a draft: it is shown next to the
 * original file, every field is editable, doubts are spelled out, and nothing is saved until the
 * school ticks that they have checked it against the bill.
 */
export default function BillUploadPanel({ schoolId, config, meters, readings, onSaved }: Props) {
  const units = MODULE_UNITS[config.key];
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "review">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  // The preview is a local blob: the file is never uploaded anywhere but to be read.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const existing = useMemo(
    () =>
      readings.map((r) => ({
        meter_id: r.meter_id,
        period_start: r.period_start,
        period_end: r.period_end,
        quantity: r.quantity,
      })),
    [readings],
  );
  const problems = rows.map((r) => checkReviewRow(r, config.key, existing, rows));
  const canSave = rows.length > 0 && problems.every((p) => p === null) && confirmed && !saving;

  function reset() {
    setPhase("idle");
    setFile(null);
    setRows([]);
    setNotes(null);
    setConfirmed(false);
    setError(null);
    if (input.current) input.current.value = "";
  }

  async function onFile(f: File | undefined) {
    setDone(null);
    setError(null);
    if (!f) return;
    setFile(f);
    setPhase("reading");
    try {
      const raw = await extractBill(f, config.key);
      const parsed = toReviewRows(raw, config.key, meters);
      setRows(parsed.rows);
      setNotes(parsed.notes);
      setConfirmed(false);
      setPhase("review");
    } catch (e) {
      setError(e instanceof BillReadError ? e.message : formatError(e));
      setFile(null);
      setPhase("idle");
      if (input.current) input.current.value = "";
    }
  }

  const patch = (key: string, p: Partial<ReviewRow>) => {
    setConfirmed(false); // an edit means the check has to be redone
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { saved } = await insertReadings({
        schoolId,
        module: config.key,
        canonicalUnit: units.canonical,
        source: "ai_bill_upload",
        reviewed: true,
        confidence: overallConfidence(rows),
        rows: rows.map((r) => reviewRowToReading(r, config.key)),
      });
      setDone(saved);
      reset();
      await onSaved();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rd-bill">
      {phase !== "review" && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Upload a PDF or photo of one {config.key === "water" ? "water" : "electricity"} bill (up to{" "}
            {BILL_MAX_BYTES / 1_000_000} MB). The file is sent to Google’s Gemini AI to read the billing period,
            meter number and quantity, and is <b>not stored</b> by CarbonTally. Bills can print account numbers and
            addresses — the AI isn’t asked for them and we never keep them, but they are on the file Google reads, so
            cover them first if you’d rather. You’ll check every figure before it’s saved.
          </p>
          <div className="rd-bill-drop">
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={phase === "reading"}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {phase === "reading" && <p style={{ margin: "10px 0 0" }}>Reading your bill…</p>}
          </div>
        </>
      )}

      {done !== null && (
        <p className="rd-ok">
          ✓ Saved {done} reading{done === 1 ? "" : "s"} from your bill. They are marked “Bill read by AI”.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {phase === "review" && (
        <>
          <div className="rd-csv-file">
            <b>{file?.name}</b>
            <button className="btn-link" onClick={reset}>
              Choose a different bill
            </button>
          </div>
          {notes && <p className="rd-warn">{notes}</p>}
          {rows.length === 0 && (
            <p className="rd-warn">
              No readings could be found on that file. Try a clearer copy, or enter the figures by hand.
            </p>
          )}

          <div className="rd-bill-split">
            <div className="rd-bill-doc">
              {previewUrl &&
                (file?.type === "application/pdf" ? (
                  <iframe src={previewUrl} title="Your bill" />
                ) : (
                  <img src={previewUrl} alt="Your bill" />
                ))}
            </div>

            <div className="rd-bill-rows">
              {rows.map((r, i) => (
                <div className={`rd-bill-row${problems[i] ? " bad" : ""}`} key={r.key}>
                  <div className="rd-bill-head">
                    <b>Reading {i + 1}</b>
                    <span className={`rd-conf ${r.confidence}`}>{CONF_LABEL[r.confidence]}</span>
                    <button
                      className="btn-link"
                      onClick={() => {
                        setConfirmed(false);
                        setRows((rs) => rs.filter((x) => x.key !== r.key));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {r.ambiguity && <p className="rd-warn">⚠ {r.ambiguity}</p>}
                  <div className="rd-map">
                    <div className="field">
                      <label htmlFor={`b-m-${r.key}`}>{config.noun}</label>
                      <select id={`b-m-${r.key}`} value={r.meterId} onChange={(e) => patch(r.key, { meterId: e.target.value })}>
                        <option value="">— choose —</option>
                        {meters.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.location}
                          </option>
                        ))}
                      </select>
                      {r.meterNumber && <div className="hint">Bill shows meter {r.meterNumber}</div>}
                    </div>
                    <div className="field">
                      <label htmlFor={`b-s-${r.key}`}>Period start</label>
                      <input id={`b-s-${r.key}`} type="date" value={r.periodStart} onChange={(e) => patch(r.key, { periodStart: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`b-e-${r.key}`}>Period end</label>
                      <input id={`b-e-${r.key}`} type="date" value={r.periodEnd} onChange={(e) => patch(r.key, { periodEnd: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`b-q-${r.key}`}>{config.quantityLabel}</label>
                      <div className="unit-row">
                        <input id={`b-q-${r.key}`} type="text" inputMode="decimal" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} />
                        <select aria-label="Unit" value={r.unitId} onChange={(e) => patch(r.key, { unitId: e.target.value })}>
                          <option value="">unit?</option>
                          {units.choices.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {problems[i] && <p className="error-text">{problems[i]}</p>}
                </div>
              ))}

              {rows.length > 0 && (
                <>
                  <label className="rd-check">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I’ve
                    checked these figures against the bill.
                  </label>
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={save} disabled={!canSave}>
                      {saving ? "Saving…" : `Save ${rows.length} reading${rows.length === 1 ? "" : "s"} →`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
