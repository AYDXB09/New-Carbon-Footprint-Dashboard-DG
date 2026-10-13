# Privacy Policy

**Last updated: October 13, 2026**

This policy explains what CarbonTally collects, why, and who else touches it. CarbonTally is a
small, independently run, **pre-launch** project — this describes what the software actually does
today, not generic boilerplate, and it will be updated before anything changes.

## 1. What we collect

**Your account.** Your email address, so we can send you a one-time sign-in link. There are no
passwords — sign-in is handled entirely by our authentication provider, Supabase Auth.

**Your school's profile.** What you enter, or confirm, about the school: its name, type, address,
city, region, country and website; a map location (latitude/longitude) and a climate zone derived
from it; enrolment, staff, boarding and floor-area figures; the grade range; and your preferred
units. For each detail we also keep whether you typed it, it was detected from the school's
website and not yet confirmed, or it was detected and you confirmed it.

**Contacts you add.** Up to two people per school, each with a name, job title, email address and
phone number. These are other people's details, so only add someone who expects to be listed.

**Your readings.** For each part of the service you use (energy, water, waste, school-vehicle
fuel): the meters, waste streams or vehicle groups you register (a name and an optional reference
number), the readings you log for them (a start date, an end date and a quantity, and whether it
was typed in, imported from a CSV file or read from a bill), and the reports the calculation
produces from those readings. A CSV file you import is read inside your browser; the file itself is
never uploaded, and only the rows you confirm are saved.

**What we do not collect.** We do not keep bills, photos or documents: if you use **Read a bill**
(section 2), the file is read and discarded, and we keep only the figures you confirm. We never ask
for, or save, account or billing numbers, names, addresses or amounts from a bill. No student
information of any kind — the travel-survey feature is designed but not built.

## 2. The two AI features

### 2a. The website look-up

If you type your school's website into **Look up** on the profile page, a function on our server:

1. fetches the school's public homepage and up to three of its contact or location pages;
2. sends the visible text of those pages (at most about 33,000 characters in total) to **Google's Gemini API**
   to extract the school's name, a contact email, a country and its campus addresses;
3. sends each extracted address (or an embedded map coordinate) to **Mapbox** to find its location.

Neither Google nor Mapbox is sent your email address or any account identifier — only text from a
public web page and the address derived from it. Everything it finds is shown as **unconfirmed**
until you confirm it; nothing is saved to your profile without you. The function's logs record the
website address and what was extracted from it (public information about the school). How long
Google keeps requests, and whether it may use them to improve its models, is governed by Google's
own terms for the Gemini API tier in use — we have not configured anything to change that.

### 2b. Read a bill

If you use **Read a bill** on the Energy or Water page, your browser sends the PDF or photo you
choose to a function on our server, which passes it to **Google's Gemini API** to read. The
request asks for only the billing period, the quantity and its unit, and the meter number. We do
not store the file, and the function's logs record only that a request happened and how many
readings came back, never the contents. The figures are shown to you next to the original file,
and nothing is saved until you confirm them.

**Be aware:** a bill often prints an account number, a name, an address and amounts. We do not ask
for them and never receive or keep them, but they are on the file Google reads. Cover or crop them
first if you would rather Google did not see them. How long Google keeps requests, and whether it
may use them to improve its models, is governed by Google's terms for the Gemini API tier in use,
which is currently a standard, non-enterprise key; we have not configured anything to change that.

## 3. Services that handle your data

| Service | What it does here |
|---|---|
| **Supabase** | Database, sign-in, sign-in emails and the server function. The database is hosted in Southeast Asia (Singapore); the server function runs on Supabase's edge network. |
| **Google (Gemini API)** | Reads public school-website text for the look-up (2a) and, if you use it, the bills you upload (2b). |
| **Google Fonts** | Serves this site's typefaces. Loading any page sends your IP address and browser details to Google, as with any site that uses it. |
| **Mapbox** | Finds a location from an address (server side), and draws the map on your profile page (in your browser, which sends Mapbox your IP address, the map area being viewed and Mapbox's own usage telemetry). |
| **GitHub** | Hosts the source code and runs a scheduled job that sends a public request to the database to keep it awake. That job contains no user data. |

We do not sell your data, share it for advertising, or use it for anything other than running the
service.

## 4. Cookies and browser storage

The app sets no cookies of its own and contains **no analytics, advertising or tracking** (checked
in the code). Your browser's local storage holds two things: your Supabase sign-in session, so you
stay signed in, and your text-size preference.

## 5. Keeping and deleting data

Your data is kept while your account exists. You can delete it yourself at any time from
**School profile → Danger zone**. This is immediate and cannot be undone. It removes your login and
**every school where you are the only member**, together with that school's contacts, meters,
readings, reports and settings. If a school has other members, it stays for them — only your
membership is removed, and its settings are no longer attributed to you. Database backups, if any, follow our hosting
provider's own retention.

## 6. Who this is for

CarbonTally is a tool for school staff and administrators. It is not directed at children and
collects no student data.

## 7. Security

Every table is protected by row-level security, so a signed-in user can only reach the schools
they belong to. The key in the browser is a publishable one, safe to expose by design; secret keys
stay on the server. No system is perfectly secure — if you believe your account was accessed by
someone else, tell us straight away.

## 8. Your choices and requests

You can edit or remove anything in your profile at any time, and delete your account as described
above. To ask for a copy of your data, or for help deleting something you cannot reach, use the route in
section 10.

## 9. Changes

If this policy changes in a meaningful way we will update the date at the top, and — because
CarbonTally is pre-launch — it will be revised before launch to describe the live service.

## 10. Contact

There is no support form yet; one will be added before launch. Until then, open an issue on the
[project repository](https://github.com/AYDXB09/New-Carbon-Footprint-Dashboard-DG/issues) to ask a
question about this policy or to make a data request. Issues are public, so do not put personal
information in one — say what you need and we will arrange a private way to continue.
