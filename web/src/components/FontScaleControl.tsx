import { FONT_SCALE_STEPS, useFontScale } from "../lib/fontScale";
import "./FontScaleControl.css";

/**
 * Global text-size control — floats above every page (mounted once in
 * main.tsx, not per-route) so the preference is reachable and visibly
 * adjustable regardless of which page a user lands on, including the
 * public Landing page.
 */
export default function FontScaleControl() {
  const { scale, setScale } = useFontScale();

  return (
    <div className="fsc" role="group" aria-label="Text size">
      <span className="fsc-label mono">Aa</span>
      {FONT_SCALE_STEPS.map((step) => (
        <button
          key={step.value}
          type="button"
          className={`fsc-btn${scale === step.value ? " active" : ""}`}
          onClick={() => setScale(step.value)}
          aria-pressed={scale === step.value}
          title={step.name}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}
