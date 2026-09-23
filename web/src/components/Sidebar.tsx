import { useEffect } from "react";
import { Link } from "react-router-dom";
import "./Sidebar.css";

// Extracted out of Profile.tsx when Energy became the second page to need it
// — two inline copies would have drifted the moment one of the placeholder
// links below got wired to a real route, which is exactly what happened to
// Energy here. Water/Transportation/Digital/Waste/Dashboard/Benchmarking/
// Reports now point at their own ComingSoon route (pages/ComingSoon) rather
// than "/" — they used to point there honestly because those modules don't
// exist yet, but once "/" got its own sidebar too (below), that meant
// clicking any of them silently swapped a signed-in user's whole menu for
// the public marketing one. ComingSoon keeps the same app shell and the
// same item lit, and just says the module isn't built.
//
// "marketing" variant (2026-09-22): Landing and Login used to carry their
// own, different-shaped nav (a top bar, or nothing at all) — genuinely
// confusing when the signed-in app used a left sidebar instead. Both now
// render this same component with the same shell, just a different set of
// links, so the app never visually changes shape depending on whether
// you're signed in.
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

type Props =
  | { variant?: "app"; active: NavKey }
  | { variant: "marketing"; active?: undefined };

export default function Sidebar(props: Props) {
  // Theme toggle lives here rather than per-page now — every page renders a
  // Sidebar, so this is the one place it needs to be wired up.
  useEffect(() => {
    const btn = document.getElementById("themebtn");
    const onClick = () => {
      let cur = document.documentElement.getAttribute("data-theme");
      if (!cur) {
        cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
    };
    btn?.addEventListener("click", onClick);
    return () => btn?.removeEventListener("click", onClick);
  }, []);

  const item = (key: NavKey, to: string, label: string) => (
    <Link className={`navitem${props.variant !== "marketing" && props.active === key ? " active" : ""}`} to={to}>
      <span className="dot"></span>
      {label}
    </Link>
  );
  const anchor = (href: string, label: string) => (
    <a className="navitem" href={href}>
      <span className="dot"></span>
      {label}
    </a>
  );

  const themeToggle = (
    <button className="themebtn" id="themebtn" aria-label="Toggle colour theme">
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 8 1.5Z" fill="currentColor" />
      </svg>
    </button>
  );

  if (props.variant === "marketing") {
    return (
      <aside className="side">
        <Link className="brand" to="/">
          <span className="mark"></span>
          <span>CarbonTally</span>
        </Link>
        <nav className="navgroup">
          <span className="navlabel">Menu</span>
          {anchor("/#tiers", "Data tiers")}
          {anchor("/#dashboard", "Emissions dashboard")}
          {anchor("/#method", "Methodology")}
          {anchor("/#benchmark", "Why trust it")}
        </nav>
        <div className="sidecta">
          <Link className="btn" to="/login">
            Start a school file
          </Link>
        </div>
        {themeToggle}
      </aside>
    );
  }

  return (
    <aside className="side">
      <div className="brand">
        <span className="mark"></span>
        <span>CarbonTally</span>
      </div>
      <nav className="navgroup">
        <span className="navlabel">Workspace</span>
        {item("dashboard", "/dashboard", "Dashboard")}
        {item("energy", "/energy", "Energy")}
        {item("water", "/water", "Water")}
        {item("transportation", "/transportation", "Transportation")}
        {item("digital", "/digital", "Digital")}
        {item("waste", "/waste", "Waste")}
      </nav>
      <nav className="navgroup">
        <span className="navlabel">Compare</span>
        {item("benchmarking", "/benchmarking", "Benchmarking")}
        {item("reports", "/reports", "Reports")}
      </nav>
      <nav className="navgroup">
        <span className="navlabel">Account</span>
        {item("profile", "/profile", "School profile")}
      </nav>
      {themeToggle}
    </aside>
  );
}
