import { Link } from "react-router-dom";
import "../Profile/Profile.css";
import Sidebar, { type NavKey } from "../../components/Sidebar";

// Dashboard/Water/Transportation/Digital/Waste/Benchmarking/Reports all used
// to point straight at "/" — honest about not existing yet, but it meant
// clicking any of them dropped a signed-in user onto the public marketing
// page, which (once Landing got its own sidebar too) suddenly looked like
// a *different* app: same chrome, completely different menu. That swap is
// what read as "two menus" and "confusing" — not the marketing/app sidebar
// split itself, which is the standard pattern. This keeps the same app
// shell and the same active nav item lit, and just says plainly that the
// module isn't built, matching how the tier tracks on the landing page
// handle the same situation instead of hiding it behind a greyed-out tab.
// Dashboard and Reports are built (read-only views over saved reports), so they
// no longer appear here.
type Unbuilt = Exclude<NavKey, "energy" | "profile" | "dashboard" | "reports" | "water" | "waste" | "transportation">;

const GROUP: Record<Unbuilt, string> = {
  digital: "Workspace",
  benchmarking: "Compare",
};

const LABEL: Record<Unbuilt, string> = {
  digital: "Digital",
  benchmarking: "Benchmarking",
};

export default function ComingSoon({ nav }: { nav: Unbuilt }) {
  return (
    <div className="shell">
      <Sidebar active={nav} />
      <main className="main">
        <div className="pagehead">
          <div>
            <div className="eyebrow">{GROUP[nav]}</div>
            <h1>{LABEL[nav]}</h1>
          </div>
        </div>
        <div className="section" style={{ maxWidth: "52ch" }}>
          <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, fontSize: "0.92rem", margin: "0 0 1.2rem" }}>
            Not built yet — {LABEL[nav]} is designed but not shipped. Energy, Water, Waste and Transportation are
            live: register what you measure, add readings, and get a real sourced number back.
          </p>
          <Link className="btn btn-primary" to="/energy">
            Go to Energy →
          </Link>
        </div>
      </main>
    </div>
  );
}
