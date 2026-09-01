const pptxgen = require("pptxgenjs");

const FOREST = "1F4B3F";
const FOREST_DARK = "12302A";
const SAGE = "6FA287";
const SAGE_LIGHT = "DCEBE3";
const AMBER = "E8A33D";
const WHITE = "FFFFFF";
const INK = "1D2620";
const MUTED = "5B6B63";

function baseSlide(pres, opts) {
  const s = pres.addSlide();
  s.background = { color: opts && opts.dark ? FOREST_DARK : WHITE };
  return s;
}

function title(s, text, opts) {
  s.addText(text, {
    x: 0.6, y: 0.5, w: 12.1, h: 0.9,
    fontFace: "Cambria", fontSize: 30, bold: true,
    color: (opts && opts.dark) ? WHITE : INK, margin: 0,
  });
}

function kicker(s, text, opts) {
  s.addText(text.toUpperCase(), {
    x: 0.6, y: 0.22, w: 10, h: 0.3,
    fontFace: "Calibri", fontSize: 12, bold: true, charSpacing: 2,
    color: (opts && opts.dark) ? SAGE : SAGE.replace ? "3B7A5C" : SAGE,
    margin: 0,
  });
}

function pageNum(s, n, dark) {
  s.addText(String(n).padStart(2, "0"), {
    x: 12.5, y: 7.05, w: 0.6, h: 0.3, align: "right",
    fontFace: "Calibri", fontSize: 10, color: dark ? "6E8A80" : "A7B3AC", margin: 0,
  });
}

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.defineLayout({ name: "LAYOUT_WIDE", width: 13.3, height: 7.5 });
pres.layout = "LAYOUT_WIDE";

// ---------- 1. Title ----------
{
  const s = baseSlide(pres, { dark: true });
  s.addShape("ellipse", { x: 9.6, y: -2.4, w: 7, h: 7, fill: { color: FOREST, transparency: 20 }, line: { type: "none" } });
  s.addShape("ellipse", { x: 10.8, y: 4.6, w: 5, h: 5, fill: { color: SAGE, transparency: 78 }, line: { type: "none" } });
  s.addText("SCHOOL CARBON PLATFORM", {
    x: 0.8, y: 2.15, w: 8, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true,
    charSpacing: 3, color: SAGE, margin: 0,
  });
  s.addText("From a single school's calculator\nto a global benchmarking platform", {
    x: 0.78, y: 2.55, w: 9.8, h: 2.1, fontFace: "Cambria", fontSize: 40, bold: true,
    color: WHITE, margin: 0, lineSpacingMultiple: 1.08,
  });
  s.addText("Product and methodology plan — carbon footprint tracking for physical, online, and hybrid schools", {
    x: 0.8, y: 4.75, w: 8.6, h: 0.6, fontFace: "Calibri", fontSize: 15,
    color: "BFD3C9", margin: 0,
  });
  s.addText("New-Carbon-Footprint-Dashboard-DG   ·   August 2026", {
    x: 0.8, y: 6.7, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 11,
    color: "7E9A8F", margin: 0,
  });
}

// ---------- 2. Where we started ----------
{
  const s = baseSlide(pres);
  kicker(s, "Where we started");
  title(s, "One school's client-side calculator");
  s.addText(
    "A single-page tool built for Dwight Global, an online school. Everything runs in the browser: a Monte Carlo engine models digital activity, and results export to a polished PDF. There is no backend, no accounts, and nothing is saved once the tab closes.",
    { x: 0.6, y: 1.55, w: 6.7, h: 1.9, fontFace: "Calibri", fontSize: 14.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.25 }
  );
  const stats = [
    ["10,000", "Monte Carlo iterations per run"],
    ["4", "categories modeled: device, Zoom, LMS, tools"],
    ["0", "persistence — data is gone on refresh"],
  ];
  let y = 3.7;
  stats.forEach((st) => {
    s.addText(st[0], { x: 0.6, y, w: 2.2, h: 0.7, fontFace: "Cambria", fontSize: 30, bold: true, color: FOREST, margin: 0 });
    s.addText(st[1], { x: 2.85, y: y + 0.1, w: 4.4, h: 0.6, fontFace: "Calibri", fontSize: 13, color: MUTED, margin: 0, valign: "middle" });
    y += 0.95;
  });
  const card = s.addShape("roundRect", { x: 7.75, y: 1.55, w: 4.95, h: 5.05, rectRadius: 0.12, fill: { color: SAGE_LIGHT }, line: { type: "none" } });
  s.addText("Covers roughly", { x: 8.15, y: 1.95, w: 4.2, h: 0.4, fontFace: "Calibri", fontSize: 13, color: "3B7A5C", bold: true, margin: 0 });
  s.addText("10–15%", { x: 8.15, y: 2.3, w: 4.2, h: 1.1, fontFace: "Cambria", fontSize: 54, bold: true, color: FOREST, margin: 0 });
  s.addText("of a physical school's real footprint — facilities and transportation dominate there, and neither is modeled today.", {
    x: 8.15, y: 3.5, w: 4.15, h: 2.8, fontFace: "Calibri", fontSize: 13.5, color: "2E4C3F", margin: 0, lineSpacingMultiple: 1.3,
  });
  pageNum(s, 2);
}

// ---------- 3. The pivot ----------
{
  const s = baseSlide(pres);
  kicker(s, "The decision");
  title(s, "Physical-school-first, modular by design");
  s.addText("More physical schools exist than online ones. The existing engine stays — it becomes one module of a larger platform, built on two independent axes.", {
    x: 0.6, y: 1.5, w: 11.8, h: 0.6, fontFace: "Calibri", fontSize: 14.5, color: MUTED, margin: 0,
  });

  // Breadth column
  s.addText("BREADTH — what a school tracks", { x: 0.6, y: 2.35, w: 5.8, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true, color: FOREST, margin: 0 });
  const breadth = ["Energy", "Water", "Transportation", "Digital", "Waste & food"];
  let bx = 0.6;
  breadth.forEach((b, i) => {
    const w = 2.28;
    s.addShape("roundRect", { x: bx, y: 2.8, w: w - 0.14, h: 0.85, rectRadius: 0.08, fill: { color: i < 4 ? FOREST : "E7E7E2" }, line: { type: "none" } });
    s.addText(b, { x: bx, y: 2.8, w: w - 0.14, h: 0.85, align: "center", valign: "middle", fontFace: "Calibri", fontSize: 12, bold: true, color: i < 4 ? WHITE : "8B8B82", margin: 0 });
    bx += w;
  });
  s.addText("Opt-in per school — an online school might switch on only Digital", { x: 0.6, y: 3.78, w: 11.5, h: 0.35, fontFace: "Calibri", fontSize: 11.5, italic: true, color: MUTED, margin: 0 });

  // Depth row
  s.addText("DEPTH — how granular the data is, per category independently", { x: 0.6, y: 4.35, w: 8, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true, color: FOREST, margin: 0 });
  const depth = [
    ["Tier 1", "Estimate", "Floor area + students → peer-median proxy, wide range"],
    ["Tier 2", "Actual", "Annual utility bill totals — the EmiratesGBC / ENERGY STAR standard"],
    ["Tier 3", "Granular", "Monthly, multi-meter data — narrow confidence range"],
  ];
  let dx = 0.6;
  depth.forEach((d) => {
    const w = 3.95;
    s.addShape("roundRect", { x: dx, y: 4.8, w: w - 0.15, h: 1.75, rectRadius: 0.1, fill: { color: SAGE_LIGHT }, line: { type: "none" } });
    s.addText(d[0], { x: dx + 0.25, y: 4.98, w: w - 0.6, h: 0.4, fontFace: "Cambria", fontSize: 18, bold: true, color: FOREST, margin: 0 });
    s.addText(d[1], { x: dx + 0.25, y: 5.35, w: w - 0.6, h: 0.3, fontFace: "Calibri", fontSize: 12, bold: true, color: "3B7A5C", margin: 0 });
    s.addText(d[2], { x: dx + 0.25, y: 5.68, w: w - 0.6, h: 0.8, fontFace: "Calibri", fontSize: 11.5, color: "2E4C3F", margin: 0, lineSpacingMultiple: 1.2 });
    dx += w;
  });
  pageNum(s, 3);
}

// ---------- 4. International research table ----------
{
  const s = baseSlide(pres);
  kicker(s, "Grounding the methodology");
  title(s, "Five programs, read directly, not summarized");
  const rows = [
    [{ text: "Program", options: { bold: true, color: WHITE, fill: { color: FOREST } } },
     { text: "Primary metric", options: { bold: true, color: WHITE, fill: { color: FOREST } } },
     { text: "Data source", options: { bold: true, color: WHITE, fill: { color: FOREST } } },
     { text: "Transport?", options: { bold: true, color: WHITE, fill: { color: FOREST } } }],
    ["EmiratesGBC (Dubai)", "kWh/m2/yr and kWh/student/yr", "Annual facility questionnaire", "No"],
    ["US ENERGY STAR (K-12)", "1–100 regression score", "CBECS national survey", "No"],
    ["Singapore BCA Green Mark", "kWh/m2/yr", "Certification audit", "No"],
    ["Hong Kong BEAM Plus", "kWh/m2/yr, Bronze–Platinum", "Certification audit", "No"],
    ["Nordic academic benchmarks", "Split electricity vs thermal", "Research studies", "No"],
  ].map((r, i) => (i === 0 ? r : r.map((c) => ({ text: c, options: { color: INK, fill: { color: i % 2 ? WHITE : SAGE_LIGHT } } }))));
  s.addTable(rows, {
    x: 0.6, y: 1.6, w: 12.1, h: 3.7,
    fontFace: "Calibri", fontSize: 12.5, valign: "middle",
    border: { type: "solid", color: "E4E9E6", pt: 0.75 },
    autoPage: false, colW: [3.6, 3.4, 3.4, 1.7],
    rowH: [0.5, 0.62, 0.62, 0.62, 0.62, 0.62],
  });
  s.addShape("roundRect", { x: 0.6, y: 5.55, w: 12.1, h: 1.25, rectRadius: 0.1, fill: { color: FOREST_DARK }, line: { type: "none" } });
  s.addText("Not one of the five surveys students directly, or measures commuting or digital use. Transportation and digital-usage modules are genuinely new territory, not adaptations of an existing standard.", {
    x: 1.0, y: 5.75, w: 11.3, h: 0.9, fontFace: "Cambria", fontSize: 15, italic: true, color: WHITE, margin: 0, valign: "middle",
  });
  pageNum(s, 4);
}

// ---------- 5. Time dimension ----------
{
  const s = baseSlide(pres);
  kicker(s, "A cross-cutting problem");
  title(s, "Reconciling different reporting periods");
  s.addText("A school in Manchester submits an academic year. A school in Dubai submits one calendar month. Both need to land on a comparable footing.", {
    x: 0.6, y: 1.5, w: 11.8, h: 0.55, fontFace: "Calibri", fontSize: 14.5, color: MUTED, margin: 0,
  });
  const tiers = [
    ["< 3 months", "Spot check", "Shown as-is for that period only. No annual estimate attempted — excluded from peer rankings.", "E7E7E2", "6B6B62"],
    ["3–11 months", "Partial year", "Annualized with a seasonal shape factor built from full-year peers in the same climate zone — never a flat ×12.", AMBER, WHITE],
    ["12+ months", "Full year", "Used as-is, full confidence. Any consistent start month qualifies — calendar alignment doesn't matter, coverage length does.", FOREST, WHITE],
  ];
  let x = 0.6;
  tiers.forEach((t) => {
    const w = 3.95;
    s.addShape("roundRect", { x, y: 2.35, w: w - 0.15, h: 3.9, rectRadius: 0.1, fill: { color: t[3] }, line: { type: "none" } });
    s.addText(t[0], { x: x + 0.28, y: 2.6, w: w - 0.7, h: 0.4, fontFace: "Cambria", fontSize: 18, bold: true, color: t[4], margin: 0 });
    s.addText(t[1].toUpperCase(), { x: x + 0.28, y: 3.0, w: w - 0.7, h: 0.3, fontFace: "Calibri", fontSize: 11, bold: true, charSpacing: 1.5, color: t[4], margin: 0 });
    s.addText(t[2], { x: x + 0.28, y: 3.5, w: w - 0.6, h: 2.6, fontFace: "Calibri", fontSize: 12.5, color: t[4], margin: 0, lineSpacingMultiple: 1.3 });
    x += w;
  });
  pageNum(s, 5);
}

// ---------- 6. Energy module: tiers ----------
{
  const s = baseSlide(pres);
  kicker(s, "Module 1 of 2");
  title(s, "Energy — the most-precedented module");
  const rows = [
    [{ text: "", options: { fill: { color: FOREST } } },
     { text: "Tier 1 · Estimate", options: { bold: true, color: WHITE, fill: { color: FOREST } } },
     { text: "Tier 2 · Actual", options: { bold: true, color: WHITE, fill: { color: FOREST } } },
     { text: "Tier 3 · Granular", options: { bold: true, color: WHITE, fill: { color: FOREST } } }],
    [{ text: "Input", options: { bold: true } }, "Floor area + students", "Annual bill totals per meter", "Monthly, multi-meter"],
    [{ text: "Formula", options: { bold: true } }, "Peer-median proxy", "EUI-S1 = (kWh + 0.92×CHW) / GCFA", "Same, weather-normalized"],
    [{ text: "Confidence", options: { bold: true } }, "Wide range", "Moderate range", "Narrow range"],
  ].map((r, i) => (i === 0 ? r : r.map((c, j) => (j === 0 ? c : { text: c, options: { color: INK, fill: { color: i % 2 ? WHITE : SAGE_LIGHT } } }))));
  s.addTable(rows, {
    x: 0.6, y: 1.65, w: 12.1, h: 2.6,
    fontFace: "Calibri", fontSize: 12.5, valign: "middle",
    border: { type: "solid", color: "E4E9E6", pt: 0.75 },
    autoPage: false, colW: [1.9, 3.4, 3.6, 3.2],
    rowH: [0.55, 0.62, 0.62, 0.62],
  });
  s.addText("Real Dubai reference numbers (EmiratesGBC, used to seed peer curves before this platform has its own cohort)", {
    x: 0.6, y: 4.55, w: 11.8, h: 0.35, fontFace: "Calibri", fontSize: 12.5, bold: true, color: FOREST, margin: 0,
  });
  const refs = [["134", "kWh/m2/yr median"], ["<92", "best performers"], [">233", "worst performers"], ["2,423", "kWh/student/yr median"]];
  let rx = 0.6;
  refs.forEach((r) => {
    s.addText(r[0], { x: rx, y: 5.0, w: 2.85, h: 0.75, fontFace: "Cambria", fontSize: 28, bold: true, color: FOREST, margin: 0 });
    s.addText(r[1], { x: rx, y: 5.72, w: 2.85, h: 0.5, fontFace: "Calibri", fontSize: 11.5, color: MUTED, margin: 0 });
    rx += 3.0;
  });
  pageNum(s, 6);
}

// ---------- 7. Energy module: how data gets in ----------
{
  const s = baseSlide(pres);
  kicker(s, "Module 1 of 2");
  title(s, "Three ways to add energy data");
  const cols = [
    ["Upload a bill", "PDF or photo. AI extracts every field, but nothing saves until a human confirms it — ambiguous fields (consumption vs. demand charge) are flagged with the reasoning, not just a confidence score.", true],
    ["Import CSV or Excel", "Guided to the school's own utility portal export, with explicit column mapping shown before import so mismatched headers don't silently misalign.", false],
    ["Enter manually", "One meter reading at a time — always with an explicit period start and end date, regardless of entry method.", false],
  ];
  let x = 0.6;
  cols.forEach((c) => {
    const w = 3.95;
    s.addShape("roundRect", { x, y: 1.7, w: w - 0.15, h: 3.35, rectRadius: 0.1, fill: { color: c[2] ? FOREST : SAGE_LIGHT }, line: { type: "none" } });
    if (c[2]) {
      s.addText("RECOMMENDED", { x: x + 0.28, y: 1.92, w: w - 0.6, h: 0.3, fontFace: "Calibri", fontSize: 10, bold: true, charSpacing: 1.5, color: AMBER, margin: 0 });
    }
    s.addText(c[0], { x: x + 0.28, y: c[2] ? 2.25 : 1.98, w: w - 0.6, h: 0.5, fontFace: "Cambria", fontSize: 17, bold: true, color: c[2] ? WHITE : FOREST, margin: 0 });
    s.addText(c[1], { x: x + 0.28, y: c[2] ? 2.8 : 2.55, w: w - 0.55, h: 2.1, fontFace: "Calibri", fontSize: 12, color: c[2] ? "D9E6DF" : "2E4C3F", margin: 0, lineSpacingMultiple: 1.3 });
    x += w;
  });
  s.addText("Every entry — AI-read, imported, or typed — carries a period start/end date and a source tag, so provenance stays visible after saving.", {
    x: 0.6, y: 5.35, w: 11.8, h: 0.6, fontFace: "Calibri", fontSize: 13, italic: true, color: MUTED, margin: 0,
  });
  pageNum(s, 7);
}

// ---------- 8. Transportation module ----------
{
  const s = baseSlide(pres);
  kicker(s, "Module 2 of 2");
  title(s, "Transportation — no precedent to copy");
  s.addText("No GBC program anywhere benchmarks school commuting. The formula is adapted from GHG Protocol Scope 3 employee commuting — aggregated, so carpools and siblings are never double-counted.", {
    x: 0.6, y: 1.5, w: 11.8, h: 0.75, fontFace: "Calibri", fontSize: 14, color: MUTED, margin: 0, lineSpacingMultiple: 1.25,
  });
  s.addShape("roundRect", { x: 0.6, y: 2.4, w: 12.1, h: 1.05, rectRadius: 0.1, fill: { color: FOREST_DARK }, line: { type: "none" } });
  s.addText("emissions  =  Σ  ( students in mode ÷ average occupancy )  ×  average distance  ×  emission factor", {
    x: 0.9, y: 2.4, w: 11.5, h: 1.05, fontFace: "Cambria", fontSize: 16, italic: true, color: WHITE, margin: 0, valign: "middle",
  });
  const cards = [
    ["Survey, not tracking", "Two questions — mode and postcode. Occupancy factors come from postcode clustering, never from linking named students together."],
    ["A response-rate gate", "Below 60% response, the result stays Tier 1, regardless of raw response count — enforced in the product, not just policy."],
    ["Fleet handled separately", "Bus fleet fuel and mileage are Scope 1, own vehicles — no occupancy adjustment needed, unlike family drop-offs."],
  ];
  let x = 0.6;
  cards.forEach((c) => {
    const w = 3.95;
    s.addShape("roundRect", { x, y: 3.75, w: w - 0.15, h: 3.3, rectRadius: 0.1, fill: { color: SAGE_LIGHT }, line: { type: "none" } });
    s.addText(c[0], { x: x + 0.25, y: 3.98, w: w - 0.55, h: 0.55, fontFace: "Cambria", fontSize: 15.5, bold: true, color: FOREST, margin: 0 });
    s.addText(c[1], { x: x + 0.25, y: 4.55, w: w - 0.55, h: 2.3, fontFace: "Calibri", fontSize: 12.5, color: "2E4C3F", margin: 0, lineSpacingMultiple: 1.3 });
    x += w;
  });
  pageNum(s, 8);
}

// ---------- 9. Full site flow ----------
{
  const s = baseSlide(pres);
  kicker(s, "Putting it together");
  title(s, "The site, beginning to end");
  const steps = ["Landing", "Onboarding", "Profile\n& units", "Dashboard", "Modules\n(Energy, Transport…)", "Benchmarking", "Report\nexport"];
  const w = 1.66, gap = 0.14, y = 2.6, h = 1.5;
  let x = 0.6;
  steps.forEach((st, i) => {
    s.addShape("roundRect", { x, y, w, h, rectRadius: 0.09, fill: { color: i % 2 ? FOREST : SAGE }, line: { type: "none" } });
    s.addText(st, { x: x + 0.08, y, w: w - 0.16, h, align: "center", valign: "middle", fontFace: "Calibri", fontSize: 11.5, bold: true, color: WHITE, margin: 0 });
    if (i < steps.length - 1) {
      s.addText("→", { x: x + w, y, w: gap + 0.35, h, align: "center", valign: "middle", fontFace: "Calibri", fontSize: 16, bold: true, color: MUTED, margin: 0 });
    }
    x += w + gap + 0.35;
  });
  s.addText("A tier badge introduced on the dashboard carries through to the benchmarking leaderboard and the report-export checklist — a school always knows which numbers are solid enough to publish.", {
    x: 0.6, y: 4.7, w: 11.8, h: 0.9, fontFace: "Calibri", fontSize: 14, color: MUTED, margin: 0, lineSpacingMultiple: 1.3,
  });
  s.addShape("roundRect", { x: 0.6, y: 5.75, w: 12.1, h: 1.1, rectRadius: 0.1, fill: { color: SAGE_LIGHT }, line: { type: "none" } });
  s.addText("The crowdsourced flywheel: schools contribute data at whatever tier they can, and get back a live peer percentile — continuously updated as more schools join. EmiratesGBC's one-time 121-property study, made ongoing and self-service.", {
    x: 0.95, y: 5.75, w: 11.4, h: 1.1, fontFace: "Cambria", fontSize: 13.5, italic: true, color: "1E4335", margin: 0, valign: "middle", lineSpacingMultiple: 1.25,
  });
  pageNum(s, 9);
}

// ---------- 10. Status ----------
{
  const s = baseSlide(pres, { dark: true });
  kicker(s, "Where things stand", { dark: true });
  title(s, "Done, and what's next", { dark: true });
  s.addText("DESIGNED", { x: 0.6, y: 1.6, w: 5.8, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true, charSpacing: 1.5, color: SAGE, margin: 0 });
  const done = [
    "Original tool audited and verified working",
    "Breadth × depth product framework",
    "International methodology research, 5 programs",
    "Time-dimension reconciliation",
    "Energy module — methodology, tiers, entry & output UI",
    "Transportation module — methodology, tiers, survey design",
    "Full site flow — landing to report export",
  ];
  s.addText(done.map((d) => ({ text: d, options: { bullet: { code: "2713" }, breakLine: true, paraSpaceAfter: 10 } })), {
    x: 0.6, y: 2.05, w: 5.9, h: 4.9, fontFace: "Calibri", fontSize: 13.5, color: "E6EFEA", margin: 0,
  });
  s.addText("NOT YET DESIGNED", { x: 6.9, y: 1.6, w: 5.8, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true, charSpacing: 1.5, color: AMBER, margin: 0 });
  const todo = [
    "Water module (reuses most of Energy's pattern)",
    "Digital module — re-skin existing engine into tiers",
    "Waste & food module",
    "Authentication & multi-user per school",
    "Cold-start behavior with zero peers in a group",
  ];
  s.addText(todo.map((d) => ({ text: d, options: { bullet: { code: "25CB" }, breakLine: true, paraSpaceAfter: 10 } })), {
    x: 6.9, y: 2.05, w: 5.9, h: 4.9, fontFace: "Calibri", fontSize: 13.5, color: "C9D9D0", margin: 0,
  });
  pageNum(s, 10, true);
}

pres.writeFile({ fileName: "carbon-platform-plan.pptx" }).then(() => console.log("done"));
