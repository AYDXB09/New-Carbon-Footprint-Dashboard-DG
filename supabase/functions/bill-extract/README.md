# bill-extract

Reads one utility bill (PDF or photo, up to 5 MB) and returns the billing period(s),
quantity, unit and meter number printed on it, for the school to **review before anything
is saved**. It writes nothing, stores nothing and logs only a count.

- **Needs:** the project secret `GEMINI_API_KEY` (shared with `school-lookup`).
- **Deploy** (JWT verification stays on — only signed-in users can call it):

  ```bash
  supabase functions deploy bill-extract --project-ref <your-project-ref>
  ```

  Or paste `index.ts` into Supabase → Edge Functions → New function (name `bill-extract`).
- **Request:** `POST { mimeType, data (base64), module: "energy" | "water" }`
- **Response:** `{ readings: [{ meter_number?, period_start, period_end, quantity, unit, confidence, ambiguity? }], notes? }`

The file is sent to Google's Gemini API to be read. The prompt and schema ask for nothing
but the figures above — never account numbers, names, addresses or amounts — but those can
still be printed on the file Google receives, which is why the app tells the school before
upload. The key is a consumer AI Studio key; see the Privacy Policy for what that means.
