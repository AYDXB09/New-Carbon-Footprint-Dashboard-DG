import { useEffect, useRef, useState } from "react";
import "./Profile.css";
import Sidebar from "../../components/Sidebar";
import SchoolMap from "../../components/SchoolMap";
import GradeRangePicker from "../../components/GradeRangePicker";
import ContactCard from "../../components/ContactCard";
import {
  deleteContact,
  getContacts,
  getOrCreateMySchool,
  lookupSchoolWebsite,
  updateSchool,
  upsertContact,
  type FieldProvenance,
  type LookupLocation,
  type LookupResult,
  type SchoolContact,
  type SchoolRow,
} from "../../lib/school";

// String(err) on a Supabase/Postgrest error object renders "[object Object]"
// since those don't implement a custom toString — this pulls the actual
// .message out first, and falls back sanely for anything else that gets
// thrown (a real Error, a plain string, or something unexpected).
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Only shown for states worth flagging — a field that's plain "manual" and
// untouched shows no badge at all now (an earlier version badged everything
// "MANUAL", including fields Gemini had actually just filled in — misleading).
function Badge({ provenance }: { provenance: FieldProvenance }) {
  if (provenance === "detected_confirmed") {
    return (
      <span className="badge confirmed">
        <span className="dot"></span>CONFIRMED
      </span>
    );
  }
  if (provenance === "detected_unconfirmed") {
    return (
      <span className="badge detected">
        <span className="dot"></span>DETECTED — NEEDS CONFIRMATION
      </span>
    );
  }
  return null;
}

/** Digits-only text input — no spinner arrows, no way to type a letter. */
function NumberField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ?? ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "");
        onChange(digits ? Number(digits) : null);
      }}
    />
  );
}

const emptyContact = (rank: number): Partial<SchoolContact> => ({
  rank,
  email_provenance: "manual",
});

export default function Profile() {
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [primaryContact, setPrimaryContact] = useState<Partial<SchoolContact>>(emptyContact(1));
  const [secondaryContact, setSecondaryContact] = useState<Partial<SchoolContact> | null>(null);
  const loadedSnapshot = useRef<string | null>(null); // for dirty-state detection
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lookupUrl, setLookupUrl] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  // Set only when the school's site lists more than one campus — the user
  // picks which one this school file is for rather than us guessing.
  const [campusChoices, setCampusChoices] = useState<LookupResult | null>(null);

  useEffect(() => {
    getOrCreateMySchool()
      .then(async (row) => {
        setSchool(row);
        setLookupUrl(row.website_url ?? "");
        const contacts = await getContacts(row.id);
        const primary = contacts.find((c) => c.rank === 1) ?? emptyContact(1);
        const secondary = contacts.find((c) => c.rank === 2) ?? null;
        setPrimaryContact(primary);
        setSecondaryContact(secondary);
        loadedSnapshot.current = JSON.stringify({ school: row, primary, secondary });
      })
      .catch((err) => setError(formatError(err)))
      .finally(() => setLoading(false));
  }, []);

  const isDirty =
    school != null &&
    JSON.stringify({ school, primary: primaryContact, secondary: secondaryContact }) !==
      loadedSnapshot.current;

  function patchLocal(patch: Partial<SchoolRow>) {
    setSchool((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);
    setError(null);
    try {
      const savedSchool = await updateSchool(school.id, school);
      const savedPrimary = await upsertContact(school.id, 1, {
        name: primaryContact.name ?? null,
        title: primaryContact.title ?? null,
        email: primaryContact.email ?? null,
        email_provenance: primaryContact.email_provenance ?? "manual",
        phone_country_code: primaryContact.phone_country_code ?? null,
        phone_number: primaryContact.phone_number ?? null,
      });
      let savedSecondary: Partial<SchoolContact> | null = null;
      if (secondaryContact) {
        savedSecondary = await upsertContact(school.id, 2, {
          name: secondaryContact.name ?? null,
          title: secondaryContact.title ?? null,
          email: secondaryContact.email ?? null,
          email_provenance: secondaryContact.email_provenance ?? "manual",
          phone_country_code: secondaryContact.phone_country_code ?? null,
          phone_number: secondaryContact.phone_number ?? null,
        });
      }
      setSchool(savedSchool);
      setPrimaryContact(savedPrimary);
      setSecondaryContact(savedSecondary);
      loadedSnapshot.current = JSON.stringify({
        school: savedSchool,
        primary: savedPrimary,
        secondary: savedSecondary,
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(field: "address" | "location" | "climate_zone") {
    if (!school) return;
    const key = `${field === "climate_zone" ? "climate_zone" : field}_provenance` as keyof SchoolRow;
    const patch = { [key]: "detected_confirmed" } as Partial<SchoolRow>;
    patchLocal(patch);
    try {
      const saved = await updateSchool(school.id, patch);
      setSchool(saved);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleConfirmContactEmail() {
    if (!school) return;
    const patch = { email_provenance: "detected_confirmed" as FieldProvenance };
    setPrimaryContact((prev) => ({ ...prev, ...patch }));
    try {
      const saved = await upsertContact(school.id, 1, {
        name: primaryContact.name ?? null,
        title: primaryContact.title ?? null,
        email: primaryContact.email ?? null,
        email_provenance: "detected_confirmed",
        phone_country_code: primaryContact.phone_country_code ?? null,
        phone_number: primaryContact.phone_number ?? null,
      });
      setPrimaryContact(saved);
    } catch (err) {
      setError(formatError(err));
    }
  }

  function addSecondaryContact() {
    setSecondaryContact(emptyContact(2));
  }

  async function removeSecondaryContact() {
    if (secondaryContact?.id) {
      try {
        await deleteContact(secondaryContact.id);
      } catch (err) {
        setError(formatError(err));
        return;
      }
    }
    setSecondaryContact(null);
  }

  // Applies a chosen campus and saves it immediately (same "confirm writes
  // right away" principle as handleConfirm) — an earlier version only kept
  // this in local page state, so a lookup could look successful on screen
  // while the database still held whatever was there before.
  async function applyLocation(result: LookupResult, loc: LookupLocation) {
    if (!school) return;
    const patch: Partial<SchoolRow> = {
      website_url: lookupUrl,
      ...(result.name ? { name: result.name } : {}),
      address_text: loc.address_text,
      address_provenance: "detected_unconfirmed",
      ...(loc.city ? { city: loc.city } : {}),
      ...(loc.region ? { region: loc.region } : {}),
      ...(loc.country_code ?? result.country_code
        ? { country_code: loc.country_code ?? result.country_code }
        : {}),
      ...(loc.latitude != null && loc.longitude != null
        ? {
            latitude: loc.latitude,
            longitude: loc.longitude,
            location_provenance: "detected_unconfirmed",
          }
        : {}),
      ...(loc.climate_zone
        ? { climate_zone: loc.climate_zone, climate_zone_provenance: "detected_unconfirmed" }
        : {}),
    };
    patchLocal(patch);
    setCampusChoices(null);
    try {
      const saved = await updateSchool(school.id, patch);
      setSchool(saved);
      if (result.contact_email) {
        const savedContact = await upsertContact(school.id, 1, {
          name: primaryContact.name ?? null,
          title: primaryContact.title ?? null,
          email: result.contact_email,
          email_provenance: "detected_unconfirmed",
          phone_country_code: primaryContact.phone_country_code ?? null,
          phone_number: primaryContact.phone_number ?? null,
        });
        setPrimaryContact(savedContact);
      }
      loadedSnapshot.current = JSON.stringify({
        school: saved,
        primary: result.contact_email ? { ...primaryContact, email: result.contact_email } : primaryContact,
        secondary: secondaryContact,
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleLookup() {
    if (!lookupUrl) return;
    setLooking(true);
    setLookupError(null);
    setCampusChoices(null);
    try {
      const result = await lookupSchoolWebsite(lookupUrl);
      if (result.locations.length === 0) {
        setLookupError(
          "Couldn't find a campus address on this site — enter address and location manually below.",
        );
        if (result.name) patchLocal({ website_url: lookupUrl, name: result.name });
      } else if (result.locations.length === 1) {
        await applyLocation(result, result.locations[0]);
      } else {
        // Multiple campuses found — don't guess, let the school pick.
        setCampusChoices(result);
      }
    } catch (err) {
      setLookupError(formatError(err));
    } finally {
      setLooking(false);
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <main className="main">
          <p className="mono" style={{ padding: "2rem" }}>
            Loading school profile…
          </p>
        </main>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="shell">
        <main className="main">
          <p className="mono" style={{ padding: "2rem", color: "var(--amber)" }}>
            {error ?? "Could not load a school profile."}
          </p>
        </main>
      </div>
    );
  }

  const isDayOnly = school.school_type === "independent_day" || school.school_type === "public_district";

  return (
    <div className="shell">
      <Sidebar active="profile" />

      <main className="main">
        <div className="pagehead">
          <div>
            <h1>School profile</h1>
          </div>
          <div className="savebar">
            <span className="state mono">
              {saving
                ? "Saving…"
                : isDirty
                  ? "Unsaved changes"
                  : savedAt
                    ? `Saved ${savedAt.toLocaleTimeString()}`
                    : "All changes saved"}
            </span>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
              Save changes
            </button>
          </div>
        </div>

        {error && (
          <p className="mono" style={{ color: "var(--amber)", marginBottom: "1rem" }}>
            {error}
          </p>
        )}

        {/* Website lookup */}
        <div className="lookup">
          <div className="section-title" style={{ marginBottom: "0.8rem" }}>
            <h2>Website lookup</h2>
            <span className="n mono">OPTIONAL</span>
          </div>
          <div className="lookup-row">
            <input
              type="text"
              value={lookupUrl}
              onChange={(e) => setLookupUrl(e.target.value)}
              placeholder="https://www.yourschool.edu"
            />
            <button className="btn btn-primary" onClick={handleLookup} disabled={looking}>
              {looking ? "Looking up…" : "Look up"}
            </button>
          </div>
          <p className="hint">
            Fills <b>address</b>, <b>contact</b>, and <b>climate zone</b> below from public site
            data, and saves them right away as unconfirmed — click Confirm on each field once
            you've checked it. Re-running this never overwrites a field you've already confirmed
            or edited by hand.
          </p>
          {lookupError && (
            <p className="mono" style={{ color: "var(--amber)", fontSize: "0.76rem", marginTop: "0.5rem" }}>
              {lookupError}
            </p>
          )}
          {campusChoices && (
            <div className="campus-picker">
              <p className="mono campus-picker-label">
                {campusChoices.locations.length} CAMPUSES FOUND — WHICH ONE IS THIS SCHOOL FILE FOR?
              </p>
              {campusChoices.locations.map((loc, i) => (
                <button
                  key={i}
                  type="button"
                  className="campus-option"
                  onClick={() => applyLocation(campusChoices, loc)}
                >
                  <span className="campus-option-label">{loc.label ?? `Campus ${i + 1}`}</span>
                  <span className="campus-option-address">{loc.address_text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="section">
          <div className="section-title">
            <h2>School identity</h2>
          </div>
          <div className="field-grid">
            <div className="field">
              <div className="field-label">
                <label htmlFor="f-name">School name</label>
              </div>
              <input
                id="f-name"
                type="text"
                value={school.name}
                onChange={(e) => patchLocal({ name: e.target.value })}
              />
            </div>
            <div className="field">
              <div className="field-label">
                <label htmlFor="f-type">School type</label>
              </div>
              <select
                id="f-type"
                value={school.school_type ?? ""}
                onChange={(e) => patchLocal({ school_type: e.target.value })}
              >
                <option value="">— select —</option>
                <option value="independent_day">Independent day school</option>
                <option value="boarding">Boarding school</option>
                <option value="mixed_day_boarding">Mixed day &amp; boarding</option>
                <option value="public_district">Public / district school</option>
              </select>
            </div>
            <div className="field span2">
              <div className="field-label">
                <label htmlFor="f-address">Address</label>
                <Badge provenance={school.address_provenance} />
              </div>
              <input
                id="f-address"
                type="text"
                autoComplete="off"
                value={school.address_text ?? ""}
                onChange={(e) =>
                  patchLocal({ address_text: e.target.value, address_provenance: "manual" })
                }
              />
              {school.address_provenance === "detected_unconfirmed" && (
                <div className="confirm-row">
                  <span className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-faint)" }}>
                    from {school.website_url}
                  </span>
                  <button className="yes" onClick={() => handleConfirm("address")}>
                    ✓ Confirm
                  </button>
                </div>
              )}

              <div className="address-parts">
                <div>
                  <label className="address-parts-label" htmlFor="f-city">City</label>
                  <input
                    id="f-city"
                    type="text"
                    autoComplete="off"
                    value={school.city ?? ""}
                    onChange={(e) => patchLocal({ city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="address-parts-label" htmlFor="f-region">State / region</label>
                  <input
                    id="f-region"
                    type="text"
                    autoComplete="off"
                    value={school.region ?? ""}
                    onChange={(e) => patchLocal({ region: e.target.value })}
                  />
                </div>
                <div>
                  <label className="address-parts-label" htmlFor="f-country">Country code</label>
                  <input
                    id="f-country"
                    type="text"
                    autoComplete="off"
                    value={school.country_code ?? ""}
                    maxLength={2}
                    onChange={(e) => patchLocal({ country_code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>

            <div className="field span2">
              <div className="field-label">
                <span className="l">Location pin</span>
                <Badge provenance={school.location_provenance} />
              </div>
              <SchoolMap latitude={school.latitude} longitude={school.longitude} />
              <div className="confirm-row" style={{ marginTop: "0.5rem" }}>
                <span className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-faint)" }}>
                  {school.latitude != null && school.longitude != null
                    ? `${school.latitude.toFixed(4)}°, ${school.longitude.toFixed(4)}° — geocoded from address`
                    : "No coordinates yet — run a website lookup or drop a pin manually"}
                </span>
                {school.location_provenance === "detected_unconfirmed" && (
                  <button className="yes" onClick={() => handleConfirm("location")}>
                    ✓ Confirm
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                <label htmlFor="f-climate">Climate zone</label>
                <Badge provenance={school.climate_zone_provenance} />
              </div>
              <select
                id="f-climate"
                value={school.climate_zone ?? ""}
                onChange={(e) =>
                  patchLocal({ climate_zone: e.target.value, climate_zone_provenance: "manual" })
                }
              >
                <option value="">— select —</option>
                <option value="cold">Cold</option>
                <option value="temperate">Temperate</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
              </select>
              {school.climate_zone_provenance === "detected_unconfirmed" && (
                <div className="confirm-row">
                  <button className="yes" onClick={() => handleConfirm("climate_zone")}>
                    ✓ Confirm
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* School details */}
        <div className="section">
          <div className="section-title">
            <h2>School details</h2>
          </div>
          <div className="field-grid">
            <div className="field">
              <div className="field-label">
                <label htmlFor="f-students">Total enrolled students</label>
              </div>
              <NumberField
                id="f-students"
                value={school.students_total}
                onChange={(v) => patchLocal({ students_total: v })}
              />
            </div>
            <div className="field">
              <div className="field-label">
                <label htmlFor="f-staff">Staff &amp; admin headcount</label>
              </div>
              <NumberField
                id="f-staff"
                value={school.staff_headcount}
                onChange={(v) => patchLocal({ staff_headcount: v })}
              />
            </div>
            {!isDayOnly && (
              <div className="field span2">
                <div className="field-label">
                  <label htmlFor="f-boarding">Boarding students</label>
                </div>
                <NumberField
                  id="f-boarding"
                  value={school.students_boarding}
                  onChange={(v) => patchLocal({ students_boarding: v ?? 0 })}
                />
              </div>
            )}
            <div className="field span2">
              <div className="field-label">
                <span className="l">Grades offered</span>
              </div>
              <GradeRangePicker
                lowId={school.grade_range_low}
                highId={school.grade_range_high}
                onChange={(lo, hi) => patchLocal({ grade_range_low: lo, grade_range_high: hi })}
              />
            </div>
            <div className="field">
              <div className="field-label">
                <label htmlFor="f-gfa">Covered floor area (GFA)</label>
              </div>
              <NumberField
                id="f-gfa"
                value={school.gfa_total_m2}
                onChange={(v) => patchLocal({ gfa_total_m2: v })}
              />
            </div>
            <div className="field">
              <div className="field-label">
                <label htmlFor="f-gfa-cond">Conditioned floor area</label>
              </div>
              <NumberField
                id="f-gfa-cond"
                value={school.gfa_conditioned_m2}
                onChange={(v) => patchLocal({ gfa_conditioned_m2: v })}
              />
            </div>
          </div>
          <p className="unit-note">
            These numbers are the denominators every module divides by — energy and water
            use-per-area, per-student, per-capita waste, transportation occupancy. Covered floor
            area (GFA) is your school's roofed building footprint; conditioned floor area is the
            smaller, heated-or-cooled portion of it — that's the one the energy calculation
            actually uses, since uncovered outdoor space doesn't consume energy.
          </p>
        </div>

        {/* Contact — sits below School details per Anvith's instruction
            (2026-08-26). Separate from identity: not part of the same
            auto-detected cluster as address/climate zone. Backed by the
            normalized school_contacts table (migration 0005), not flat
            columns on schools. */}
        <div className="section">
          <div className="section-title">
            <h2>Contact</h2>
          </div>

          <ContactCard
            contact={primaryContact}
            idPrefix="p-contact"
            onChange={(patch) => setPrimaryContact((prev) => ({ ...prev, ...patch }))}
          />
          {primaryContact.email_provenance === "detected_unconfirmed" && (
            <div className="confirm-row" style={{ marginTop: "0.5rem" }}>
              <span className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-faint)" }}>
                email detected from website lookup
              </span>
              <button className="yes" onClick={handleConfirmContactEmail}>
                ✓ Confirm
              </button>
            </div>
          )}

          {secondaryContact ? (
            <div style={{ marginTop: "1rem" }}>
              <div className="section-title" style={{ marginBottom: "0.6rem" }}>
                <h2 style={{ fontSize: "0.92rem" }}>Secondary contact</h2>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}
                  onClick={removeSecondaryContact}
                >
                  ✕ Remove
                </button>
              </div>
              <ContactCard
                contact={secondaryContact}
                idPrefix="s-contact"
                onChange={(patch) => setSecondaryContact((prev) => ({ ...(prev ?? {}), ...patch }))}
              />
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: "0.9rem" }}
              onClick={addSecondaryContact}
            >
              + Add secondary contact
            </button>
          )}
        </div>

        {/* Units */}
        <div className="section">
          <div className="section-title">
            <h2>Units &amp; regional defaults</h2>
          </div>
          <table className="unit-table">
            <colgroup>
              <col className="cat-col" />
              <col className="enter-col" />
              <col className="unit-col" />
            </colgroup>
            <thead>
              <tr>
                <th>Category</th>
                <th>You enter in</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="cat">
                  <span className="sw" style={{ background: "var(--blue)" }}></span>Energy
                </td>
                <td>
                  <select
                    value={school.unit_energy}
                    onChange={(e) => patchLocal({ unit_energy: e.target.value })}
                  >
                    <option>kWh</option>
                    <option>therms</option>
                    <option>MJ</option>
                  </select>
                </td>
                <td className="canon">kWh</td>
              </tr>
              <tr>
                <td className="cat">
                  <span className="sw" style={{ background: "var(--blue)" }}></span>Water
                </td>
                <td>
                  <select
                    value={school.unit_water}
                    onChange={(e) => patchLocal({ unit_water: e.target.value })}
                  >
                    <option value="US gallons">US gallons</option>
                    <option value="litre">litres</option>
                    <option value="UK gallons">UK gallons</option>
                  </select>
                </td>
                <td className="canon">litres</td>
              </tr>
              <tr>
                <td className="cat">
                  <span className="sw" style={{ background: "var(--blue)" }}></span>Transportation
                </td>
                <td>
                  <select
                    value={school.unit_distance}
                    onChange={(e) => patchLocal({ unit_distance: e.target.value })}
                  >
                    <option value="miles">miles</option>
                    <option value="km">kilometres</option>
                  </select>
                </td>
                <td className="canon">km</td>
              </tr>
              <tr>
                <td className="cat">
                  <span className="sw" style={{ background: "var(--blue)" }}></span>Floor area
                </td>
                <td>
                  <select
                    value={school.unit_area}
                    onChange={(e) => patchLocal({ unit_area: e.target.value })}
                  >
                    <option value="ft2">ft²</option>
                    <option value="m2">m²</option>
                  </select>
                </td>
                <td className="canon">m²</td>
              </tr>
            </tbody>
          </table>
          <p className="unit-note">
            Enter values in whichever units you're used to — a bill in gallons and a trip logged
            in miles both work at the same time. The platform converts everything for you behind
            the scenes, so nothing else about setup changes based on what you pick here.
          </p>
        </div>
      </main>
    </div>
  );
}
