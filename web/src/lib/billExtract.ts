import { supabase } from "./supabase";
import { BILL_MAX_BYTES, BILL_TYPES } from "./billReview";
import type { QuantityModule } from "./units";

export async function fileToBase64(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class BillReadError extends Error {
  /** True when the function simply is not deployed on this project. */
  readonly notSwitchedOn: boolean;
  constructor(message: string, notSwitchedOn = false) {
    super(message);
    this.notSwitchedOn = notSwitchedOn;
  }
}

/** Send one bill to the bill-extract Edge Function. Returns its raw response for toReviewRows. */
export async function extractBill(file: File, module: QuantityModule): Promise<unknown> {
  if (!(BILL_TYPES as readonly string[]).includes(file.type)) {
    throw new BillReadError("Use a PDF, JPEG, PNG or WebP file.");
  }
  if (file.size > BILL_MAX_BYTES) throw new BillReadError("That file is larger than 5 MB.");

  const { data, error } = await supabase.functions.invoke("bill-extract", {
    body: { mimeType: file.type, data: await fileToBase64(file), module },
  });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && res.status === 404) {
      throw new BillReadError(
        "Reading bills hasn't been switched on for this project yet. You can still type the figures in or import a CSV.",
        true,
      );
    }
    let message = "Couldn't read that bill. Try again, or enter the figures by hand.";
    try {
      const j = res ? await res.json() : null;
      if (j && typeof j.error === "string") message = j.error;
    } catch {
      /* keep the generic message */
    }
    throw new BillReadError(message);
  }
  return data;
}
