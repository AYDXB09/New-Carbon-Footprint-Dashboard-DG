import { useEffect, useMemo, useState } from "react";
// Shell/section/field-grid/btn/badge primitives are still only defined in
// Profile.css — not yet extracted into their own file. Importing it here
// rather than duplicating those rules; worth a real shared stylesheet once a
// third page needs them (see components/Sidebar.css for why that matters).
import "../Profile/Profile.css";
import "./Energy.css";
import Sidebar from "../../components/Sidebar";
import { getOrCreateMySchool, type SchoolRow } from "../../lib/school";
import {
  createReport,
  getDefaultFactor,
  getLatestReport,
  listFactorCandidates,
  listMeters,
  markModuleEnabled,
  toEngineFactor,
  type EmissionFactorRow,
  type EnergyReportRow,
  type Meter,
  type MeterReading,
} from "../../lib/energy";
import MetersCard from "../../components/readings/MetersCard";
import BillUploadPanel from "../../components/readings/BillUploadPanel";
import ReadingsCard from "../../components/readings/ReadingsCard";
import { MODULE_CONFIG } from "../../lib/modules";
import { listAllReadings } from "../../lib/readings";
import { analyseCoverageByMeter } from "../../lib/engine/coverage";
import { runEnergySimulation, DEFAULT_ITERATIONS, type EnergyResult } from "../../lib/engine/energy";

const MODULE = "energy";
const FACTOR_KEY = "grid_intensity";

// Published, citable benchmark — not per-school data, so it's a constant, not
// a query. See supabase/migrations/0011 for the same standard applied to
// emission_factors: cite it or don't include it, never approximate it.
const BENCHMARK = {
  best: 92,
  median: 134,
  worst: 233,
  sourceLabel:
    "EmiratesGBC Building Efficiency Accelerator report (2019) — 121 UAE properties, 103 in Dubai.",
  sourceUrl:
    "https://www.emiratesgbc.org/wp-content/uploads/2025/02/1901010-BEA-Report-Final-2.pdf",
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function fmt(n: number, d = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function coverageLabel(cls: "spot_check" | "partial_year" | "full_year"): string {
  if (cls === "full_year") return "Full year";
  if (cls === "partial_year") return "Partial year";
  return "Spot check";
}

/**
 * Pure geometry (line/rect/dot) stays in SVG; every number and label is
 * positioned HTML text over it. An earlier sketch put labels inside the
 * SVG's viewBox, which shrinks them illegibly on a narrow phone along with
 * everything else — real usability bug, fixed by never repeating it here.
 */
function RangeChart({ lo, mid, hi, domainLo, domainHi }: {
  lo: number; mid: number; hi: number; domainLo: number; domainHi: number;
}) {
  const x = (v: number) => ((v - domainLo) / (domainHi - domainLo)) * 100;
  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 900 60" preserveAspectRatio="none" role="img" aria-label="Emissions range, p10 to p90">
        <line x1="10" y1="40" x2="890" y2="40" stroke="var(--rule)" strokeWidth="1" />
        <rect
          x={(x(lo) / 100) * 880 + 10}
          y="28"
          width={Math.max(2, ((x(hi) - x(lo)) / 100) * 880)}
          height="24"
          rx="4"
          fill="var(--band)"
        />
        <line
          x1={(x(mid) / 100) * 880 + 10}
          x2={(x(mid) / 100) * 880 + 10}
          y1="20"
          y2="60"
          stroke="var(--blue)"
          strokeWidth="2"
        />
        <circle cx={(x(mid) / 100) * 880 + 10} cy="40" r="4.5" fill="var(--blue)" />
      </svg>
      <span className="chart-label edge-start" style={{ left: "0%", top: 0 }}>{fmt(domainLo, 0)} t</span>
      <span className="chart-label edge-end" style={{ left: "100%", top: 0 }}>{fmt(domainHi, 0)} t</span>
      <span className="chart-label strong" style={{ left: `${x(mid)}%`, top: 66 }}>median {fmt(mid)}</span>
    </div>
  );
}

export default function Energy() {
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Steps 01 and 02 — every meter and every reading for this school
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);

  // Step 03 — result
  const [report, setReport] = useState<EnergyReportRow | null>(null);
  const [factorCandidates, setFactorCandidates] = useState<EmissionFactorRow[]>([]);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function loadAll(schoolRow: SchoolRow) {
    const [m, r] = await Promise.all([listMeters(schoolRow.id, MODULE), listAllReadings(schoolRow.id, MODULE)]);
    setMeters(m);
    setReadings(r);
    return r;
  }

  useEffect(() => {
    (async () => {
      try {
        const schoolRow = await getOrCreateMySchool();
        setSchool(schoolRow);
        const loaded = await loadAll(schoolRow);
        if (loaded.length > 0) {
          setFactorCandidates(await listFactorCandidates(MODULE, FACTOR_KEY, schoolRow.country_code));
          const existingReport = await getLatestReport(schoolRow.id, MODULE);
          if (existingReport) {
            setReport(existingReport);
            setSelectedFactorId(existingReport.factor_set_version);
          }
        }
      } catch (err) {
        setLoadError(formatError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Readings changed (added, imported or deleted): reload them, and drop the
  // saved result from view — it described the old readings, so don't keep
  // presenting it as current until the school reruns.
  async function onReadingsChanged() {
    if (!school) return;
    try {
      await loadAll(school);
      setReport(null);
      setSelectedFactorId(null);
    } catch (err) {
      setLoadError(formatError(err));
    }
  }

  // Judged per meter and combined (weakest meter decides) — see engine/coverage.
  const coverage = useMemo(() => {
    if (readings.length === 0) return null;
    return analyseCoverageByMeter(
      readings.map((r) => ({ start: r.period_start, end: r.period_end, meterId: r.meter_id })),
    ).overall;
  }, [readings]);

  const selectedFactor = factorCandidates.find((f) => f.id === selectedFactorId) ?? null;

  // Recomputed client-side from the saved report's own seed, not re-fetched —
  // this is "reproducible from this report row alone" made literal: picking
  // the same factor the report was actually saved with reproduces its exact
  // numbers, and picking a different one previews what would change.
  const preview: EnergyResult | null = useMemo(() => {
    if (!selectedFactor || !report || readings.length === 0) return null;
    return runEnergySimulation(
      {
        readings: readings.map((r) => ({
          consumptionKwh: r.quantity,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          meterId: r.meter_id,
        })),
        gridIntensity: toEngineFactor(selectedFactor),
        denominators: {
          gfaConditionedM2: school?.gfa_conditioned_m2 ?? null,
          studentsTotal: school?.students_total ?? null,
        },
      },
      { seed: report.simulation_seed ?? 1, iterations: report.simulation_runs ?? DEFAULT_ITERATIONS },
    );
  }, [selectedFactor, report, readings, school]);

  const isPreviewingOtherSource = report != null && selectedFactorId !== report.factor_set_version;

  async function handleRun() {
    if (!school || readings.length === 0 || !coverage) return;
    setRunError(null);
    setRunning(true);
    try {
      const factor = await getDefaultFactor(MODULE, FACTOR_KEY, school.country_code);
      if (!factor) {
        setRunError("No emission factor is available for this module yet.");
        return;
      }
      const candidates = await listFactorCandidates(MODULE, FACTOR_KEY, school.country_code);

      const seed = Math.floor(Math.random() * 2 ** 31);
      const result = runEnergySimulation(
        {
          readings: readings.map((r) => ({
            consumptionKwh: r.quantity,
            periodStart: r.period_start,
            periodEnd: r.period_end,
            meterId: r.meter_id,
          })),
          gridIntensity: toEngineFactor(factor),
          denominators: {
            gfaConditionedM2: school.gfa_conditioned_m2,
            studentsTotal: school.students_total,
          },
        },
        { seed, iterations: DEFAULT_ITERATIONS },
      );

      const sortedStarts = [...readings].sort((a, b) => a.period_start.localeCompare(b.period_start));
      const sortedEnds = [...readings].sort((a, b) => a.period_end.localeCompare(b.period_end));

      const saved = await createReport({
        schoolId: school.id,
        module: MODULE,
        periodStart: sortedStarts[0].period_start,
        periodEnd: sortedEnds[sortedEnds.length - 1].period_end,
        coverage: result.coverage.coverageClass,
        tier: "tier_2_actual",
        resultP10: result.emissionsKgCo2e.p10 / 1000,
        resultMedian: result.emissionsKgCo2e.median / 1000,
        resultP90: result.emissionsKgCo2e.p90 / 1000,
        seed,
        iterations: result.iterations,
        factorSetVersion: factor.id,
        derivation: {
          steps: result.derivation,
          factor: {
            id: factor.id,
            scope: factor.scope,
            source_org: factor.source_org,
            source_name: factor.source_name,
            vintage_year: factor.vintage_year,
            value: factor.value,
            uncertainty_pct: factor.uncertainty_pct,
          },
        },
        denominators: {
          gfaTotalM2: school.gfa_total_m2,
          gfaConditionedM2: school.gfa_conditioned_m2,
          studentsTotal: school.students_total,
          studentsBoarding: school.students_boarding,
          staffHeadcount: school.staff_headcount,
        },
      });

      await markModuleEnabled(school.id, MODULE, "tier_2_actual");

      setFactorCandidates(candidates);
      setSelectedFactorId(factor.id);
      setReport(saved);
    } catch (err) {
      setRunError(formatError(err));
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <main className="main">
          <p className="mono" style={{ padding: "2rem" }}>Loading…</p>
        </main>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="shell">
        <main className="main">
          <p className="mono" style={{ padding: "2rem", color: "var(--amber)" }}>
            {loadError ?? "Could not load a school profile."}
          </p>
        </main>
      </div>
    );
  }

  const hasDenominators = school.gfa_conditioned_m2 != null && school.students_total != null;
  const euiPerM2 =
    school.gfa_conditioned_m2 && readings.length > 0
      ? readings.reduce((a, r) => a + r.quantity, 0) / school.gfa_conditioned_m2
      : null;

  return (
    <div className="shell">
      <Sidebar active="energy" />
      <main className="main energy-main">
        <div className="topbar-inline">
          <div>
            <p className="eyebrow mono">/energy — your meters, your readings, one sourced number</p>
            <h1>Energy</h1>
          </div>
          <div className="chips">
            <span className={`chip ${coverage ? (coverage.coverageClass === "full_year" ? "good" : "warn") : "warn"}`}>
              <span className="dot"></span>
              {coverage ? coverageLabel(coverage.coverageClass) : "No data yet"}
            </span>
            <span className="chip data" title="Tier 2 = based on real submitted meter data, not an estimate">
              <span className="dot"></span>Tier 2 · Actual
            </span>
          </div>
        </div>

        {loadError && <p className="mono" style={{ color: "var(--amber)" }}>{loadError}</p>}

        {/* 01 — METERS */}
        <section className="entry">
          <div className="entry-index">
            <p className="entry-num">01</p>
            <h2 className="entry-title">Your meters</h2>
            <p className="entry-desc">One per supply — a building, a chiller, an annex. Every reading attaches to one.</p>
          </div>
          <MetersCard
            schoolId={school.id}
            config={MODULE_CONFIG.energy}
            meters={meters}
            readings={readings}
            onChanged={onReadingsChanged}
          />
        </section>

        {/* 02 — READINGS */}
        <section className="entry">
          <div className="entry-index">
            <p className="entry-num">02</p>
            <h2 className="entry-title">Add readings</h2>
            <p className="entry-desc">A full year is used as-is. Anything shorter is flagged, not hidden.</p>
          </div>
          <div>
            <ReadingsCard
              school={school}
              config={MODULE_CONFIG.energy}
              meters={meters}
              readings={readings}
              onChanged={onReadingsChanged}
              billPanel={
                <BillUploadPanel
                  schoolId={school.id}
                  config={MODULE_CONFIG.energy}
                  meters={meters}
                  readings={readings}
                  onSaved={onReadingsChanged}
                />
              }
            />
            {!hasDenominators && (
              <p className="hint" style={{ marginTop: 10 }}>
                Add floor area and enrolment on your profile to see intensity figures.
              </p>
            )}
          </div>
        </section>

        {/* 03 — RESULT */}
        <section className="entry">
          <div className="entry-index">
            <p className="entry-num">03</p>
            <h2 className="entry-title">See the result</h2>
            <p className="entry-desc">The band width is the data-quality signal — no separate confidence score sits next to it.</p>
          </div>
          <div className={`card${readings.length === 0 ? " locked" : ""}`}>
            {readings.length === 0 && <span className="lock-pill">🔒 Add a reading first</span>}

            {!report && readings.length > 0 && (
              <div className="form-actions" style={{ marginTop: 0 }}>
                <button className="btn btn-primary" onClick={handleRun} disabled={running}>
                  {running ? "Running…" : "Run calculation →"}
                </button>
                {runError && <p className="error-text">{runError}</p>}
              </div>
            )}

            {report && preview && (
              <>
                {isPreviewingOtherSource && (
                  <p className="preview-note">
                    Previewing with a different source — your saved report still uses{" "}
                    <b>
                      {factorCandidates.find((f) => f.id === report.factor_set_version)?.source_org ?? "the original source"}
                    </b>
                    .
                  </p>
                )}

                <div className="result-head">
                  <span className="result-median mono">{fmt(preview.emissionsKgCo2e.median / 1000)}</span>
                  <span className="result-unit">tCO2e — our best single estimate</span>
                </div>
                <p className="result-sub">
                  Likely between <b>{fmt(preview.emissionsKgCo2e.p10 / 1000)}</b> and{" "}
                  <b>{fmt(preview.emissionsKgCo2e.p90 / 1000)}</b> tonnes. The range comes from how precisely
                  we know your electricity grid's carbon intensity — not from anything uncertain about your
                  meter reading.
                </p>

                <RangeChart
                  lo={preview.emissionsKgCo2e.p10 / 1000}
                  mid={preview.emissionsKgCo2e.median / 1000}
                  hi={preview.emissionsKgCo2e.p90 / 1000}
                  domainLo={(preview.emissionsKgCo2e.p10 / 1000) * 0.85}
                  domainHi={(preview.emissionsKgCo2e.p90 / 1000) * 1.15}
                />

                <div className="intensity-row">
                  <div className="intensity-item">
                    <div className="n mono">{preview.intensity.euiPerM2 != null ? fmt(preview.intensity.euiPerM2) : "—"}</div>
                    <div className="l">kWh / m² conditioned / yr</div>
                  </div>
                  <div className="intensity-item">
                    <div className="n mono">{preview.intensity.emissionsPerM2 != null ? fmt(preview.intensity.emissionsPerM2, 2) : "—"}</div>
                    <div className="l">kgCO2e / m² / yr</div>
                  </div>
                  <div className="intensity-item">
                    <div className="n mono">
                      {preview.intensity.euiPerStudent != null ? Math.round(preview.intensity.euiPerStudent).toLocaleString() : "—"}
                    </div>
                    <div className="l">kWh / student / yr</div>
                  </div>
                </div>

                <div className="benchmark">
                  <div className="benchmark-title">Against a published benchmark</div>
                  <div className="benchmark-source">
                    {BENCHMARK.sourceLabel}{" "}
                    <a href={BENCHMARK.sourceUrl} target="_blank" rel="noopener noreferrer">View source</a>
                  </div>
                  {euiPerM2 != null ? (
                    <BenchmarkChart value={euiPerM2} />
                  ) : (
                    <p className="hint">Add conditioned floor area on your profile to compare against this benchmark.</p>
                  )}
                </div>

                <details className="disclosure">
                  <summary><span className="chev">▸</span> Why this number? (source, method, and how to change it)</summary>

                  <div className="source-control">
                    <label htmlFor="src">Grid intensity source</label>
                    <select
                      id="src"
                      className="source-select"
                      value={selectedFactorId ?? ""}
                      onChange={(e) => setSelectedFactorId(e.target.value)}
                    >
                      {factorCandidates.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.source_org} — {f.source_name} ({f.vintage_year}) · {f.scope} match
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="derivation">
                    <div className="drow">
                      <div className="dlabel">Metered consumption</div>
                      <div className="dvalue">{readings.reduce((a, r) => a + r.quantity, 0).toLocaleString()} kWh</div>
                      <div className="ddetail">
                        {readings.length} reading(s), {coverage?.coveredDays ?? 0} days
                        {coverage && coverage.gaps.length > 0 ? `, ${coverage.gaps.length} gap(s)` : ""}.
                      </div>
                    </div>
                    {selectedFactor && (
                      <div className="drow">
                        <div className="dlabel">Grid intensity applied</div>
                        <div className="dvalue">{selectedFactor.value} {selectedFactor.unit}</div>
                        <div className="ddetail">
                          {selectedFactor.uncertainty_pct
                            ? `Sampled log-normally, median ${selectedFactor.value} ${selectedFactor.unit}, ±${selectedFactor.uncertainty_pct}% (1σ) — ${selectedFactor.scope} match.`
                            : "Applied as a known constant (no uncertainty published)."}
                        </div>
                        <div className="dsource">
                          {selectedFactor.source_org} — {selectedFactor.source_name} ({selectedFactor.vintage_year})
                          {selectedFactor.source_url && (
                            <>
                              {" · "}
                              <a href={selectedFactor.source_url} target="_blank" rel="noopener noreferrer">source</a>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="drow">
                      <div className="dlabel">Simulation</div>
                      <div className="dvalue">{preview.iterations.toLocaleString()} iterations</div>
                      <div className="ddetail">Seed <span className="mono">{preview.seed}</span> — reproducible from this report row alone.</div>
                    </div>
                    <div className="drow">
                      <div className="dlabel">Reported range</div>
                      <div className="dvalue">
                        {fmt(preview.emissionsKgCo2e.p10 / 1000)} / {fmt(preview.emissionsKgCo2e.median / 1000)} / {fmt(preview.emissionsKgCo2e.p90 / 1000)} t
                      </div>
                      <div className="ddetail">Band is {fmt(preview.emissionsKgCo2e.relativeBandPct)}% of the median.</div>
                    </div>
                  </div>
                </details>

                <div className="form-actions">
                  <button className="btn-link" onClick={handleRun} disabled={running}>
                    {running ? "Running…" : "Re-run with today's default source →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function BenchmarkChart({ value }: { value: number }) {
  const domainLo = 40, domainHi = 250;
  const x = (v: number) => Math.min(100, Math.max(0, ((v - domainLo) / (domainHi - domainLo)) * 100));
  return (
    <div className="chart-wrap" style={{ height: 60 }}>
      <svg viewBox="0 0 900 50" preserveAspectRatio="none" role="img" aria-label="Energy use intensity against the published benchmark">
        <line x1="10" y1="30" x2="890" y2="30" stroke="var(--rule)" strokeWidth="1" />
        <line x1={(x(BENCHMARK.best) / 100) * 880 + 10} y1="20" x2={(x(BENCHMARK.best) / 100) * 880 + 10} y2="40" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="2 2" />
        <line x1={(x(BENCHMARK.median) / 100) * 880 + 10} y1="16" x2={(x(BENCHMARK.median) / 100) * 880 + 10} y2="44" stroke="var(--rule)" strokeWidth="1.5" />
        <line x1={(x(BENCHMARK.worst) / 100) * 880 + 10} y1="20" x2={(x(BENCHMARK.worst) / 100) * 880 + 10} y2="40" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx={(x(value) / 100) * 880 + 10} cy="30" r="6" fill="var(--acid-ink)" />
      </svg>
      <span className="chart-label" style={{ left: `${x(BENCHMARK.best)}%`, top: 0 }}>best &lt;{BENCHMARK.best}</span>
      <span className="chart-label strong" style={{ left: `${x(BENCHMARK.median)}%`, top: 0 }}>median {BENCHMARK.median}</span>
      <span className="chart-label" style={{ left: `${x(BENCHMARK.worst)}%`, top: 0 }}>worst &gt;{BENCHMARK.worst}</span>
      <span className="chart-label strong" style={{ left: `${x(value)}%`, top: 36 }}>this school · {fmt(value, 0)}</span>
    </div>
  );
}
