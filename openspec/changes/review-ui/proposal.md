## Why

Slices 0–3 take Tatiana from "no data" to "ATS CV + cover letter files for an offer". But she — a non-technical user — has nowhere to **review and edit** what was generated before using it. This sub-slice (`FONDATIONS.md` §7 — capability C6, first half of the final slice) adds the web review surface: an offer **detail page** where she generates the application, sees the adapted CV + letter, **edits them inline**, and **saves**. It is the foundation the send/track sub-slice (C7 + C8) builds on.

## What Changes

- Add an offer **detail page** (`/offres/[id]`) showing the offer (title, company, location, contract, salary, publication date, relevance score, source link) and the state of its application.
- **Generate from the page**: trigger the existing application-generation (zero-fabrication, ATS rendering) and display the result; clear message if the LLM provider is unavailable.
- **Inline edit + save**: edit the adapted CV (headline, summary, experiences + highlights, skills, languages) and the cover letter (paragraphs); saved edits persist and become the content used by all downloads.
- **Download** the four files (CV + letter, PDF + DOCX) from the page, reflecting the latest saved content.
- Wire the existing `/offres` list: each offer links to its detail page.

Out of scope (next sub-slice `email-and-tracking`, C7 + C8): the pre-filled email / `.eml`, the status lifecycle, and the `/suivi` tracking view. Also out of scope (whole project): SMTP/auto-send, auth/multi-user.

## Capabilities

### New Capabilities
- `review-ui`: An offer detail page that generates, displays, and inline-edits the adapted CV + cover letter, persists the edits, links to the downloads, and is reachable from the offer list.

### Modified Capabilities
<!-- None at the spec level. Consumes offer-aggregation and application-generation as-is. -->

## Impact

- **New pages**: `app/offres/[id]/page.tsx` (server) + `app/offres/[id]/editor.tsx` (client editor).
- **New API**: `PUT /api/applications/[offerId]` to validate + save edited `ApplicationContent` (Node runtime).
- **Consumes existing**: `lib/aggregation/store` (offer + `getOffer`), `lib/generation` (generate + stored content), `lib/render` (downloads already render from stored content). Reuses the existing `POST /api/applications/generate` and download routes.
- **Modified**: the `/offres` list page gains links into the detail pages.
- **Foundation for**: `email-and-tracking` (C7 + C8) — email actions and status controls attach to this detail page.
