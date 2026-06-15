## 1. Save-edits API

- [x] 1.1 `PUT /api/applications/[offerId]/route.ts` (Node runtime): parse body, validate as `ApplicationContent` with the existing zod schema, upsert via `saveApplication`; reject invalid bodies with a clear 422 message
- [x] 1.2 Confirm the four downloads re-render from the saved content (already render from stored content — verify after an edit)

## 2. Offer detail page (server)

- [x] 2.1 `app/offres/[id]/page.tsx`: load offer via `getOffer` (clear "offre introuvable" if absent) + any stored application via `getApplication`; show offer fields (title, company, location, contract, salary, date, score, source link) and whether an application exists
- [x] 2.2 Render the generated CV + letter (read-only view) when an application exists; show download links for the 4 files
- [x] 2.3 Add a back link to `/offres`

## 3. Generate + edit (client)

- [x] 3.1 "Générer" action reusing `POST /api/applications/generate` (offerId) then `router.refresh()`; surface a clear message when the provider is unavailable
- [x] 3.2 `app/offres/[id]/editor.tsx` (client): inline-edit headline, summary, experiences + highlights, skills, languages, letter paragraphs (arrays as newline/comma text); save via `PUT`; `router.refresh()` after save; show validation errors

## 4. List wiring & wrap-up

- [x] 4.1 Wire `/offres`: each offer row links to `/offres/[id]`
- [x] 4.2 Manually verify: open detail → generate → edit + save → re-download reflects edits; invalid edit is rejected; missing offer shows a clear message
- [x] 4.3 Confirm `npm run build` succeeds with no type errors
