## 1. Foundation (tokens, fonts, base CSS)

- [x] 1.1 `app/globals.css`: `:root` token custom properties (colour, type scale, spacing, radii, hairlines per design.md), a light base reset, base element styles (body, headings, links, lists), and reusable classes (`.card`, `.chip`, `.btn`, `.btn-primary`, `.section-rule`, `.muted`).
- [x] 1.2 `app/ui/tokens.ts`: TS mirror of the values logic needs (score-band colours, status colours), named to match the CSS vars.
- [x] 1.3 `app/layout.tsx`: load Fraunces (display) + Inter (body) via `next/font/google` exposing `--font-display` / `--font-body`; import `globals.css`; restyle the nav as a slim editorial header. Remove the inline dark body styles.

## 2. Apply to surfaces

- [x] 2.1 Home `app/page.tsx`: editorial restyle (kept as entry), using tokens/classes.
- [x] 2.2 Offer list `app/offres/page.tsx` + `discover-button.tsx`: calm cards, score + status chips in the new palette, restyled discover button.
- [x] 2.3 Offer detail `app/offres/[id]/page.tsx`: header, CV/letter preview, downloads, email handoff block — consistent cards/spacing/typography.
- [x] 2.4 `app/offres/[id]/editor.tsx` + `tracking.tsx` (client): restyle inputs, buttons, status chips, history to the system (behaviour unchanged).
- [x] 2.5 Tracking `app/suivi/page.tsx`: editorial table/list with calm status chips.

## 3. Verify

- [x] 3.1 `npm run build` passes with no type errors; confirm no behaviour regressions (generate/edit/save, downloads, email, status still work).
- [x] 3.2 Screenshot pass of each surface (home, /offres, /offres/[id], /suivi) for visual iteration; check WCAG AA contrast on body/primary text.
- [x] 3.3 Confirm generated CV/letter PDF/DOCX are unaffected (separate template styling).
