import type { QuantityModule } from "./units";

/** What a meter "is" in a module — for Water, Waste and Fuel this also picks the emission factor. */
export interface MeterKind {
  /** Stored in meters.factor_key AND equal to the emission_factors.factor_key that prices it. */
  key: string;
  label: string;
  hint?: string;
}

export interface ModuleConfig {
  key: QuantityModule;
  label: string;
  route: string;
  /** First step of a report's derivation, e.g. "Water volume". */
  quantityLabel: string;
  /** What the school calls one registered thing. */
  noun: string;
  nounPlural: string;
  locationLabel: string;
  locationPlaceholder: string;
  numberLabel: string;
  numberPlaceholder: string;
  /** Set when each meter must choose a kind (Water, Waste, Fuel). Energy leaves it out. */
  kindLabel?: string;
  kinds?: readonly MeterKind[];
  blurb: string;
  /** Shown above the readings; the honest limits of the method. */
  caveat?: string;
  /** The profile column that holds this module's preferred unit, if any. */
  profileUnitKey?: "unit_energy" | "unit_water";
  billUpload: boolean;
}

const WASTE_KINDS: readonly MeterKind[] = [
  { key: "waste_general_landfill", label: "General waste → landfill" },
  { key: "waste_general_incineration", label: "General waste → incineration / energy recovery" },
  { key: "waste_food_landfill", label: "Food waste → landfill" },
  { key: "waste_food_composting", label: "Food waste → composting" },
  { key: "waste_food_anaerobic", label: "Food waste → anaerobic digestion" },
  { key: "waste_garden_landfill", label: "Garden waste → landfill" },
  { key: "waste_garden_composting", label: "Garden waste → composting" },
  { key: "waste_paper_landfill", label: "Paper & card → landfill" },
  { key: "waste_paper_recycled", label: "Paper & card → recycled" },
  { key: "waste_plastic_landfill", label: "Plastics → landfill" },
  { key: "waste_plastic_recycled", label: "Plastics → recycled" },
  { key: "waste_metal_landfill", label: "Metal cans → landfill" },
  { key: "waste_metal_recycled", label: "Metal cans → recycled" },
  { key: "waste_glass_landfill", label: "Glass → landfill" },
  { key: "waste_glass_recycled", label: "Glass → recycled" },
];

export const MODULE_CONFIG: Record<QuantityModule, ModuleConfig> = {
  energy: {
    key: "energy",
    label: "Energy",
    route: "/energy",
    quantityLabel: "Metered consumption",
    noun: "meter",
    nounPlural: "meters",
    locationLabel: "Location",
    locationPlaceholder: "e.g. Main Building",
    numberLabel: "Meter number (optional)",
    numberPlaceholder: "e.g. DEWA-88213",
    blurb: "Electricity from your meters or bills.",
    profileUnitKey: "unit_energy",
    billUpload: true,
  },
  water: {
    key: "water",
    label: "Water",
    route: "/water",
    quantityLabel: "Water volume",
    noun: "water meter",
    nounPlural: "water meters",
    locationLabel: "Location",
    locationPlaceholder: "e.g. Main Building",
    numberLabel: "Meter number (optional)",
    numberPlaceholder: "e.g. W-4410",
    kindLabel: "What does this meter measure?",
    kinds: [
      { key: "supply_intensity", label: "Mains water in", hint: "Water supplied to the school, from the meter or the water bill." },
      {
        key: "treatment_intensity",
        label: "Wastewater out",
        hint: "Water sent to the sewer for treatment. If you don't meter it, enter the same volume as supplied.",
      },
    ],
    blurb: "Water supplied to the school, and the wastewater sent for treatment.",
    caveat:
      "The published factors describe the UK water industry. Where water is mostly desalinated (for example the UAE) real emissions per m³ are much higher, so outside the UK the figure is a stand-in with a deliberately wide range.",
    profileUnitKey: "unit_water",
    billUpload: true,
  },
  waste: {
    key: "waste",
    label: "Waste",
    route: "/waste",
    quantityLabel: "Waste weight",
    noun: "waste stream",
    nounPlural: "waste streams",
    locationLabel: "Stream name",
    locationPlaceholder: "e.g. Canteen food waste",
    numberLabel: "Reference (optional)",
    numberPlaceholder: "e.g. contractor bin ID",
    kindLabel: "Where does this waste go?",
    kinds: WASTE_KINDS,
    blurb: "What the school throws away, by type and by where it ends up.",
    caveat:
      "This follows the UK Government's scope-3 method: it counts collection, transport and landfill, not the full footprint of waste treatment. Use it to track your own totals over time. It cannot tell you whether recycling beats incineration.",
    billUpload: false,
  },
  transportation: {
    key: "transportation",
    label: "Transportation",
    route: "/transportation",
    quantityLabel: "Fuel used",
    noun: "vehicle group",
    nounPlural: "vehicle groups",
    locationLabel: "Vehicles",
    locationPlaceholder: "e.g. School buses",
    numberLabel: "Reference (optional)",
    numberPlaceholder: "e.g. fuel card number",
    kindLabel: "Which fuel?",
    kinds: [
      { key: "diesel_litre", label: "Diesel", hint: "Buses, vans and most large vehicles." },
      { key: "petrol_litre", label: "Petrol", hint: "Cars and minibuses." },
    ],
    blurb: "Fuel burned by vehicles the school owns or runs.",
    caveat:
      "Only school-run vehicles are counted here. Pupil and staff journeys to school need a survey and are not built yet, so this is not the whole transport footprint.",
    billUpload: false,
  },
};

export function kindLabel(module: QuantityModule, key: string | null | undefined): string | null {
  if (!key) return null;
  return MODULE_CONFIG[module].kinds?.find((k) => k.key === key)?.label ?? key;
}

export function isQuantityModule(v: string): v is QuantityModule {
  return v === "energy" || v === "water" || v === "waste" || v === "transportation";
}
