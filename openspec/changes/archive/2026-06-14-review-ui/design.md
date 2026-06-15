## Context

First half of the final slice (`FONDATIONS.md` §7 / C6). Builds on the `/offres` list (server component, inline styles, dark theme) and the Slice 3 pipeline: `lib/generation` (generate + persisted `applications` row with `cv_json`/`letter_text`), `lib/render` (downloads re-render from stored content), and the existing `POST /api/applications/generate` + `GET /api/applications/[offerId]/[file]` routes. Adds the review surface for a non-technical user. The send/track features (C7 + C8) come in the next sub-slice and attach to this page.

Constraints: non-technical user; throwaway prototype; reuse the existing inline-style server-component approach (no UI library); local SQLite; no auth.

## Goals / Non-Goals

**Goals:**
- `/offres/[id]` detail page: show offer + application state; generate; display + inline-edit CV/letter; save; download.
- Edits persist to the existing `ApplicationContent` and feed all downloads (no duplicate state).
- `/offres` links into the detail page.

**Non-Goals:**
- Email handoff, `.eml`, status lifecycle, `/suivi` (next sub-slice).
- Re-running the LLM on edit (edits are the user's own text).
- A design system; SMTP; auth.

## Decisions

### Edit the persisted content; downloads re-render from it
Editing updates the existing `applications.cv_json` / `letter_text` (the `ApplicationContent`). Since downloads already re-render from stored content (Slice 3), edits flow to PDF/DOCX automatically. `PUT /api/applications/[offerId]` validates the edited `ApplicationContent` with the existing zod schema and upserts via the Slice 3 `saveApplication`. *Why:* one source of truth; no stale rendered files.

### Server page + small client editor (matches existing patterns)
`app/offres/[id]/page.tsx` is a server component (reads offer via `getOffer`, application via `getApplication`). The editor is a client component holding `ApplicationContent` in local state with plain inputs/textareas, saving via the PUT route then `router.refresh()` — mirroring the existing `DiscoverButton`. Arrays (highlights, skills, letter paragraphs) are edited as newline-separated text and re-assembled on save. *Why:* minimal, consistent, no form library. *Trade-off:* basic UX; acceptable for a prototype.

### Generation reuses the existing route
The "Générer" action calls the existing `POST /api/applications/generate` and refreshes. Provider-unavailable errors surface the route's clear message. *Why:* no duplicate generation logic.

## Risks / Trade-offs

- **Editing arrays as text** (split on newlines) is crude → clearly labelled; structured `ApplicationContent` preserved and zod-validated on save.
- **Invalid edits** → server validates with the existing schema and rejects with a message; prior content untouched.
- **No auth on the PUT route** → fine for a local single-user prototype (consistent with the app).

## Migration Plan

- Additive: new page + client editor + one API route; `/offres` gains links. No schema change (reuses the Slice 3 `applications` row). No change to Slice 0–3 contracts.
- Rollback = discard the change dir/branch.

## Open Questions

- **Editor granularity** — start with headline, summary, per-experience highlights, skills, languages, and letter paragraphs; add finer controls only if needed.
