// Groundwork — school-lookup Edge Function
//
// Given a school's website URL: fetches the homepage server-side, finds and
// fetches EVERY plausible Contact/Location-page link on it (not just the
// single top-ranked one — real sites often split "Contact Us", which may
// have no address at all, from a separate "School Location" page that does;
// picking only one candidate missed the real page for Dwight School Dubai
// in testing). Scans all fetched pages for an embedded Google Maps pin
// (many location pages embed one with exact coordinates, far more reliable
// than geocoding a district-level address string), asks Gemini to extract
// every physical campus address mentioned, then geocodes/reverse-geocodes
// via Mapbox. Returns everything as "detected" data for the frontend to
// show as unconfirmed, and as a list to choose from when there's more than
// one campus.
//
// Requires GEMINI_API_KEY and MAPBOX_TOKEN secrets on this project.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-3.6-flash";
const USER_AGENT = "GroundworkSchoolLookup/0.3 (+https://groundwork.example)";
const MAX_CANDIDATE_PAGES = 3;

// Link text/href keywords that suggest "this page might have our real
// address" — every match gets fetched now, not just the highest-scoring one.
const CONTACT_PAGE_HINTS = [
  "contact",
  "location",
  "locations",
  "find-us",
  "find us",
  "visit-us",
  "visit us",
  "campus",
  "campuses",
  "get-in-touch",
  "get in touch",
  "about-us",
  "about us",
];

type LocationCandidate = {
  label?: string;
  address_text: string;
};

type ExtractResult = {
  name?: string;
  contact_email?: string;
  country_code?: string;
  locations?: LocationCandidate[];
};

type MapboxFeature = {
  center: [number, number]; // [lon, lat]
  context?: Array<{ id: string; text?: string; short_code?: string }>;
};

function placeFromFeature(feature: MapboxFeature): string | undefined {
  return feature.context?.find((c) => c.id.startsWith("place"))?.text;
}
function regionFromFeature(feature: MapboxFeature): string | undefined {
  return feature.context?.find((c) => c.id.startsWith("region"))?.text;
}
function countryCodeFromFeature(feature: MapboxFeature): string | undefined {
  return feature.context?.find((c) => c.id.startsWith("country"))?.short_code?.toUpperCase();
}

function climateZoneFromLatitude(lat: number): string {
  const abs = Math.abs(lat);
  if (abs > 55) return "cold";
  if (abs > 35) return "temperate";
  if (abs > 23.5) return "warm";
  return "hot";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
  return res.text();
}

/** Finds every plausible Contact/Location page link on the homepage. */
function findCandidatePageUrls(homepageHtml: string, baseUrl: string, limit: number): string[] {
  const anchorRe = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const scored = new Map<string, number>();
  let match: RegExpExecArray | null;

  while ((match = anchorRe.exec(homepageHtml))) {
    const href = match[1];
    const text = htmlToText(match[2]).toLowerCase();
    const combined = `${href.toLowerCase()} ${text}`;

    const hintIndex = CONTACT_PAGE_HINTS.findIndex((hint) => combined.includes(hint));
    if (hintIndex === -1) continue;

    const score = CONTACT_PAGE_HINTS.length - hintIndex;
    try {
      const resolved = new URL(href, baseUrl).toString();
      if (resolved === baseUrl) continue;
      scored.set(resolved, Math.max(scored.get(resolved) ?? 0, score));
    } catch {
      // malformed href, skip
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([url]) => url);
}

/**
 * Looks for an embedded Google Maps pin across ALL fetched pages, checking
 * the most precise pattern type across every page before ever falling back
 * to a weaker one. Getting this ordering wrong is a real bug that shipped
 * once already: checking page-by-page with an early return meant a generic
 * "get directions" link in the site's shared footer (?ll=..., present on
 * every page, imprecise) won over the one page's actual embedded Maps
 * iframe (!2d..!3d.., exact) purely because the footer link's page happened
 * to be checked first. Precision of the pattern must outrank which page it
 * was found on.
 */
function extractEmbeddedMapCoords(htmls: string[]): { lat: number; lng: number } | null {
  // Tier 1: Google Maps embed "pb" param — ...!2d<lng>!3d<lat>... — this is
  // an actual placed pin (often a named Place), the most trustworthy format.
  for (const html of htmls) {
    const m = html.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
    if (m) return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  // Tier 2: share-link format .../@<lat>,<lng>,<zoom>z
  for (const html of htmls) {
    const m = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+),\d+(?:\.\d+)?z/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  // Tier 3: generic ?ll=<lat>,<lng> or ?q=<lat>,<lng> — often just a
  // "get directions from here" widget, least precise of the three.
  for (const html of htmls) {
    const m = html.match(/[?&](?:ll|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

async function extractWithGemini(pageText: string, apiKey: string): Promise<ExtractResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "This text is from a school's website — its homepage and one or more " +
                  "Contact/Location pages. Extract the school's name, a contact email, an " +
                  "ISO 3166-1 alpha-2 country code, and a list of every distinct PHYSICAL " +
                  "CAMPUS ADDRESS mentioned. Many schools have more than one campus/branch — " +
                  "list each one separately with its own address_text, and give it a short " +
                  "label (e.g. the campus or district name) if the page distinguishes them. " +
                  "If there is only one campus, return a single-item list with no label. " +
                  "Never merge two locations into one address, and omit a field entirely " +
                  "rather than guessing or fabricating a value.\n\n" + pageText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "The school's official name" },
              contact_email: {
                type: "STRING",
                description: "A general/facilities/admin contact email, if present",
              },
              country_code: {
                type: "STRING",
                description: "ISO 3166-1 alpha-2 country code inferred from the address(es)",
              },
              locations: {
                type: "ARRAY",
                description: "Every distinct physical campus address mentioned",
                items: {
                  type: "OBJECT",
                  properties: {
                    label: {
                      type: "STRING",
                      description: "Campus/branch name or district, omitted if there's only one site",
                    },
                    address_text: {
                      type: "STRING",
                      description: "Full postal address, single line, as printed on the site",
                    },
                  },
                  required: ["address_text"],
                },
              },
            },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${body}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return {};
  try {
    return JSON.parse(text) as ExtractResult;
  } catch {
    return {};
  }
}

async function forwardGeocode(query: string, mapboxToken: string): Promise<MapboxFeature | null> {
  const encoded = encodeURIComponent(query);
  const params = new URLSearchParams({ access_token: mapboxToken, limit: "1", types: "poi,address,place" });
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.features?.[0] as MapboxFeature | undefined) ?? null;
}

async function reverseGeocode(lat: number, lng: number, mapboxToken: string): Promise<MapboxFeature | null> {
  const params = new URLSearchParams({ access_token: mapboxToken, limit: "1", types: "address,place" });
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.features?.[0] as MapboxFeature | undefined) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { url: rawUrl } = await req.json();
    if (!rawUrl || typeof rawUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing `url` in request body" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const homepageUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
    const missing = [!apiKey && "GEMINI_API_KEY", !mapboxToken && "MAPBOX_TOKEN"].filter(Boolean);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error:
            `${missing.join(" and ")} not set on this project. Add ${missing.length > 1 ? "them" : "it"} under ` +
            "Project Settings -> Edge Functions -> Secrets, then retry.",
        }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const homepageHtml = await fetchHtml(homepageUrl);
    const candidateUrls = findCandidatePageUrls(homepageHtml, homepageUrl, MAX_CANDIDATE_PAGES);
    console.log(`[school-lookup] homepage=${homepageUrl} candidates=${JSON.stringify(candidateUrls)}`);

    let combinedText = htmlToText(homepageHtml).slice(0, 6000);
    const allHtml: string[] = [homepageHtml];
    const fetchedPages: string[] = [];

    for (const url of candidateUrls) {
      try {
        const html = await fetchHtml(url);
        combinedText = htmlToText(html).slice(0, 9000) + "\n\n" + combinedText;
        allHtml.push(html);
        fetchedPages.push(url);
      } catch (err) {
        // One candidate page failing shouldn't sink the whole lookup.
        console.error(`candidate page fetch failed (${url}):`, err);
      }
    }
    // Checked once across every fetched page, precise-pattern-first — see
    // extractEmbeddedMapCoords's comment for why per-page early-return was
    // wrong.
    const embeddedCoords = extractEmbeddedMapCoords(allHtml);
    console.log(
      `[school-lookup] fetchedPages=${JSON.stringify(fetchedPages)} embeddedCoords=${JSON.stringify(embeddedCoords)} combinedTextLen=${combinedText.length}`,
    );

    const extracted = await extractWithGemini(combinedText, apiKey!);
    console.log(`[school-lookup] gemini extracted=${JSON.stringify(extracted)}`);
    const rawLocations = extracted.locations ?? [];

    const locations = await Promise.all(
      rawLocations.map(async (loc) => {
        // Prefer an embedded map pin over text geocoding, but only when
        // there's a single campus — with multiple campuses we can't tell
        // which one the embed belongs to, so fall back to per-location
        // text geocoding there instead of guessing.
        if (embeddedCoords && rawLocations.length === 1) {
          const geo = await reverseGeocode(embeddedCoords.lat, embeddedCoords.lng, mapboxToken!);
          return {
            label: loc.label,
            address_text: loc.address_text,
            city: geo ? placeFromFeature(geo) : undefined,
            region: geo ? regionFromFeature(geo) : undefined,
            latitude: embeddedCoords.lat,
            longitude: embeddedCoords.lng,
            climate_zone: climateZoneFromLatitude(embeddedCoords.lat),
            country_code: (geo && countryCodeFromFeature(geo)) ?? extracted.country_code,
          };
        }

        const geo = await forwardGeocode(
          [extracted.name, loc.label, loc.address_text].filter(Boolean).join(", "),
          mapboxToken!,
        );
        const [longitude, latitude] = geo?.center ?? [undefined, undefined];
        return {
          label: loc.label,
          address_text: loc.address_text,
          city: geo ? placeFromFeature(geo) : undefined,
          region: geo ? regionFromFeature(geo) : undefined,
          latitude,
          longitude,
          climate_zone: latitude != null ? climateZoneFromLatitude(latitude) : undefined,
          country_code: (geo && countryCodeFromFeature(geo)) ?? extracted.country_code,
        };
      }),
    );

    const result = {
      name: extracted.name,
      contact_email: extracted.contact_email,
      country_code: extracted.country_code,
      pages_used: fetchedPages,
      used_embedded_map_pin: embeddedCoords != null && rawLocations.length === 1,
      locations,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("school-lookup failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
