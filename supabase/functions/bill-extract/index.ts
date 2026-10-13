// bill-extract — reads one utility bill (PDF or photo) and returns the consumption
// figures on it, for the school to REVIEW. It never writes to the database: the
// browser shows the result next to the original file and saves only what the school
// confirms (meter_log's own ai_needs_review constraint enforces that too).
//
// Privacy by construction, not by hiding fields afterwards:
//   * The file passes through memory and is sent to Google's Gemini API to be read.
//     It is NOT stored by this function, and its contents are NOT logged.
//   * The schema below asks for ONLY the billing period, the quantity and its unit,
//     and the meter number. It never asks for an account number, a name, an address,
//     an amount of money or a tariff, so those are never returned to us. (They may
//     still be printed on the file that Google receives — the app tells the school
//     so, and suggests covering them.)
//   * Anything the bill says is treated as data, never as instructions: the output is
//     constrained to the schema and a person reviews it before it is used.
//
// Needs the project secret GEMINI_API_KEY (already set for school-lookup). Deploy with
// JWT verification ON (the default) so only signed-in users can call it:
//   supabase functions deploy bill-extract --project-ref <ref>

const GEMINI_MODEL = "gemini-3.6-flash";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
// ~5 MB of file is ~6.7 MB of base64.
const MAX_BASE64_CHARS = 7_000_000;
const MAX_READINGS = 24;

const PROMPT =
  "You are reading a utility bill (electricity or water) for a school's carbon accounting. " +
  "Extract ONLY the consumption for each billing period shown: the period start and end dates " +
  "(ISO format YYYY-MM-DD), the quantity consumed and its unit exactly as printed (for example " +
  "kWh, m3, kL), and the meter number if one is printed. Do NOT extract or repeat account " +
  "numbers, customer names, addresses, amounts of money, tariffs or payment details. " +
  "If the bill shows several quantities (consumption, peak demand in kW, previous and current " +
  "meter readings, estimated versus actual), return the energy or water CONSUMED over the " +
  "period, not demand and not a meter index, and put a short note in `ambiguity` whenever there " +
  "was more than one candidate figure or the value is marked as an estimate. Give each reading a " +
  "`confidence` of high, medium or low. Return only the current billing period, unless the " +
  "document is clearly a statement listing several billed periods for the same meter. If the " +
  "file is not a utility bill or cannot be read, return an empty readings list and say why in " +
  "`notes`. Never guess a value that is not printed on the document.";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    readings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          meter_number: { type: "STRING", description: "Meter number as printed; omit if none is printed" },
          period_start: { type: "STRING", description: "Billing period start, YYYY-MM-DD" },
          period_end: { type: "STRING", description: "Billing period end, YYYY-MM-DD" },
          quantity: { type: "NUMBER", description: "Consumption for the period, as a plain number" },
          unit: { type: "STRING", description: "The unit printed next to the quantity, e.g. kWh, m3, kL" },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          ambiguity: {
            type: "STRING",
            description: "Why this figure may be wrong: several candidate numbers, an estimate, unclear dates",
          },
        },
        required: ["period_start", "period_end", "quantity", "unit", "confidence"],
      },
    },
    notes: { type: "STRING", description: "Anything the reviewer should know about the document as a whole" },
  },
  required: ["readings"],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

type Raw = Record<string, unknown>;
const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);

/** Keep only well-formed readings, capped. The browser validates again before anything is used. */
function clean(parsed: Raw): { readings: Raw[]; notes: string | null } {
  const list = Array.isArray(parsed.readings) ? parsed.readings : [];
  const readings: Raw[] = [];
  for (const item of list) {
    if (readings.length >= MAX_READINGS) break;
    if (typeof item !== "object" || item === null) continue;
    const r = item as Raw;
    const quantity = typeof r.quantity === "number" && Number.isFinite(r.quantity) ? r.quantity : null;
    const start = str(r.period_start, 10);
    const end = str(r.period_end, 10);
    const unit = str(r.unit, 24);
    if (quantity === null || !start || !end || !unit) continue;
    const confidence = r.confidence === "high" || r.confidence === "medium" || r.confidence === "low" ? r.confidence : "low";
    readings.push({
      meter_number: str(r.meter_number, 64),
      period_start: start,
      period_end: end,
      quantity,
      unit,
      confidence,
      ambiguity: str(r.ambiguity, 300),
    });
  }
  return { readings, notes: str(parsed.notes, 400) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Bill reading is not configured on this project." }, 503);

  let body: Raw;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send JSON: { mimeType, data } with the file base64-encoded." }, 400);
  }
  const mimeType = str(body.mimeType, 64);
  const data = typeof body.data === "string" ? body.data : "";
  if (!mimeType || !ALLOWED_TYPES.has(mimeType)) {
    return json({ error: "Use a PDF, JPEG, PNG or WebP file." }, 400);
  }
  if (data.length === 0 || data.length > MAX_BASE64_CHARS) {
    return json({ error: "The file is empty or larger than 5 MB." }, 413);
  }
  const module = body.module === "water" ? "water" : "electricity";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType, data } }, { text: `${PROMPT}\n\nThis is a ${module} bill.` }],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
      }),
    },
  );

  if (!res.ok) {
    // Status only: the response body can echo the document, so it is not logged.
    console.error(`[bill-extract] gemini status=${res.status}`);
    return json({ error: "The reading service is unavailable right now. Try again, or enter the figures by hand." }, 502);
  }

  const out = await res.json();
  const text = out.candidates?.[0]?.content?.parts?.[0]?.text;
  let parsed: Raw = {};
  try {
    parsed = text ? (JSON.parse(text) as Raw) : {};
  } catch {
    parsed = {};
  }
  const result = clean(parsed);
  console.log(`[bill-extract] ok readings=${result.readings.length}`);
  return json(result);
});
