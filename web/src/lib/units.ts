/**
 * Units a school may use when typing or importing a quantity, and the exact
 * conversion into the one canonical unit each module is stored in. Everything is
 * converted once, at the door, so nothing downstream needs to know what was typed.
 *
 * Every constant is a definition, not a measurement:
 *   1 kWh = 3.6 MJ                            (SI)
 *   1 therm = 100 000 BTU(IT) = 105.505585262 MJ
 *   1 US gallon = 3.785411784 L               (exact, by definition)
 *   1 imperial (UK) gallon = 4.54609 L        (exact, by definition)
 *   1 litre = 0.001 m3
 */

export type QuantityModule = "energy" | "water" | "waste" | "transportation";

export interface UnitChoice {
  id: string;
  label: string;
  /** Multiply a value in this unit by this to get the canonical unit. */
  toCanonical: number;
}

export interface ModuleUnits {
  /** Value stored in meter_log.canonical_unit. */
  canonical: string;
  canonicalLabel: string;
  choices: readonly UnitChoice[];
}

const MJ_PER_KWH = 3.6;
const MJ_PER_THERM = 105.505585262;
const L_PER_US_GAL = 3.785411784;
const L_PER_UK_GAL = 4.54609;

export const MODULE_UNITS: Record<QuantityModule, ModuleUnits> = {
  energy: {
    canonical: "kWh",
    canonicalLabel: "kWh",
    choices: [
      { id: "kWh", label: "kWh", toCanonical: 1 },
      { id: "MWh", label: "MWh", toCanonical: 1000 },
      { id: "MJ", label: "MJ", toCanonical: 1 / MJ_PER_KWH },
      { id: "GJ", label: "GJ", toCanonical: 1000 / MJ_PER_KWH },
      { id: "therms", label: "therms", toCanonical: MJ_PER_THERM / MJ_PER_KWH },
    ],
  },
  water: {
    canonical: "m3",
    canonicalLabel: "m³",
    choices: [
      { id: "m3", label: "m³", toCanonical: 1 },
      { id: "litre", label: "litres", toCanonical: 0.001 },
      { id: "US gallons", label: "US gallons", toCanonical: (L_PER_US_GAL * 0.001) },
      { id: "UK gallons", label: "UK gallons", toCanonical: (L_PER_UK_GAL * 0.001) },
    ],
  },
  waste: {
    canonical: "tonne",
    canonicalLabel: "tonnes",
    choices: [
      { id: "tonne", label: "tonnes", toCanonical: 1 },
      { id: "kg", label: "kg", toCanonical: 0.001 },
    ],
  },
  transportation: {
    canonical: "litre",
    canonicalLabel: "litres",
    choices: [
      { id: "litre", label: "litres", toCanonical: 1 },
      { id: "US gallons", label: "US gallons", toCanonical: L_PER_US_GAL },
      { id: "UK gallons", label: "UK gallons", toCanonical: L_PER_UK_GAL },
    ],
  },
};

export function unitChoice(module: QuantityModule, id: string): UnitChoice {
  const c = MODULE_UNITS[module].choices.find((u) => u.id === id);
  if (!c) throw new Error(`Unknown unit "${id}" for ${module}`);
  return c;
}

/** Convert, rounding to the 3 decimal places meter_log.quantity stores. */
export function toCanonical(module: QuantityModule, unitId: string, value: number): number {
  return Math.round(value * unitChoice(module, unitId).toCanonical * 1000) / 1000;
}

/**
 * The profile's own unit setting, if it names a unit this module can convert;
 * otherwise the module's canonical unit.
 */
export function defaultUnitId(module: QuantityModule, profileUnit: string | null | undefined): string {
  const match = MODULE_UNITS[module].choices.find((c) => c.id === profileUnit);
  return match ? match.id : MODULE_UNITS[module].choices[0].id;
}
