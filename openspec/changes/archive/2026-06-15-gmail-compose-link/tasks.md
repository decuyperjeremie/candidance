## 1. Gmail compose URL

- [x] 1.1 `lib/email/draft.ts`: add `gmailComposeUrl(draft)` → `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…` (encodeURIComponent each field; recipient may be empty).

## 2. Detail page button

- [x] 2.1 `app/offres/[id]/page.tsx`: add an "Ouvrir dans Gmail" action in the email block (new tab, `rel="noopener noreferrer"`), next to the mailto + `.eml` actions.

## 3. Verify

- [x] 3.1 `npm run build` passes; the Gmail URL is well-formed (subject/body encoded) and opens Gmail compose pre-filled.
