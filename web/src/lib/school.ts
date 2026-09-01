import { supabase } from "./supabase";

export type FieldProvenance = "manual" | "detected_unconfirmed" | "detected_confirmed";

export type SchoolRow = {
  id: string;
  name: string;
  website_url: string | null;
  school_type: string | null;
  address_text: string | null;
  address_provenance: FieldProvenance;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  location_provenance: FieldProvenance;
  climate_zone: string | null;
  climate_zone_provenance: FieldProvenance;
  country_code: string | null;
  students_total: number | null;
  students_boarding: number | null;
  staff_headcount: number | null;
  grade_range_low: string | null;
  grade_range_high: string | null;
  gfa_total_m2: number | null;
  gfa_conditioned_m2: number | null;
  unit_energy: string;
  unit_water: string;
  unit_distance: string;
  unit_area: string;
};

/**
 * Returns the signed-in user's school, creating one on first sign-in.
 * Requires an authenticated session — callers should already be behind
 * <RequireAuth> (see lib/auth.tsx). Ownership is enforced by RLS
 * (school_members) and the create_my_school() function, not by this code.
 */
export async function getOrCreateMySchool(): Promise<SchoolRow> {
  const { data: membership, error: memberError } = await supabase
    .from("school_members")
    .select("school_id")
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  if (membership) {
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .eq("id", membership.school_id)
      .single();
    if (error) throw error;
    return data as SchoolRow;
  }

  const { data: created, error: createError } = await supabase.rpc("create_my_school", {
    p_name: "Untitled school",
  });
  if (createError) throw createError;
  return created as SchoolRow;
}

export async function updateSchool(
  id: string,
  patch: Partial<SchoolRow>,
): Promise<SchoolRow> {
  const { data, error } = await supabase
    .from("schools")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as SchoolRow;
}

/**
 * One row in school_contacts. rank 1 = primary, 2 = secondary — the table
 * scales to a 3rd/4th contact later with no schema change (see CLAUDE.md
 * "Contact block redesign", 2026-08-26). Replaces the old flat
 * contact_name/contact_email columns on schools (migration 0005).
 */
export type SchoolContact = {
  id: string;
  school_id: string;
  rank: number;
  name: string | null;
  title: string | null;
  email: string | null;
  email_provenance: FieldProvenance;
  phone_country_code: string | null;
  phone_number: string | null;
};

export async function getContacts(schoolId: string): Promise<SchoolContact[]> {
  const { data, error } = await supabase
    .from("school_contacts")
    .select("*")
    .eq("school_id", schoolId)
    .order("rank", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchoolContact[];
}

/** Insert or update the contact at a given rank (1 = primary, 2 = secondary). */
export async function upsertContact(
  schoolId: string,
  rank: number,
  patch: Partial<Omit<SchoolContact, "id" | "school_id" | "rank">>,
): Promise<SchoolContact> {
  const { data, error } = await supabase
    .from("school_contacts")
    .upsert({ school_id: schoolId, rank, ...patch }, { onConflict: "school_id,rank" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SchoolContact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("school_contacts").delete().eq("id", id);
  if (error) throw error;
}

export type LookupLocation = {
  label?: string; // campus/branch name, present only when the school has more than one site
  address_text: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  climate_zone?: string;
  country_code?: string;
};

export type LookupResult = {
  name?: string;
  contact_email?: string;
  country_code?: string;
  contact_page_used?: string | null;
  locations: LookupLocation[];
};

/**
 * Calls the `school-lookup` Edge Function: server-side fetch of the school's
 * homepage, follows a link to its Contact/Locations page when one is found
 * (a much more reliable address source than homepage marketing copy), an AI
 * extraction pass listing every campus mentioned, then geocoding each one.
 * Requires the GEMINI_API_KEY secret to be set on the Supabase project —
 * see supabase/functions/school-lookup/README.md.
 */
export async function lookupSchoolWebsite(url: string): Promise<LookupResult> {
  const { data, error } = await supabase.functions.invoke("school-lookup", {
    body: { url },
  });
  if (error) throw error;
  return data as LookupResult;
}
