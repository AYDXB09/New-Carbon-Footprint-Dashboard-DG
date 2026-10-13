import { categoryFor, type CategoryKey } from "../lib/reportView";
import "./CategoryIcon.css";

// The same five glyphs the landing page's tier cards use, so a category looks
// the same before and after you sign in.
const GLYPH: Record<CategoryKey, React.ReactNode> = {
  energy: <path d="M13 2 3 14h6l-1 8 10-12h-6l1-8Z" />,
  water: <path d="M12 2C12 2 5 12 5 16.5A7 7 0 0 0 19 16.5C19 12 12 2 12 2Z" />,
  transportation: (
    <>
      <rect x="3" y="6" width="18" height="11" rx="2" />
      <path d="M6 9h3M10.5 9h3M15 9h3M7 20l-1-3M17 20l1-3" stroke="var(--catico-bg)" strokeWidth="1.4" />
      <circle cx="7.5" cy="19" r="1.6" fill="var(--catico-bg)" />
      <circle cx="16.5" cy="19" r="1.6" fill="var(--catico-bg)" />
    </>
  ),
  digital: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 19h6M12 16v3" stroke="var(--catico-bg)" strokeWidth="1.4" />
    </>
  ),
  waste: (
    <>
      <path
        d="M6 6h12M9 6l.6-2h4.8l.6 2M7 6l1 14a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 16 20l1-14"
        stroke="var(--catico-fg)"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M10 10v7M14 10v7" stroke="var(--catico-fg)" strokeWidth="1.4" />
    </>
  ),
};

export default function CategoryIcon({
  category,
  size = 40,
  muted = false,
}: {
  category: string;
  size?: number;
  /** Greyed-out tile for a category the school hasn't started. */
  muted?: boolean;
}) {
  const cat = categoryFor(category);
  return (
    <span
      className={`catico${muted ? " muted" : ""}`}
      style={{
        ["--catico-bg" as string]: muted ? "var(--surface-2)" : cat.colour,
        ["--catico-fg" as string]: muted ? "var(--ink-faint)" : "#fff",
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">{GLYPH[cat.key]}</svg>
    </span>
  );
}
