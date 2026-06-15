## Why

After `review-ui` (C6) lets Tatiana generate, review, and edit an application on the offer detail page, two things remain to close the loop (`FONDATIONS.md` §7, §8 — capabilities C7 + C8): **sending** (hand her ready-to-send files + a pre-filled email) and **tracking** (knowing where each application stands). This final sub-slice adds both, completing the FONDATIONS roadmap.

## What Changes

- **C7 — email handoff**: from the offer detail page, prepare a **pre-filled email**. Because `mailto:` cannot carry attachments (`FONDATIONS.md` §9), provide both: a `mailto:` link pre-filling recipient (if known) + subject + body, **and** a downloadable **`.eml`** file with the generated PDF/DOCX **attached**, which opens in her mail client ready to send. Sending stays **manual** (no SMTP, no auto-send).
- **C8 — application tracking**: each application carries a **status** (`à_traiter` → `générée` → `validée` → `envoyée` → `relancée` → `réponse`) persisted with timestamps and an **event history** (status changes, relances, free-text notes). Status is updatable from the detail page.
- Add a **tracking view** (`/suivi`) listing all applications with their offer, status, and last update, linking back to each detail page; surface each offer's status in the `/offres` list.

Out of scope: real SMTP / auto-send, applying via sites' proprietary forms, auth/multi-user, scheduling.

## Capabilities

### New Capabilities
- `email-handoff`: Produce a pre-filled `mailto:` (recipient/subject/body) and a downloadable `.eml` with the generated PDF/DOCX attached, for manual sending; never sends automatically.
- `application-tracking`: Per-application status lifecycle with timestamps and an event history (status changes, relances, notes), plus a `/suivi` view over all applications.

### Modified Capabilities
<!-- None at the spec level. Builds on review-ui's detail page; the applications table is extended via a new migration. -->

## Impact

- **New DB schema**: migration extending `applications` with `status` + `status_updated_at`, and a new `application_events` table (offer_id FK, type [status|relance|note], note, created_at).
- **New routes/pages**: `/suivi` (tracking view); `GET /api/applications/[offerId]/email.eml`; `POST /api/applications/[offerId]/status`; `POST /api/applications/[offerId]/events`.
- **New files/dirs**: `lib/email/` (mailto + `.eml`/MIME builder), `lib/tracking/` (status + events store), `app/suivi/`.
- **Consumes existing**: `lib/render` (render files for the `.eml`), `lib/generation/store` (stored content + status), `lib/aggregation/store` (offers), `lib/db`. Adds email + status controls to the `review-ui` detail page.
- **Closes** the FONDATIONS roadmap.
