import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../Profile/Profile.css";
import "../Energy/Energy.css";
import "./Module.css";
import Sidebar from "../../components/Sidebar";
import MetersCard from "../../components/readings/MetersCard";
import BillUploadPanel from "../../components/readings/BillUploadPanel";
import ReadingsCard from "../../components/readings/ReadingsCard";
import { runActivitySimulation, DEFAULT_ACTIVITY_ITERATIONS } from "../../lib/engine/activity";
import { analyseCoverageByMeter } from "../../lib/engine/coverage";
import type { Factor } from "../../lib/engine/types";
import {
  createReport,
  getLatestReport,
  listMeters,
  markModuleEnabled,
  type EnergyReportRow,
  type Meter,
  type MeterReading,
} from "../../lib/energy";
import { engineFactorFor, resolveFactor, type ResolvedFactor } from "../../lib/factors";
import { formatError } from "../../lib/formatError";
import { MODULE_CONFIG, kindLabel } from "../../lib/modules";
import { listAllReadings } from "../../lib/readings";
import {
  coverageLabel,
  fmt,
  fmtPeriod,
  halfBandPct,
  headline,
  intensities,
  readDerivation,
  tierLabel,
} from "../../lib/reportView";
import { getOrCreateMySchool, type SchoolRow } from "../../lib/school";
import { MODULE_UNITS } from "../../lib/units";

type ModuleKey = "water" | "waste" | "transportation";

/**
 * The page behind Water, Waste and Transportation: register what you measure,
 * add readings (typed, CSV, or a bill), run the calculation, get a sourced
 * range. Everything module-specific lives in lib/modules.ts.
 */
export default function ModulePage({ module }: { module: ModuleKey }) {
  const config = MODULE_CONFIG[module];
  const units = MODULE_UNITS[module];

  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [report, setReport] = useState<EnergyReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // Set when the school's country has no factor of its own and we need an explicit yes.
  const [pendingStandIn, setPendingStandIn] = useState<Record<string, ResolvedFactor> | null>(null);

  async function loadAll(s: SchoolRow) {
    const [m, r] = await Promise.all([listMeters(s.id, module), listAllReadings(s.id, module)]);
    setMeters(m);
    setReadings(r);
    return r;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getOrCreateMySchool();
        if (cancelled) return;
        setSchool(s);
        const loaded = await loadAll(s);
        if (loaded.length > 0) {
          const latest = await getLatestReport(s.id, module);
          if (!cancelled) setReport(latest);
        }
      } catch (e) {
        if (!cancelled) setLoadError(formatError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  async function onChanged() {
    if (!school) return;
    try {
      await loadAll(school);
      // The saved result described the old readings; don't keep presenting it as current.
      setReport(null);
      setPendingStandIn(null);
    } catch (e) {
      setLoadError(formatError(e));
    }
  }

  const coverage = useMemo(() => {
    if (readings.length === 0) return null;
    return analyseCoverageByMeter(
      readings.map((r) => ({ start: r.period_start, end: r.period_end, meterId: r.meter_id })),
    ).overall;
  }, [readings]);

  async function run(confirmed = false, resolvedIn?: Record<string, ResolvedFactor>) {
    if (!school) return;
    setRunError(null);
    setRunning(true);
    try {
      const withMeter = readings.map((r) => ({ r, meter: meters.find((m) => m.id === r.meter_id) }));
      const untyped = [...new Set(withMeter.filter((x) => !x.meter?.factor_key).map((x) => x.meter?.location ?? "an unknown meter"))];
      if (untyped.length > 0) {
        setRunError(`Choose a type for ${untyped.join(", ")} in step 1, so the right emission factor is used.`);
        return;
      }
      const keys = [...new Set(withMeter.map((x) => x.meter!.factor_key!))].sort();

      const resolved: Record<string, ResolvedFactor> = resolvedIn ?? {};
      if (!resolvedIn) {
        for (const k of keys) {
          const rf = await resolveFactor(module, k, school.country_code);
          if (!rf) {
            setRunError(`No emission factor is available yet for “${kindLabel(module, k) ?? k}”.`);
            return;
          }
          resolved[k] = rf;
        }
      }
      if (keys.some((k) => resolved[k].standIn) && !confirmed) {
        setPendingStandIn(resolved);
        return;
      }

      const factors: Record<string, Factor> = {};
      const factorLabels: Record<string, string> = {};
      for (const k of keys) {
        factors[k] = engineFactorFor(resolved[k]);
        factorLabels[k] = kindLabel(module, k) ?? k;
      }

      const seed = Math.floor(Math.random() * 2 ** 31);
      const result = runActivitySimulation(
        {
          readings: withMeter.map(({ r, meter }) => ({
            quantity: r.quantity,
            periodStart: r.period_start,
            periodEnd: r.period_end,
            meterId: r.meter_id,
            factorKeys: [meter!.factor_key!],
          })),
          factors,
          quantityUnit: units.canonical,
          quantityLabel: config.quantityLabel,
          factorLabels,
        },
        { seed, iterations: DEFAULT_ACTIVITY_ITERATIONS },
      );

      const starts = readings.map((r) => r.period_start).sort();
      const ends = readings.map((r) => r.period_end).sort();
      const saved = await createReport({
        schoolId: school.id,
        module,
        periodStart: starts[0],
        periodEnd: ends[ends.length - 1],
        coverage: result.coverage.coverageClass,
        tier: "tier_2_actual",
        resultP10: result.emissionsKgCo2e.p10 / 1000,
        resultMedian: result.emissionsKgCo2e.median / 1000,
        resultP90: result.emissionsKgCo2e.p90 / 1000,
        seed,
        iterations: result.iterations,
        factorSetVersion: keys.map((k) => resolved[k].row.id).join(","),
        derivation: {
          steps: result.derivation,
          factors: keys.map((k) => ({
            key: k,
            id: resolved[k].row.id,
            scope: resolved[k].row.scope,
            source_org: resolved[k].row.source_org,
            source_name: resolved[k].row.source_name,
            vintage_year: resolved[k].row.vintage_year,
            value: resolved[k].row.value,
            unit: resolved[k].row.unit,
            // What was actually applied; wider than the published figure for a stand-in.
            uncertainty_pct: factors[k].uncertaintyPct,
            published_uncertainty_pct: resolved[k].row.uncertainty_pct,
            stand_in: resolved[k].standIn,
          })),
        },
        denominators: {
          gfaTotalM2: school.gfa_total_m2,
          gfaConditionedM2: school.gfa_conditioned_m2,
          studentsTotal: school.students_total,
          studentsBoarding: school.students_boarding,
          staffHeadcount: school.staff_headcount,
        },
      });
      await markModuleEnabled(school.id, module, "tier_2_actual");
      setPendingStandIn(null);
      setReport(saved);
    } catch (e) {
      setRunError(formatError(e));
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <Sidebar active={module} />
        <main className="main">
          <p className="rd-muted">Loading…</p>
        </main>
      </div>
    );
  }
  if (!school) {
    return (
      <div className="shell">
        <Sidebar active={module} />
        <main className="main">
          <p className="error-text">{loadError ?? "Could not load a school profile."}</p>
        </main>
      </div>
    );
  }

  const h = report ? headline(report) : null;
  const inten = report ? intensities(report) : null;
  const factorsUsed = report ? readDerivation(report).factors : [];
  const usedStandIn = factorsUsed.some((f) => f.standIn);

  return (
    <div className="shell">
      <Sidebar active={module} />
      <main className="main energy-main">
        <div className="topbar-inline">
          <div>
            <p className="eyebrow mono">
              /{module} — {config.nounPlural}, readings, one sourced number
            </p>
            <h1>{config.label}</h1>
          </div>
          <div className="chips">
            <span className={`chip ${coverage?.coverageClass === "full_year" ? "good" : "warn"}`}>
              <span className="dot"></span>
              {coverage ? coverageLabel(coverage.coverageClass) : "No data yet"}
            </span>
            <span className="chip data" title="Tier 2 = based on real submitted data, not an estimate">
              <span className="dot"></span>Tier 2 · Actual
            </span>
          </div>
        </div>

        <p className="mod-blurb">{config.blurb}</p>
        {config.caveat && <p className="mod-caveat">{config.caveat}</p>}
        {loadError && <p className="error-text">{loadError}</p>}

        <section className="entry">
          <div className="entry-index">
            <p className="entry-num">01</p>
            <h2 className="entry-title">Your {config.nounPlural}</h2>
            <p className="entry-desc">Set up once. Every reading attaches to one.</p>
          </div>
          <MetersCard schoolId={school.id} config={config} meters={meters} readings={readings} onChanged={onChanged} />
        </section>

        <section className="entry">
          <div className="entry-index">
            <p className="entry-num">02</p>
            <h2 className="entry-title">Add readings</h2>
            <p className="entry-desc">A full year is used as-is. Anything shorter is flagged, not hidden.</p>
          </div>
          <ReadingsCard
            school={school}
            config={config}
            meters={meters}
            readings={readings}
            onChanged={onChanged}
            billPanel={
              config.billUpload ? (
                <BillUploadPanel schoolId={school.id} config={config} meters={meters} readings={readings} onSaved={onChanged} />
              ) : undefined
            }
          />
        </section>

        <section className="entry">
          <div className="entry-index">
            <p className="entry-num">03</p>
            <h2 className="entry-title">See the result</h2>
            <p className="entry-desc">The width of the range is how well the inputs are known.</p>
          </div>
          <div className={`card${readings.length === 0 ? " locked" : ""}`}>
            {readings.length === 0 && <span className="lock-pill">🔒 Add a reading first</span>}

            {pendingStandIn && (
              <div className="mod-standin" role="alert">
                <b>No emission factor is published for {school.country_code ?? "your country"} yet.</b>
                <p>
                  We can use the UK Government’s figure
                  {Object.values(pendingStandIn)
                    .filter((r) => r.standIn)
                    .map((r) => ` ${r.row.value} ${r.row.unit.replace("CO2e", "CO₂e")} (${r.row.vintage_year} data)`)
                    .join(" and")}{" "}
                  as a stand-in. It can be about right for the UK and several times off elsewhere, so the range is widened to
                  ±100% instead of the usual ±25–30%. Treat the result as a rough order of magnitude.
                </p>
                <div className="form-actions" style={{ marginTop: 10 }}>
                  <button className="btn btn-primary" onClick={() => void run(true, pendingStandIn)} disabled={running}>
                    {running ? "Running…" : "Use it as a stand-in →"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setPendingStandIn(null)} disabled={running}>
                    Not now
                  </button>
                </div>
              </div>
            )}

            {!report && readings.length > 0 && !pendingStandIn && (
              <div className="form-actions" style={{ marginTop: 0 }}>
                <button className="btn btn-primary" onClick={() => void run()} disabled={running}>
                  {running ? "Running…" : "Run calculation →"}
                </button>
              </div>
            )}
            {runError && <p className="error-text">{runError}</p>}

            {report && h && (
              <>
                <div className="result-head">
                  <span className="result-median mono">{fmt(h.median)}</span>
                  <span className="result-unit">tCO₂e — our best single estimate</span>
                </div>
                <p className="result-sub">
                  Likely between <b>{fmt(h.p10)}</b> and <b>{fmt(h.p90)}</b> tonnes (±{fmt(halfBandPct(h), 1)}%) for{" "}
                  {fmtPeriod(report)}. <span className="rd-muted">{coverageLabel(report.coverage)} · {tierLabel(report.tier)}</span>
                </p>
                {report.coverage !== "full_year" && (
                  <p className="rd-warn">
                    This covers part of a year and has not been scaled up, so don’t compare it with a full-year figure.
                  </p>
                )}
                {usedStandIn && (
                  <p className="rd-warn">
                    Uses a UK figure as a stand-in for {school.country_code ?? "your country"}, with the range widened
                    to match. Replace it when a local factor is published.
                  </p>
                )}
                {inten?.kgPerStudent != null && (
                  <div className="intensity-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                    <div className="intensity-item">
                      <div className="n mono">{fmt(inten.kgPerStudent, 0)}</div>
                      <div className="l">kgCO₂e per student</div>
                    </div>
                    <div className="intensity-item">
                      <div className="n mono">{factorsUsed.length}</div>
                      <div className="l">emission factor{factorsUsed.length === 1 ? "" : "s"} used</div>
                    </div>
                  </div>
                )}
                <p className="mod-links">
                  <Link to="/reports">See the full working in Reports →</Link>
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
