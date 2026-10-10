# CarbonTally

![Status](https://img.shields.io/badge/status-pre--launch-B8481F)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

> [!NOTE]
> **Pre-launch, local-only.** CarbonTally is a multi-tenant rebuild of an earlier single-school
> calculator (see [The original calculator](#the-original-calculator)). There is no hosted site yet.
> Today it has a landing page, passwordless sign-in, a school profile, and **one working module —
> Energy**. Of the nine items in the app's sidebar, two are real; the other seven are tagged
> "Soon" and are designed, not built. The figures on the landing-page dashboard are illustrative.

Carbon-accounting tools tend to hand a whole school one score, so a campus with twelve months of
half-hourly meter data and no travel survey is judged as if both were equally well known.
**CarbonTally keeps them apart.** Each category — energy, water, transportation, digital, waste —
sits at **its own data tier**, and every figure comes back as a **range** whose width is the honest
measure of how well it is known, instead of one tidy number that hides the guesswork.

## Contents

[Screenshots](#screenshots) · [What works today](#what-works-today) · [Real examples](#real-examples) ·
[How a number gets made](#how-a-number-gets-made) · [Status and known gaps](#status-and-known-gaps) ·
[Tech stack](#tech-stack) · [Data model](#data-model) · [Running locally](#running-locally) ·
[The original calculator](#the-original-calculator) · [Privacy, terms, licence](#privacy-terms-licence)

## Screenshots

<p align="center"><img src="docs/screenshots/landing-hero.png" alt="CarbonTally landing page: headline, sidebar menu, and a chart of five categories with confidence ranges that widen as the data tier gets weaker" width="900"></p>

<p align="center"><img src="docs/screenshots/landing-tiers.png" alt="Five category cards — Energy, Water, Transportation, Digital, Waste & food — each with three data tiers; Energy is solid, the unbuilt ones dashed" width="900"></p>

<p align="center"><img src="docs/screenshots/landing-dashboard.png" alt="A sample school's footprint as a total with a 90% range, then one bar per category whose width shows its uncertainty; peer standing shown as locked" width="900"></p>

<p align="center"><sub>The dashboard above is a <b>sample school with illustrative figures</b> — Northfield Academy is fictional.</sub></p>

<p align="center"><img src="docs/screenshots/landing-method.png" alt="Four method cards: give the period not the year, get the data in three ways, convert once at the door, simulate then report the spread" width="900"></p>

<p align="center"><img src="docs/screenshots/login.png" alt="Passwordless sign-in: one email field and a send-link button, with links to the Terms and Privacy Policy" width="640"></p>

The signed-in pages (school profile, Energy) are not pictured: they need a real sign-in, and they have
not been screenshotted yet.

## What works today

- **Passwordless sign-in.** A one-time email link through Supabase Auth — no passwords stored. Every
  table is protected by row-level security, so a user only ever reaches the schools they belong to.
- **School profile with a confirm-before-save website look-up.** Paste a school's website; a server
  function reads its contact and location pages, an AI model extracts the name, email and campus
  addresses, and Mapbox places them. Everything arrives as *unconfirmed*, and each field records
  whether it was typed, detected, or detected and confirmed.
- **Energy module (Tier 2).** Register a meter, log a reading with explicit start and end dates, and
  get a Monte Carlo result — p10 / median / p90 tCO₂e — with a sourced derivation trace.
- **Reproducible, snapshotted reports.** A saved report stores its random seed, iteration count,
  factor version and the school-size figures it was computed against, so it can be regenerated and
  normalised later even if the school's profile changes.
- **A sourced emission-factor library.** Every factor carries its publisher, vintage, last-verified and
  review-due dates and its own uncertainty. A database function chooses the default — the most
  specific geographic match first (utility grid or country, then region, then global), and the newest
  vintage only to break ties *within* that level — instead of whichever source was cited first.
- **Light and dark themes, adjustable text size, and a mobile drawer menu.**

## Real examples

Outputs of the real engine (`runEnergySimulation`), seed 42, 10,000 iterations, for a fictional
8,000 m² school with 600 students. Same inputs and same seed always return the same result — a test
asserts it.

| Input | Result | What it shows |
|---|---|---|
| **1,109,200 kWh**, 1 Sep 2025 – 31 Aug 2026; UAE grid factor 0.3582 kgCO₂e/kWh (IEA 2025, ±10 %) | **397.1 tCO₂e** (p10 350.6 – p90 451.7) · 138.7 kWh/m² · 1,849 kWh/student · 49.6 kgCO₂e/m² | The headline case: a full year, a regional factor, consumption taken as metered |
| The same readings with the global factor 0.473 (Ember 2024, ±20 %) | **524.2 tCO₂e** (409.2 – 676.7) | The factor's source moves the answer by about a third and doubles the band — which is why the source is shown and switchable |
| **480,000 kWh**, 1 Sep 2025 – 31 Jan 2026 (5 months) | 171.9 tCO₂e (151.7 – 195.4), flagged **partial period** | Never multiplied up to a year; the intensities cover only the period measured |
| **700,000 kWh** Sep–Mar plus **400,000 kWh** May–Aug (April missing) | 393.8 tCO₂e (347.7 – 447.9) · 335 of 365 days covered · gap 1–30 Apr 2026 | A missing month is reported as a gap, not hidden by adding up period lengths |

## How a number gets made

These are the design choices in `web/src/lib/engine/`, each pinned by a test (49 engine tests; `npm test`
runs 51 in all, including two that stop the in-app legal text drifting from `docs/`):

- **At Tier 2 only the factor is uncertain.** A metered reading is a reading, not an estimate, so the
  band comes from the factor's published uncertainty. At Tier 1, consumption would itself be estimated
  and the band widens on its own — *the width is the confidence score*; there is no separate score to
  argue about.
- **Log-normal, not normal.** An emission factor is strictly positive, and a normal distribution at wide
  uncertainty samples negatives. It is parameterised so the distribution's *median* is exactly the
  published value. A test asserts no negative draw at 60 % uncertainty.
- **Coverage by merging intervals, not summing lengths.** Summing would inflate past 100 % on a re-issued
  overlapping bill and would hide gaps entirely, so eleven months with March missing would look the same
  as eleven consecutive months. Overlap raises a double-counting warning.
- **Partial periods are flagged, never annualised.** Doing that honestly needs a seasonal shape built
  from peer schools' data, which doesn't exist yet.
- **Seeded.** A small deterministic generator (mulberry32) means a stored report can be regenerated
  exactly.

## Status and known gaps

| Area | State |
|---|---|
| Landing page, sign-in, school profile, Energy | **Built.** The signed-in screens are the least battle-tested part: they have not had a full end-to-end walkthrough yet. |
| Self-service account deletion | **Written, not applied or tested.** `supabase/migrations/0012_delete_own_account.sql` and a test script are in the repo, and the Profile page has the button; the migration must be applied to a project first. |
| Water, Transportation, Digital, Waste, Dashboard, Benchmarking, Reports | **Not built** — tagged "Soon" in the sidebar, each opens an honest placeholder. |
| AI bill upload, CSV import | **Designed, not built.** The bill-upload design never stores the file and always routes extraction through a human review step. |
| Peer benchmarking | **Deliberately off** until a real cohort of comparable schools exists. |
| Emission factors | Two example grid factors are seeded (UAE, IEA 2025; global, Ember 2024). The Ember figure was confirmed from secondary summaries because the primary page blocked automated fetching — its row says so. No utility-specific factor is included: its number could not be verified from a primary source, so none was invented. |

## Tech stack

**Frontend** — React 19, TypeScript, Vite, React Router, Mapbox GL JS, `marked` (renders the policies)
**Backend** — Supabase: Postgres with row-level security, Auth (magic link), one Edge Function (Deno)
**AI** — Google Gemini, used for exactly one thing: extracting a school's name, email and addresses from its public website, always shown as unconfirmed
**Integrations** — Mapbox geocoding, Google Fonts
**Quality** — Vitest (51 tests), oxlint, `tsc -b`
**Automation** — a scheduled GitHub Action (`supabase-keepalive.yml`) that queries the database every ~5 days, because free-tier Supabase projects pause after about a week of inactivity — which has already happened twice

## Data model

Nine tables in `public`, all with row-level security: `schools`, `school_members`, `school_contacts`,
`school_modules`, `meters`, `meter_log`, `reports`, `emission_factors`, `school_factor_choices`.
The schema lives entirely in [`supabase/migrations/`](supabase/migrations) (0001–0012) — nothing was
configured by hand in a dashboard, so it can be replayed onto a fresh project.

## Running locally

<details>
<summary><b>Setup commands</b> (click to expand)</summary>

You need Node and a Supabase project.

```bash
git clone https://github.com/AYDXB09/New-Carbon-Footprint-Dashboard-DG.git
cd New-Carbon-Footprint-Dashboard-DG/web
npm install
cp .env.example .env.local     # then fill in the three values
npm run dev                    # http://localhost:5173
npm test                       # 51 tests
npm run build                  # type-check + production build
```

**Supabase side**

1. Run the migrations in `supabase/migrations/` in order (`0001` → `0011`) in the SQL editor, or with the Supabase CLI. `0012` (account deletion) is optional — read its header first.
2. Authentication → URL Configuration: add `http://localhost:5173/**` to the allowed redirect URLs. Sign-in links redirect to `/profile`.
3. Deploy the look-up function and give it its secrets:
   ```bash
   supabase functions deploy school-lookup
   supabase secrets set GEMINI_API_KEY=… MAPBOX_TOKEN=…
   ```
4. Free tier only: edit the project URL and key in `.github/workflows/supabase-keepalive.yml` to your own, or the project will pause when idle.

</details>

## The original calculator

Before the rebuild this repository was a single-page, client-side greenhouse-gas calculator for one
online school: upload a CSV of device hours, video-call sessions and learning-platform activity, run a
Monte Carlo simulation, export a PDF. Its files are still at the repository root — `index.html`,
`app.js`, `charts.js`, `styles.css` and `sample-data.csv` — kept as-is for reference and not part of
the new app. `landing.html` is a static mockup from an earlier visual direction.

## Privacy, terms, licence

[Privacy Policy](docs/PRIVACY.md) · [Terms of Service](docs/TERMS.md) · both are also served in the
app at `/privacy` and `/terms`. Released under the [MIT License](LICENSE).
