import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRY_CODES, type CountryCode } from "../lib/countryCodes";
import "./PhoneField.css";

type PhoneFieldProps = {
  countryCode: string | null; // e.g. "+971"
  number: string | null;
  onChange: (countryCode: string | null, number: string | null) => void;
};

const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // UAE — matches the rest of this deployment's default

function findByDial(dial: string | null): CountryCode | undefined {
  if (!dial) return undefined;
  return COUNTRY_CODES.find((c) => c.dial === dial);
}

/**
 * Country-code + national-number phone input. The picker is both
 * searchable (type a country name or digits of a code to filter) and
 * directly typable (typing a full valid dial code into the search box
 * selects it without needing to click a row) — per the Figma sketch
 * ("Groundwork — Contact Section").
 */
export default function PhoneField({ countryCode, number, onChange }: PhoneFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = findByDial(countryCode) ?? DEFAULT_COUNTRY;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q.replace(/^\+/, "")),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function openPicker() {
    setOpen(true);
    setQuery("");
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function select(c: CountryCode) {
    onChange(c.dial, number);
    setOpen(false);
  }

  function handleSearchChange(v: string) {
    setQuery(v);
    // Typing a full valid dial code directly selects it — the "typable,
    // not just selectable" requirement from the Figma sketch.
    const direct = COUNTRY_CODES.find((c) => c.dial === (v.startsWith("+") ? v : `+${v}`));
    if (direct) onChange(direct.dial, number);
  }

  return (
    <div className="phonefield-row">
      <div className="cc-picker" ref={wrapRef}>
        <button
          type="button"
          className={`cc-btn${open ? " open" : ""}`}
          onClick={() => (open ? setOpen(false) : openPicker())}
        >
          <span className="flag">{current.flag}</span>
          <span className="code mono">{current.dial}</span>
          <span className="car">▾</span>
        </button>
        {open && (
          <div className="cc-dropdown">
            <div className="cc-search">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search or type a code…"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="cc-list">
              {filtered.length === 0 && <div className="cc-empty">No matches</div>}
              {filtered.map((c) => (
                <button
                  type="button"
                  key={c.iso2}
                  className={`cc-item${c.dial === current.dial ? " active" : ""}`}
                  onClick={() => select(c)}
                >
                  <span className="flag">{c.flag}</span>
                  <span className="name">{c.name}</span>
                  <span className="code mono">{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input
        type="text"
        className="phone-number"
        autoComplete="off"
        placeholder="50 123 4567"
        value={number ?? ""}
        onChange={(e) => onChange(countryCode ?? current.dial, e.target.value)}
      />
    </div>
  );
}
