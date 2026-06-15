## 1. Schema & tracking store

- [x] 1.1 Migration `lib/db/migrations/0005_tracking.sql`: add `status` (default `à_traiter`) + `status_updated_at` to `applications`; create `application_events` (id, offer_id FK, type [status|relance|note], note, created_at); verify via `npm run migrate`
- [x] 1.2 `lib/tracking/store.ts`: set status (validates lifecycle; writes column + a `status` event), add event (relance/note), get status, list applications with offer + status + last update; default `à_traiter` when no application row
- [x] 1.3 Set status `générée` when an application is generated (hook into `lib/generation/store` or the generate core)

## 2. Email handoff

- [x] 2.1 `lib/email/draft.ts`: deterministic subject (`Candidature — <titre>`) + short French transmittal body referencing role/company; recipient blank unless the offer carries one; expose a `mailto:` URL builder
- [x] 2.2 `lib/email/eml.ts`: build a valid RFC822 `multipart/mixed` `.eml` with the subject/body and the 4 generated files (PDF/DOCX) as base64 attachments
- [x] 2.3 `GET /api/applications/[offerId]/email.eml` (Node runtime): render files from stored content, return the `.eml` as a download; clear message if no application exists

## 3. Status & events API

- [x] 3.1 `POST /api/applications/[offerId]/status` { status }: validate against the allowed lifecycle, update + log a status event; reject invalid status
- [x] 3.2 `POST /api/applications/[offerId]/events` { type, note }: add a relance/note event (timestamped)

## 4. Detail page additions (review-ui page)

- [x] 4.1 Add "Préparer l'email" to `/offres/[id]`: the `mailto:` link (subject/body) + a download for `email.eml`; note that `mailto:` attachments are added manually
- [x] 4.2 Add status controls: show current status, set status (lifecycle), log a relance, add a note; show the event history; `router.refresh()` after each

## 5. Tracking view & list wiring

- [x] 5.1 `app/suivi/page.tsx` (server): table of all applications — offer title, status, last update — linking to each `/offres/[id]`; add a nav link to `/suivi`
- [x] 5.2 Surface each offer's application status in the `/offres` list

## 6. Verify & wrap-up

- [x] 6.1 Manually walk the flow: detail → prepare email (`.eml` opens with attachments; `mailto:` pre-filled) → set status `envoyée` → log a relance → appears in `/suivi` with correct status
- [x] 6.2 Confirm default `à_traiter` for offers without an application; invalid status rejected; `.eml` requested with no application returns a clear message
- [x] 6.3 Confirm `npm run build` succeeds with no type errors
- [x] 6.4 Update `RUNNING.md`: the send + track flow (`/offres/[id]` email + status, `/suivi`)
