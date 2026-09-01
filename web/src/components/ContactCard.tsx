import PhoneField from "./PhoneField";
import type { FieldProvenance, SchoolContact } from "../lib/school";
import "./ContactCard.css";

type ContactCardProps = {
  contact: Partial<SchoolContact>;
  onChange: (patch: Partial<SchoolContact>) => void;
  idPrefix: string;
};

function ProvenanceBadge({ provenance }: { provenance?: FieldProvenance }) {
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

/** Name/Title row, Email/Phone row — used for both primary and secondary contacts. */
export default function ContactCard({ contact, onChange, idPrefix }: ContactCardProps) {
  return (
    <div className="contact-card">
      <div className="field-grid">
        <div className="field">
          <div className="field-label">
            <label htmlFor={`${idPrefix}-name`}>Contact name</label>
          </div>
          <input
            id={`${idPrefix}-name`}
            type="text"
            autoComplete="off"
            value={contact.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <div className="field-label">
            <label htmlFor={`${idPrefix}-title`}>Title</label>
          </div>
          <input
            id={`${idPrefix}-title`}
            type="text"
            autoComplete="off"
            placeholder="e.g. Facilities Manager"
            value={contact.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="field">
          <div className="field-label">
            <label htmlFor={`${idPrefix}-email`}>Email</label>
            <ProvenanceBadge provenance={contact.email_provenance} />
          </div>
          <input
            id={`${idPrefix}-email`}
            type="text"
            autoComplete="off"
            value={contact.email ?? ""}
            onChange={(e) => onChange({ email: e.target.value, email_provenance: "manual" })}
          />
        </div>
        <div className="field">
          <div className="field-label">
            <label htmlFor={`${idPrefix}-phone`}>
              Phone <span className="optional-tag">OPTIONAL</span>
            </label>
          </div>
          <PhoneField
            countryCode={contact.phone_country_code ?? null}
            number={contact.phone_number ?? null}
            onChange={(cc, num) => onChange({ phone_country_code: cc, phone_number: num })}
          />
        </div>
      </div>
    </div>
  );
}
