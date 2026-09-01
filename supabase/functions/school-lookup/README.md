# school-lookup

Given `{ "url": "https://www.someschool.edu" }`, returns detected `name`,
`address_text`, `contact_email`, `country_code`, `latitude`, `longitude`,
`climate_zone` — all to be shown as **unconfirmed** in the UI until the
school explicitly confirms each field.

## Setup (one-time, do this yourself — Claude does not enter API keys)

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. In the Supabase dashboard for this project: **Project Settings → Edge
   Functions → Secrets** → add `GEMINI_API_KEY`.
   (Or via CLI: `supabase secrets set GEMINI_API_KEY=... --project-ref zzoervdobfuvnldqaicn`)

## Notes

- Uses `gemini-2.5-flash` with a JSON response schema (structured output),
  so extraction returns typed fields rather than free text to parse.
- Geocoding uses OpenStreetMap Nominatim — free, no key, but rate-limited
  and requires a descriptive User-Agent (already set). Fine for this scale;
  revisit if lookup volume grows.
- Climate zone returned here is a coarse latitude-band heuristic, meant as a
  first guess for the school to confirm/correct — not a substitute for real
  HDD/CDD data.
- This function makes two outbound calls per request (Gemini, then
  Nominatim) plus the initial website fetch — expect it to take a few
  seconds; the frontend should show a loading state on "Look up".
- Previously used Claude/Anthropic for extraction — switched to Gemini
  2026-08-25 per Anvith's request. If switching back, the shape of
  `ExtractResult` is unchanged, only `extractWithGemini` needs replacing.
