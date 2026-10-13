const MISSING_0013 =
  "This project's database doesn't have migration 0013 yet (the water, waste and fuel set-up). " +
  "Apply supabase/migrations/0013_water_waste_fuel_factors.sql in the Supabase SQL editor, then try again.";

function rawMessage(err: unknown): string {
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

/**
 * A Supabase/PostgREST error is a plain object, so String(err) prints
 * "[object Object]". Pull the message out instead — and turn the one failure a
 * school can actually fix (0013 not applied yet) into an instruction.
 */
export function formatError(err: unknown): string {
  const m = rawMessage(err);
  return /factor_key|stand_in_ok/.test(m) && /column|schema cache/i.test(m) ? MISSING_0013 : m;
}
