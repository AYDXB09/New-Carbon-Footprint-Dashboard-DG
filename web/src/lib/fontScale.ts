import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "groundwork_font_scale";

// Named steps rather than a free slider — easier to reason about ("Large"),
// and avoids ending up at an unreadable extreme by accident.
export const FONT_SCALE_STEPS = [
  { label: "S", value: 0.9, name: "Small" },
  { label: "M", value: 1, name: "Default" },
  { label: "L", value: 1.15, name: "Large" },
  { label: "XL", value: 1.35, name: "Extra large" },
] as const;

function applyScale(scale: number) {
  document.documentElement.style.setProperty("--font-scale", String(scale));
}

function readStoredScale(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return FONT_SCALE_STEPS.some((s) => s.value === parsed) ? parsed : 1;
}

/**
 * Site-wide text-size preference. Persisted to localStorage (no auth
 * dependency, so it works on the public Landing page too, not just signed-in
 * pages) and applied by setting --font-scale on the root element, which the
 * html { font-size: calc(...) } rule in tokens.css turns into a proportional
 * scale of every rem-based size in the app.
 */
export function useFontScale() {
  const [scale, setScaleState] = useState<number>(() =>
    typeof window !== "undefined" ? readStoredScale() : 1,
  );

  useEffect(() => {
    applyScale(scale);
  }, [scale]);

  const setScale = useCallback((next: number) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setScaleState(next);
  }, []);

  return { scale, setScale };
}
