import { Link } from "react-router-dom";
import "./Sidebar.css";

// Extracted out of Profile.tsx when Energy became the second page to need it
// — two inline copies would have drifted the moment one of the placeholder
// "/" links below got wired to a real route, which is exactly what happened
// to Energy here. Water/Transportation/Digital/Waste/Dashboard/Benchmarking/
// Reports stay pointed at "/" honestly: those pages don't exist yet.
export type NavKey =
  | "dashboard"
  | "energy"
  | "water"
  | "transportation"
  | "digital"
  | "waste"
  | "benchmarking"
  | "reports"
  | "profile";

export default function Sidebar({ active }: { active: NavKey }) {
  const item = (key: NavKey, to: string, label: string) => (
    <Link className={`navitem${active === key ? " active" : ""}`} to={to}>
      <span className="dot"></span>
      {label}
    </Link>
  );

  return (
    <aside className="side">
      <div className="brand">
        <span className="mark"></span>
        <span>CarbonTally</span>
      </div>
      <nav className="navgroup">
        <span className="navlabel">Workspace</span>
        {item("dashboard", "/", "Dashboard")}
        {item("energy", "/energy", "Energy")}
        {item("water", "/", "Water")}
        {item("transportation", "/", "Transportation")}
        {item("digital", "/", "Digital")}
        {item("waste", "/", "Waste")}
      </nav>
      <nav className="navgroup">
        <span className="navlabel">Compare</span>
        {item("benchmarking", "/", "Benchmarking")}
        {item("reports", "/", "Reports")}
      </nav>
      <nav className="navgroup">
        <span className="navlabel">Account</span>
        {item("profile", "/profile", "School profile")}
      </nav>
    </aside>
  );
}
