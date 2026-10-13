import { supabase } from "./supabase";
import type { MeterReading, MeterReadingSource } from "./energy";

/** Every reading a school has logged for one module, across all its meters. */
export async function listAllReadings(schoolId: string, module: string): Promise<MeterReading[]> {
  const { data, error } = await supabase
    .from("meter_log")
    .select("*")
    .eq("school_id", schoolId)
    .eq("module", module)
    .order("period_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MeterReading[];
}

export type NewReading = {
  meterId: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
};

const CHUNK = 500;

/**
 * Saves readings in chunks and reports exactly how many landed. Each chunk is
 * one request (atomic on its own); a failure part-way leaves the earlier chunks
 * saved, so the caller is told the count rather than left guessing.
 *
 * AI-read bills must carry reviewed_at (the table enforces it) — pass `reviewed`
 * only after the school has checked the extracted values.
 */
export async function insertReadings(input: {
  schoolId: string;
  module: string;
  canonicalUnit: string;
  source: MeterReadingSource;
  rows: readonly NewReading[];
  reviewed?: boolean;
  confidence?: number | null;
}): Promise<{ saved: number }> {
  let saved = 0;
  const reviewedAt = input.reviewed ? new Date().toISOString() : null;
  for (let i = 0; i < input.rows.length; i += CHUNK) {
    const slice = input.rows.slice(i, i + CHUNK).map((r) => ({
      school_id: input.schoolId,
      module: input.module,
      meter_id: r.meterId,
      quantity: r.quantity,
      canonical_unit: input.canonicalUnit,
      period_start: r.periodStart,
      period_end: r.periodEnd,
      source: input.source,
      ...(reviewedAt ? { reviewed_at: reviewedAt } : {}),
      ...(input.confidence != null ? { source_confidence: input.confidence } : {}),
    }));
    const { error } = await supabase.from("meter_log").insert(slice);
    if (error) throw Object.assign(new Error(`${error.message} (${saved} of ${input.rows.length} readings were saved before this)`), { saved });
    saved += slice.length;
  }
  return { saved };
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from("meter_log").delete().eq("id", id);
  if (error) throw error;
}

/** A meter can only be removed once it has no readings (meter_log.meter_id is ON DELETE RESTRICT). */
export async function deleteMeter(id: string): Promise<void> {
  const { error } = await supabase.from("meters").delete().eq("id", id);
  if (error) throw error;
}
