## Context

Second half of the final slice (`FONDATIONS.md` §7, §8 / C7 + C8), built on `review-ui` (the `/offres/[id]` detail page) and the Slice 3 pipeline (`lib/generation` persisted content, `lib/render` files). Adds sending (email handoff) and tracking (status + history) for a non-technical user. Local SQLite, no auth, manual send only.

Key constraint (`FONDATIONS.md` §9): **`mailto:` cannot carry attachments** — so we pair a pre-filled `mailto:` with a downloadable `.eml` that embeds the attachments.

## Goals / Non-Goals

**Goals:**
- Email handoff from the detail page: pre-filled `mailto:` + a `.eml` with the 4 files attached.
- Status lifecycle + event history (relances, notes); status controls on the detail page.
- `/suivi` tracking view; status surfaced in the `/offres` list.

**Non-Goals:**
- Real SMTP / auto-send; applying via sites' forms; auth/multi-user; scheduling.
- Re-running the LLM; a design-system UI.

## Decisions

### `mailto:` for the draft, `.eml` for attachments
`lib/email` builds (1) a `mailto:` URL (`subject`/`body`, recipient if the offer carries one — France Travail usually doesn't, so blank) and (2) a `.eml` (RFC 822 / `multipart/mixed`) with the same subject/body and the generated files as base64 attachments. The `.eml` is served by `GET /api/applications/[offerId]/email.eml` and downloaded; opening it yields a ready draft with attachments. *Why:* `mailto:` can't attach (§9); `.eml` is the standard, server-friendly handoff without SMTP. *Alternative rejected:* Nodemailer/SMTP — out of scope (manual send), adds secrets/infra.

### Subject/body deterministic (no LLM)
Subject = `Candidature — <offer title>`. Body = a short fixed French transmittal note referencing the role/company and pointing to the attached CV + letter (the persuasive content already lives in the generated letter attachment). Editable by the user before sending. *Why:* no need for another LLM call for a cover note.

### Hand-rolled MIME (no new dep)
The `.eml` is assembled as `multipart/mixed` with a `text/plain` body part and one base64 `application/pdf` / `...wordprocessingml.document` part per file, with `Content-Disposition: attachment; filename=...`. *Why:* small, dependency-free, fits the throwaway ethos. *Risk:* client compatibility — mitigated by standard headers + base64 with CRLF folding; `mailto:` remains the always-works fallback.

### Tracking: status on the application + an events table
Migration `0005_tracking.sql`: add `status` (default `à_traiter`) + `status_updated_at` to `applications`; new `application_events(id, offer_id FK, type [status|relance|note], note, created_at)`. Status updates write both the column and a `status` event. An offer with no `applications` row is implicitly `à_traiter`. `lib/tracking` exposes set-status (validates against the lifecycle), add-event, get-status, and list-with-status (joins offers). *Why:* status is a property of the application; history needs its own rows; SQL-only per the project's no-ORM convention. *Alternative rejected:* state-machine lib / status table — overkill.

### Routes & pages mirror existing conventions
- `app/suivi/page.tsx` (server): table of all applications (offer title, status, last update) linking to detail pages.
- API (Node runtime): `GET /api/applications/[offerId]/email.eml`, `POST /api/applications/[offerId]/status`, `POST /api/applications/[offerId]/events`.
- The `review-ui` detail page gains: download links (exist), "Préparer l'email" (mailto + `.eml`), and status/relance/note controls. The `/offres` list shows each offer's status. French status labels.

## Risks / Trade-offs

- **`.eml` attachment compatibility** varies by client → standard `multipart/mixed`, base64, correct headers; `mailto:` fallback always works (manual attach).
- **Status drift vs reality** (user forgets to update) → low stakes for a personal tool; event history + last-updated make gaps visible.
- **No auth on mutating routes** → fine for a local single-user prototype.

## Migration Plan

- Additive: migration `0005_tracking.sql`; new libs/routes/`/suivi`; additions to the existing detail + list pages. No change to earlier contracts (the `applications` row is extended; content shape unchanged).
- Deploy = run locally. Rollback = discard the change dir/branch and drop the new column/table.

## Open Questions

- **Email body wording/length** — start with a short fixed French note; refine with Tatiana.
- **Status transitions auto vs manual** — generation sets `générée`; validate/sent/relance/réponse are user-set; confirm exact transitions after first use.
