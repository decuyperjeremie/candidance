## Why

The offer page already offers a `mailto:` draft, but it opens whatever mail client is the OS/browser default — not necessarily Gmail. Tatiana uses Gmail; asking a non-technical user to register a `mailto:` protocol handler in Chrome is fragile. A direct "Ouvrir dans Gmail" action opens Gmail's compose window pre-filled, regardless of defaults.

## What Changes

- Add a **Gmail compose URL** builder: `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…` from the same draft (recipient/subject/body) used by the `mailto:` link.
- Add an **"Ouvrir dans Gmail"** action on the offer detail page next to the existing mailto + `.eml` actions (opens in a new tab).
- Same attachment caveat as `mailto:` (Gmail web compose can't attach): keep the `.eml` for the attached-documents path; the note already explains manual attachment.

## Capabilities

### Modified Capabilities
- `email-handoff`: in addition to the `mailto:` draft, the system can open the same pre-filled draft directly in Gmail's web compose; sending stays manual and no attachments are carried by the link.

## Impact

- **Modified**: `lib/email/draft.ts` (add `gmailComposeUrl(draft)`), `app/offres/[id]/page.tsx` (add the button).
- **Unchanged**: `.eml` route, mailto, status/tracking, generation, DB. No schema change.
