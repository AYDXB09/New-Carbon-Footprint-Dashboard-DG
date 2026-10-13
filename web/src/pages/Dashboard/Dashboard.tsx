import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../Profile/Profile.css";
import "./Dashboard.css";
import Sidebar from "../../components/Sidebar";
import CategoryIcon from "../../components/CategoryIcon";
import { getOrCreateMySchool, type SchoolRow } from "../../lib/school";
import { listReports } from "../../lib/reports";
import type { EnergyReportRow } from "../../lib/energy";
import { formatError } from "../../lib/formatError";
import {
  CATEGORIES,
  activityQuantity,
  categoryFor,
  coverageLabel,
  fmt,
  fmtDate,
  fmtPeriod,
  fmtStepValue,
  halfBandPct,
  headline,
  intensities,
  latestPerModule,
  newestFirst,
  nextSteps,
  tierLabel,
} from "../../lib/reportView";

/**
 * The p10–p90 range drawn on a 0-based track, median ticked. The track runs
 * to 25% past p90 so the right edge of the range is never pinned to the end
 * of the bar. Geometry only; every number is HTML text beside it so nothing
 * shrinks on a phone (same rule as the Energy charts).
 */
function RangeBar({ p10, median, p90 }: { p10: number; median: number; p90: number }) {
  const hi = p90 * 1.25 || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / hi) * 100))}%`;
  return (
    <div className="dash-range" role="img" aria-label={`Range ${fmt(p10)} to ${fmt(p90)} tonnes, median ${fmt(median)}`}>
      <div className="dash-range-track">
        <div className="dash-range-fill" style={{ left: pct(p10), width: `calc(${pct(p90)} - ${pct(p10)})` }} />
        <div className="dash-range-tick" style={{ left: pct(median) }} />
      </div>
      <div className="dash-range-scale">
        <span>0</span>
        <span>{fmt(hi, 0)} t</span>
      </div>
    </div>
  );
}

export function DashboardView({ school, reports }: { school: SchoolRow; reports: EnergyReportRow[] }) {
  const latest = latestPerModule(reports);
  // Headline: Energy when there is one, otherwise whichever report is newest. Categories are
  // never added together here — ranges can't be summed, and a joint simulation doesn't exist yet.
  const featured = latest.get("energy") ?? newestFirst(reports)[0] ?? null;
  const h = featured ? headline(featured) : null;
  const inten = featured ? intensities(featured) : null;
  const qty = featured ? activityQuantity(featured) : null;
  const steps = nextSteps(school, [...latest.values()]);
  const recent = newestFirst(reports).slice(0, 3);

  return (
    <>
      {featured && h ? (
        <section className="dash-hero" style={{ ["--cat" as string]: categoryFor(featured.module).colour }}>
          <div className="dash-hero-top">
            <CategoryIcon category={featured.module} size={48} />
            <div className="dash-hero-title">
              <div className="dash-kicker">
                {school.name || "Your school"} · {categoryFor(featured.module).label}
              </div>
              <div className="dash-big">
                <b>{fmt(h.median)}</b>
                <span>tCO₂e</span>
              </div>
            </div>
            <div className="dash-chips">
              <span className={`dash-chip ${featured.coverage === "full_year" ? "good" : "warn"}`}>
                {coverageLabel(featured.coverage)}
              </span>
              <span className="dash-chip data">{tierLabel(featured.tier)}</span>
            </div>
          </div>

          <p className="dash-sub">
            Likely between <b>{fmt(h.p10)}</b> and <b>{fmt(h.p90)}</b> tonnes (±{fmt(halfBandPct(h), 1)}%) for{" "}
            {fmtPeriod(featured)}. The width of the range is how well the inputs are known.
          </p>

          <RangeBar p10={h.p10} median={h.median} p90={h.p90} />

          {featured.coverage !== "full_year" && (
            <p className="dash-warn">
              This covers part of a year and has not been scaled up, so don’t compare it with a full-year figure.
            </p>
          )}

          <div className="dash-stats">
            <div>
              <b>{inten?.kgPerM2 != null ? fmt(inten.kgPerM2) : "—"}</b>
              <span>kgCO₂e per m²</span>
            </div>
            <div>
              <b>{inten?.kgPerStudent != null ? fmt(inten.kgPerStudent, 0) : "—"}</b>
              <span>kgCO₂e per student</span>
            </div>
            <div>
              {inten?.kwhPerM2 != null ? (
                <>
                  <b>{fmt(inten.kwhPerM2, 0)}</b>
                  <span>kWh per m²</span>
                </>
              ) : (
                <>
                  <b>{qty ? fmtStepValue(qty.value) : "—"}</b>
                  <span>{qty ? `${qty.label.toLowerCase()} (${qty.unit.replace("CO2e", "CO₂e")})` : "quantity"}</span>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="dash-hero dash-empty">
          <CategoryIcon category="energy" size={48} />
          <div>
            <h2>No numbers yet</h2>
            <p>Log one meter reading on Energy and your first figure, with its range, lands here.</p>
            <Link className="btn btn-primary" to="/energy">
              Log an energy reading →
            </Link>
          </div>
        </section>
      )}

      <div className="section-title">
        <h2>Categories</h2>
        <span className="n">{latest.size} of {CATEGORIES.length} reporting</span>
      </div>
      <div className="dash-cats">
        {CATEGORIES.map((c) => {
          const r = latest.get(c.key);
          const rh = r ? headline(r) : null;
          const body = (
            <>
              <CategoryIcon category={c.key} size={40} muted={!r} />
              <div className="dash-cat-text">
                <div className="dash-cat-name">{c.label}</div>
                {r && rh ? (
                  <div className="dash-cat-val">
                    <b>{fmt(rh.median)}</b> t <i>±{fmt(halfBandPct(rh), 0)}%</i>
                  </div>
                ) : (
                  <div className="dash-cat-val none">{c.built ? "Not started" : "Not built yet"}</div>
                )}
              </div>
              {!c.built && <span className="dash-soon">Soon</span>}
            </>
          );
          return (
            <Link key={c.key} to={`/${c.key}`} className={`dash-cat${r ? "" : " idle"}`} style={{ ["--cat" as string]: c.colour, ["--cat-t" as string]: c.tint }}>
              {body}
            </Link>
          );
        })}
      </div>

      <div className="dash-two">
        <div className="dash-card">
          <h3>Next steps</h3>
          {steps.length === 0 ? (
            <p className="dash-muted">Nothing outstanding for what is built so far.</p>
          ) : (
            <ul className="dash-steps">
              {steps.map((s) => (
                <li key={s.text}>
                  <Link to={s.to}>
                    <span>{s.text}</span>
                    <i aria-hidden="true">→</i>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-card dash-lock">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <div>
            <h3>Peer standing — locked</h3>
            <p className="dash-muted">
              Needs a real cohort of comparable schools. You’ll see a bar here once one exists, not before.
            </p>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div className="section-title">
            <h2>Recent reports</h2>
            <Link className="dash-all" to="/reports">
              All reports →
            </Link>
          </div>
          <ul className="dash-recent">
            {recent.map((r) => {
              const rh = headline(r);
              return (
                <li key={r.id}>
                  <CategoryIcon category={r.module} size={28} />
                  <span className="dash-recent-main">
                    <b>{rh ? `${fmt(rh.median)} tCO₂e` : "—"}</b>
                    <span>{fmtPeriod(r)}</span>
                  </span>
                  <span className="dash-recent-date">{fmtDate(r.generated_at)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

export default function Dashboard() {
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [reports, setReports] = useState<EnergyReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getOrCreateMySchool();
        const r = await listReports(s.id);
        if (cancelled) return;
        setSchool(s);
        setReports(r);
      } catch (e) {
        if (!cancelled) setError(formatError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell">
      <Sidebar active="dashboard" />
      <main className="main dash-main">
        <div className="pagehead">
          <div>
            <div className="eyebrow">Workspace</div>
            <h1>Dashboard</h1>
          </div>
        </div>
        {loading && <p className="dash-muted">Loading…</p>}
        {error && (
          <p className="dash-error" role="alert">
            Couldn’t load your dashboard: {error}
          </p>
        )}
        {school && !error && <DashboardView school={school} reports={reports} />}
      </main>
    </div>
  );
}
