import { useMemo, useRef, useState } from "react";
import "./GradeRangePicker.css";

// Two independent, correctly-ordered label lists — NOT forced into shared
// index positions. An earlier version tried to align them (claiming things
// like "Gr. 12 = Year 13") and got it wrong more than once; grade-naming
// equivalence across curricula is genuinely inconsistent and not something
// to assert with false confidence. The school picks which system its own
// curriculum uses; each list stands on its own, correct length included.
const US_LEVELS = [
  "KG1", "KG2", "Gr. 1", "Gr. 2", "Gr. 3", "Gr. 4", "Gr. 5", "Gr. 6",
  "Gr. 7", "Gr. 8", "Gr. 9", "Gr. 10", "Gr. 11", "Gr. 12",
];
const UK_LEVELS = [
  "FS1", "FS2", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13",
];

// Abbreviated forms for the tick labels under the slider — full names
// ("Gr. 12") appear in the readout and drag tooltip, where there's room.
const US_SHORT = ["K1", "K2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const UK_SHORT = ["F1", "F2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

type System = "us" | "uk";

type GradeRangePickerProps = {
  lowId: string | null;
  highId: string | null;
  onChange: (lowId: string | null, highId: string | null) => void;
};

function levelsFor(system: System) {
  return system === "us" ? US_LEVELS : UK_LEVELS;
}
function shortLabelsFor(system: System) {
  return system === "us" ? US_SHORT : UK_SHORT;
}

export default function GradeRangePicker({ lowId, highId, onChange }: GradeRangePickerProps) {
  const initialSystem: System =
    UK_LEVELS.includes(lowId ?? "") || UK_LEVELS.includes(highId ?? "") ? "uk" : "us";
  const [system, setSystem] = useState<System>(initialSystem);
  const levels = levelsFor(system);
  const shortLabels = shortLabelsFor(system);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragHandle, setDragHandle] = useState<"low" | "high" | null>(null);

  const { low, high } = useMemo(() => {
    const lo = levels.indexOf(lowId ?? "");
    const hi = levels.indexOf(highId ?? "");
    if (lo === -1 || hi === -1) return { low: 0, high: levels.length - 1 };
    return { low: Math.min(lo, hi), high: Math.max(lo, hi) };
  }, [levels, lowId, highId]);

  const hasSelection = levels.indexOf(lowId ?? "") !== -1 && levels.indexOf(highId ?? "") !== -1;

  function pct(index: number) {
    return (index / (levels.length - 1)) * 100;
  }

  function indexFromClientX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (levels.length - 1));
  }

  function beginDrag(handle: "low" | "high") {
    setDragHandle(handle);
    function onMove(e: PointerEvent) {
      const idx = indexFromClientX(e.clientX);
      if (handle === "low") {
        onChange(levels[Math.min(idx, high)], levels[high]);
      } else {
        onChange(levels[low], levels[Math.max(idx, low)]);
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragHandle(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function switchSystem(next: System) {
    setSystem(next);
    // Switching systems can't carry over a meaningful selection — clear it
    // rather than silently reinterpreting old indices under a new list.
    onChange(null, null);
  }

  return (
    <div className="grp">
      <div className="grp-toggle" role="radiogroup" aria-label="Grade naming system">
        <button
          type="button"
          className={system === "us" ? "on" : ""}
          role="radio"
          aria-checked={system === "us"}
          onClick={() => switchSystem("us")}
        >
          Grades
        </button>
        <button
          type="button"
          className={system === "uk" ? "on" : ""}
          role="radio"
          aria-checked={system === "uk"}
          onClick={() => switchSystem("uk")}
        >
          Years
        </button>
      </div>

      <div className="grp-readout-row">
        <span className="grp-readout mono">
          {hasSelection ? `${levels[low]} — ${levels[high]}` : "No grades selected"}
        </span>
        <button
          type="button"
          className="grp-wholeschool"
          onClick={() => onChange(levels[0], levels[levels.length - 1])}
        >
          Whole school ({levels[0]}–{levels[levels.length - 1]})
        </button>
      </div>

      <div className="grp-slider" ref={trackRef}>
        <div className="grp-track" />
        <div className="grp-fill" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />

        {levels.map((_, i) => (
          <div key={i} className="grp-tick" style={{ left: `${pct(i)}%` }} />
        ))}

        <div
          className={`grp-handle${dragHandle === "low" ? " active" : ""}`}
          style={{ left: `${pct(low)}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            beginDrag("low");
          }}
          role="slider"
          aria-label="First grade offered"
          aria-valuemin={0}
          aria-valuemax={levels.length - 1}
          aria-valuenow={low}
          aria-valuetext={levels[low]}
          tabIndex={0}
        >
          {dragHandle === "low" && <span className="grp-tooltip mono">{levels[low]}</span>}
        </div>
        <div
          className={`grp-handle${dragHandle === "high" ? " active" : ""}`}
          style={{ left: `${pct(high)}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            beginDrag("high");
          }}
          role="slider"
          aria-label="Last grade offered"
          aria-valuemin={0}
          aria-valuemax={levels.length - 1}
          aria-valuenow={high}
          aria-valuetext={levels[high]}
          tabIndex={0}
        >
          {dragHandle === "high" && <span className="grp-tooltip mono">{levels[high]}</span>}
        </div>
      </div>

      <div className="grp-tick-labels">
        {shortLabels.map((label, i) => {
          const inRange = i >= low && i <= high;
          return (
            <span
              key={i}
              className={`mono${inRange ? " on" : ""}`}
              style={{ left: `${pct(i)}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
