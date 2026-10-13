import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../Profile/Profile.css";
import "./Reports.css";
import Sidebar from "../../components/Sidebar";
import CategoryIcon from "../../components/CategoryIcon";
import { getOrCreateMySchool } from "../../lib/school";
import { listReports } from "../../lib/reports";
import type { EnergyReportRow } from "../../lib/energy";
import { formatError } from "../../lib/formatError";
import { kindLabel } from "../../lib/modules";
import type { QuantityModule } from "../../lib/units";
import {
  categoryFor,
  activityQuantity,
  coverageLabel,
  fmt,
  fmtDate,
  fmtPeriod,
  fmtStepValue,
  halfBandPct,
  headline,
  intensities,
  newestFirst,
  readDerivation,
  tierLabel,
} from "../../lib/reportView";

const SCOPE_LABEL: Record<string, string> = {
  grid: "utility grid",
  country: "country",
  region: "region",
  global: "global average",
};

const pretty = (unit: string) => unit.replace(/CO2e/g, "CO₂e");

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rep-fact">
      <span className="rep-fact-l">{label}</span>
      <span className="rep-fact-v">{value}</span>
      {sub && <span className="rep-fact-s">{sub}</span>}
    </div>
  );
}

function ReportCard({ r, isLatest }: { r: EnergyReportRow; isLatest: boolean }) {
  const cat = categoryFor(r.module);
  const h = headline(r);
  const inten = intensities(r);
  const { steps, factors } = readDerivation(r);
  const qty = activityQuantity(r);
  const stepUnit = steps.find((s) => s.label.endsWith("applied"))?.unit ?? "kgCO2e/kWh";

  return (
    <details className="rep-card" style={{ ["--cat" as string]: cat.colour }}>
      <summary>
        <CategoryIcon category={r.module} size={38} />
        <span className="rep-main">
          <span className="rep-title">
            {cat.label} · {fmtPeriod(r)}
            {isLatest && <i className="rep-latest">Latest</i>}
          </span>
          <span className="rep-meta">
            {coverageLabel(r.coverage)} · {tierLabel(r.tier)} · run {fmtDate(r.generated_at)}
          </span>
        </span>
        <span className="rep-head">
          {h ? (
            <>
              <b>{fmt(h.median)}</b> <span>tCO₂e</span>
              <small>
                {fmt(h.p10)}–{fmt(h.p90)}
              </small>
            </>
          ) : (
            <span>No result</span>
          )}
        </span>
        <span className="rep-chev" aria-hidden="true">
          ›
        </span>
      </summary>

      <div className="rep-body">
        {r.coverage !== "full_year" && (
          <p className="rep-warn">
            Covers part of a year. The figures are for this period only and have not been scaled up to twelve months.
          </p>
        )}

        <div className="rep-facts">
          {h && (
            <Fact
              label="Result (p10 · median · p90)"
              value={`${fmt(h.p10)} · ${fmt(h.median)} · ${fmt(h.p90)} t`}
              sub={`±${fmt(halfBandPct(h), 1)}% around the median`}
            />
          )}
          <Fact
            label={qty?.label ?? "Quantity"}
            value={qty ? `${fmtStepValue(qty.value)} ${pretty(qty.unit)}` : "—"}
            sub={inten.kwhPerM2 != null ? `${fmt(inten.kwhPerM2, 0)} kWh per m²` : undefined}
          />
          <Fact
            label="Intensity"
            value={inten.kgPerM2 != null ? `${fmt(inten.kgPerM2)} kgCO₂e/m²` : "—"}
            sub={inten.kgPerStudent != null ? `${fmt(inten.kgPerStudent, 0)} kgCO₂e per student` : "Needs floor area and students"}
          />
          {(factors.length > 0 ? factors : [null]).map((factor, i) => (
            <Fact
              key={factor?.id ?? i}
              label={
                factor?.key
                  ? `Emission factor · ${kindLabel(r.module as QuantityModule, factor.key) ?? factor.key}`
                  : "Emission factor"
              }
              value={factor?.value != null ? `${factor.value} ${pretty(factor.unit ?? stepUnit)}` : "—"}
              sub={
                factor
                  ? `${[factor.sourceOrg, factor.vintageYear].filter(Boolean).join(" ")} · ${SCOPE_LABEL[factor.scope ?? ""] ?? factor.scope ?? "unknown scope"}${
                      factor.uncertaintyPct ? ` · ±${factor.uncertaintyPct}%` : ""
                    }${factor.standIn ? " · stand-in, not local" : ""}`
                  : undefined
              }
            />
          ))}
          <Fact
            label="School size when run"
            value={r.denom_gfa_conditioned_m2 != null ? `${fmt(r.denom_gfa_conditioned_m2, 0)} m² conditioned` : "Floor area not set"}
            sub={
              [
                r.denom_students_total != null ? `${fmt(r.denom_students_total, 0)} students` : null,
                r.denom_staff_headcount != null ? `${fmt(r.denom_staff_headcount, 0)} staff` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Students not set"
            }
          />
          <Fact
            label="Reproduce it"
            value={r.simulation_seed != null ? `seed ${r.simulation_seed}` : "—"}
            sub={`${r.simulation_runs.toLocaleString("en-GB")} runs · same seed gives the same numbers`}
          />
        </div>

        {steps.length > 0 && (
          <>
            <h4 className="rep-h4">How it was worked out</h4>
            <ol className="rep-steps">
              {steps.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <div className="rep-step-top">
                    <span className="rep-step-l">{s.label}</span>
                    {s.value != null && (
                      <span className="rep-step-v">
                        {fmtStepValue(s.value)} {s.unit ? pretty(s.unit) : ""}
                      </span>
                    )}
                  </div>
                  {s.detail && <div className="rep-step-d">{s.detail}</div>}
                  {s.source && <div className="rep-step-s">{s.source}</div>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </details>
  );
}

export function ReportsView({ reports }: { reports: EnergyReportRow[] }) {
  const sorted = newestFirst(reports);
  if (sorted.length === 0) {
    return (
      <div className="rep-empty">
        <CategoryIcon category="energy" size={48} />
        <div>
          <h2>No reports yet</h2>
          <p>A report is saved each time you run a calculation on Energy. It will be listed here.</p>
          <Link className="btn btn-primary" to="/energy">
            Go to Energy →
          </Link>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="rep-intro">
        Every report is a frozen snapshot. It keeps the random seed, the emission factor and the school’s size at the
        time, so it can be re-run exactly and still be compared fairly after the profile changes.
      </p>
      <div className="rep-list">
        {sorted.map((r, i) => (
          <ReportCard key={r.id} r={r} isLatest={i === 0} />
        ))}
      </div>
    </>
  );
}

export default function Reports() {
  const [reports, setReports] = useState<EnergyReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getOrCreateMySchool();
        const r = await listReports(s.id);
        if (!cancelled) setReports(r);
      } catch (e) {
        if (!cancelled) setError(formatError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell">
      <Sidebar active="reports" />
      <main className="main rep-main">
        <div className="pagehead">
          <div>
            <div className="eyebrow">Compare</div>
            <h1>Reports</h1>
          </div>
        </div>
        {error && (
          <p className="rep-error" role="alert">
            Couldn’t load your reports: {error}
          </p>
        )}
        {!error && reports === null && <p className="rep-intro">Loading…</p>}
        {reports && !error && <ReportsView reports={reports} />}
      </main>
    </div>
  );
}
