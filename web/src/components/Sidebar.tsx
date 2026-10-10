import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import "./Shell.css";
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
//
// Mobile (2026-10-10): below 860px the sidebar used to just disappear, on
// every page, with nothing replacing it. It is now an off-canvas drawer
// opened from a slim top bar (.mbar) that carries the brand and a menu
// button — same links, same component, no second nav to keep in sync.
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

// `active` is optional for the app variant so pages that live inside the app
// shell but are not a nav item (Terms, Privacy) can render it with nothing lit.
type Props = { variant?: "app"; active?: NavKey } | { variant: "marketing"; active?: undefined };

export default function Sidebar(props: Props) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const marketing = props.variant === "marketing";

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

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Only Energy and School profile are real, built pages right now; the
  // other seven were indistinguishable from these two in the menu — same
  // dot, same weight — with no way to tell which led somewhere real before
  // clicking. "Soon" makes that visible up front instead of on arrival.
  const item = (key: NavKey, to: string, label: string, built = true) => (
    <Link className={`navitem${!marketing && props.active === key ? " active" : ""}`} to={to}>
      <span className="dot"></span>
      {label}
      {!built && <span className="soon">Soon</span>}
    </Link>
  );
  const anchor = (href: string, label: string) => (
    <a className="navitem" href={href}>
      <span className="dot"></span>
      {label}
    </a>
  );

  const brand = marketing ? (
    <Link className="brand" to="/">
      <span className="mark"></span>
      <span>CarbonTally</span>
    </Link>
  ) : (
    <div className="brand">
      <span className="mark"></span>
      <span>CarbonTally</span>
    </div>
  );

  const themeToggle = (
    <button className="themebtn" id="themebtn" aria-label="Toggle colour theme">
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 8 1.5Z" fill="currentColor" />
      </svg>
    </button>
  );

  const foot = (
    <div className="sidefoot">
      <div className="sidefoot-row">
        {themeToggle}
        {!marketing && (
          <button className="signout" onClick={() => void signOut()}>
            Sign out
          </button>
        )}
      </div>
      <div className="sidelegal">
        <Link to="/terms">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy">Privacy</Link>
      </div>
    </div>
  );

  return (
    <>
      <header className="mbar">
        {brand}
        <button
          className="mbtn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="sidenav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      {/* Following any link inside the drawer closes it. */}
      <aside
        id="sidenav"
        className={`side${open ? " open" : ""}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {brand}
        {marketing ? (
          <>
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
          </>
        ) : (
          <>
            <nav className="navgroup">
              <span className="navlabel">Workspace</span>
              {item("dashboard", "/dashboard", "Dashboard", false)}
              {item("energy", "/energy", "Energy")}
              {item("water", "/water", "Water", false)}
              {item("transportation", "/transportation", "Transportation", false)}
              {item("digital", "/digital", "Digital", false)}
              {item("waste", "/waste", "Waste", false)}
            </nav>
            <nav className="navgroup">
              <span className="navlabel">Compare</span>
              {item("benchmarking", "/benchmarking", "Benchmarking", false)}
              {item("reports", "/reports", "Reports", false)}
            </nav>
            <nav className="navgroup">
              <span className="navlabel">Account</span>
              {item("profile", "/profile", "School profile")}
            </nav>
          </>
        )}
        {foot}
      </aside>
    </>
  );
}
