import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The Edge Function runs on Deno, which isn't available here, so this loads its real source with a
// fake `Deno` and a fake Gemini. It guards the privacy design (what the model is allowed to be
// asked for, what is logged) and the clean-up of whatever the model sends back.

type Handler = (req: Request) => Promise<Response>;
let handler: Handler;
const env: Record<string, string | undefined> = { GEMINI_API_KEY: "test-key" };

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] }, serve: (h: Handler) => (handler = h) });
  await import("../../supabase/functions/bill-extract/index.ts");
});
afterEach(() => {
  vi.restoreAllMocks();
  env.GEMINI_API_KEY = "test-key";
});

const post = (body: unknown) =>
  handler(new Request("http://local/bill-extract", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const FILE = { mimeType: "application/pdf", data: "QUJD", module: "energy" };

function fakeGemini(output: unknown, status = 200) {
  const fetchMock = vi.fn(async () =>
    status === 200
      ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof output === "string" ? output : JSON.stringify(output) }] } }] }))
      : new Response("SECRET-DOCUMENT-ECHO", { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("request handling", () => {
  it("answers CORS preflight and refuses anything but POST", async () => {
    expect((await handler(new Request("http://l", { method: "OPTIONS" }))).status).toBe(200);
    expect((await handler(new Request("http://l", { method: "GET" }))).status).toBe(405);
  });
  it("says so plainly when the API key is not configured", async () => {
    env.GEMINI_API_KEY = undefined;
    expect((await post(FILE)).status).toBe(503);
  });
  it("rejects bad JSON, unsupported types and oversize or empty files before calling Gemini", async () => {
    const f = fakeGemini({ readings: [] });
    expect((await post("not json")).status).toBe(400);
    expect((await post({ ...FILE, mimeType: "application/zip" })).status).toBe(400);
    expect((await post({ ...FILE, mimeType: undefined })).status).toBe(400);
    expect((await post({ ...FILE, data: "" })).status).toBe(413);
    expect((await post({ ...FILE, data: "A".repeat(7_000_001) })).status).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("what the model is asked for", () => {
  it("sends the file with a schema that can only ever return the seven allowed fields", async () => {
    const f = fakeGemini({ readings: [] });
    await post(FILE);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const sent = JSON.parse(init.body as string);
    expect(sent.contents[0].parts[0].inlineData).toEqual({ mimeType: "application/pdf", data: "QUJD" });
    const props = sent.generationConfig.responseSchema.properties.readings.items.properties;
    // If someone adds an account number / address / amount field here, this must fail.
    expect(Object.keys(props).sort()).toEqual(
      ["ambiguity", "confidence", "meter_number", "period_end", "period_start", "quantity", "unit"].sort(),
    );
    expect(Object.keys(sent.generationConfig.responseSchema.properties).sort()).toEqual(["notes", "readings"]);
    expect(sent.generationConfig.temperature).toBe(0);
  });
  it("tells the model not to extract account numbers, names, addresses or money", async () => {
    const f = fakeGemini({ readings: [] });
    await post(FILE);
    const text: string = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).contents[0].parts[1].text;
    expect(text).toMatch(/Do NOT extract/);
    for (const word of ["account", "addresses", "money"]) expect(text.toLowerCase()).toContain(word);
  });
});

describe("what comes back", () => {
  const good = { meter_number: "W-1", period_start: "2025-09-01", period_end: "2025-09-30", quantity: 3120, unit: "m3", confidence: "high" };
  it("returns well-formed readings and the notes", async () => {
    fakeGemini({ readings: [{ ...good, ambiguity: "also shows a 12-month chart" }], notes: "Estimated bill." });
    const body = await (await post({ ...FILE, module: "water" })).json();
    expect(body.readings).toEqual([{ ...good, ambiguity: "also shows a 12-month chart" }]);
    expect(body.notes).toBe("Estimated bill.");
  });
  it("drops readings missing a field, or with a non-numeric quantity", async () => {
    fakeGemini({
      readings: [
        good,
        { ...good, quantity: "lots" },
        { ...good, period_end: undefined },
        { ...good, unit: "" },
        null,
        "text",
      ],
    });
    expect((await (await post(FILE)).json()).readings).toHaveLength(1);
  });
  it("downgrades an unknown confidence to low and trims over-long strings", async () => {
    fakeGemini({ readings: [{ ...good, confidence: "certain", ambiguity: "x".repeat(900), meter_number: "M".repeat(300) }] });
    const r = (await (await post(FILE)).json()).readings[0];
    expect(r.confidence).toBe("low");
    expect(r.ambiguity).toHaveLength(300);
    expect(r.meter_number).toHaveLength(64);
  });
  it("caps the number of readings", async () => {
    fakeGemini({ readings: Array.from({ length: 60 }, () => good) });
    expect((await (await post(FILE)).json()).readings).toHaveLength(24);
  });
  it("survives a model that returns garbage or nothing", async () => {
    fakeGemini("this is not json");
    expect((await (await post(FILE)).json()).readings).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [] }))));
    expect((await (await post(FILE)).json()).readings).toEqual([]);
  });
});

describe("failures and logging", () => {
  it("returns a generic 502 when Gemini fails, without echoing its response", async () => {
    fakeGemini("", 429);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(FILE);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-DOCUMENT-ECHO");
  });
  it("never logs the document or what was read from it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fakeGemini({ readings: [{ meter_number: "METER-SECRET-77", period_start: "2025-09-01", period_end: "2025-09-30", quantity: 123456, unit: "kWh", confidence: "high" }] });
    await post({ ...FILE, data: "UFJJVkFURS1CSUxM" });
    fakeGemini("", 500);
    await post({ ...FILE, data: "UFJJVkFURS1CSUxM" });
    const logged = JSON.stringify([...log.mock.calls, ...err.mock.calls]);
    for (const secret of ["METER-SECRET-77", "123456", "UFJJVkFURS1CSUxM", "SECRET-DOCUMENT-ECHO"]) {
      expect(logged).not.toContain(secret);
    }
  });
});
