## Context

Small addition to `email-handoff`: a Gmail-specific compose link beside the existing `mailto:` and `.eml` actions on `/offres/[id]`. Reuses the deterministic `EmailDraft` (recipient/subject/body) already built by `buildDraft`.

## Goals / Non-Goals

**Goals:** open the pre-filled draft directly in Gmail web compose, independent of the OS/browser default mail handler.

**Non-Goals:** carrying attachments via the link (impossible in Gmail web compose — the `.eml` covers that); auto-send; supporting other webmail providers.

## Decisions

### Gmail compose URL from the shared draft
`gmailComposeUrl(draft)` returns `https://mail.google.com/mail/?view=cm&fs=1&to=<enc>&su=<enc>&body=<enc>` with `encodeURIComponent` on each field (recipient may be empty). The button opens it in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). *Why:* `view=cm&fs=1` is Gmail's documented compose-window deep link; one helper mirrors `mailtoUrl`.

### Keep all three actions
mailto (default client), Gmail (web), and `.eml` (attachments) coexist; the user picks. *Why:* different setups; no behaviour removed.

## Risks / Trade-offs

- Requires the user to be logged into Gmail in the browser — expected for the target user; otherwise Gmail prompts for login then opens compose.
- No attachments via the link — unchanged from `mailto:`; the existing note + `.eml` cover it.

## Migration Plan

- Additive: one helper + one button. No schema/route change. Rollback = discard the change dir.
