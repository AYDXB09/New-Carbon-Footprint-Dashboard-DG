import { supabase } from "./supabase";
import type { EnergyReportRow } from "./energy";

/**
 * Every saved report for a school, newest first. Read-only: `reports` has
 * select + insert policies and no update or delete (0010), so a snapshot can
 * be listed here but never altered.
 */
export async function listReports(schoolId: string): Promise<EnergyReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("school_id", schoolId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EnergyReportRow[];
}
