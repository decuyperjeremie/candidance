## 1. Deps & schema

- [x] 1.1 Add `docx`, `pdfkit`, and `@types/pdfkit` to dependencies (pure-JS, Node runtime)
- [x] 1.2 Add migration `lib/db/migrations/0004_applications.sql`: `applications` (id, offer_id FK UNIQUE, cv_json, letter_text, provider, model, created_at, updated_at); verify via `npm run migrate`

## 2. Content model

- [x] 2.1 Define `lib/generation/content.ts`: zod `ApplicationContent` = `{ cv: { headline, summary, contact, experiences[], formations[], skills[], languages[] }, letter: { recipientContext?, paragraphs[] } }`
- [x] 2.2 Add shared ATS rendering constants (font family/sizes, section headings, spacing, date format `MM/AAAA`)

## 3. LLM adaptation (zero-fabrication)

- [x] 3.1 `lib/generation/prompt.ts`: build the system+user prompt from the `CandidateProfile` + offer; supply ONLY profile facts + offer text; instruct "reword/reorder/select only, never invent", reinject the offer's exact title/skills where supported, return ONLY JSON matching `ApplicationContent`
- [x] 3.2 `lib/generation/adapt.ts`: call `LLMProvider.complete`, parse + zod-validate the JSON; on failure do one repair retry (feed the error back); clear error if still invalid or provider unavailable
- [x] 3.3 `lib/generation/verify.ts`: deterministic check — every generated CV experience/formation maps to a `CandidateProfile` entry (org+period / degree+institution, using `lib/aggregation/text` normalisation); drop+record untraceable entries; flag if core content missing
- [x] 3.4 Ensure keyword reinjection never adds a skill absent from the profile (verified against the profile skill/》fact set)

## 4. Renderers (ATS-parsable, shared model)

- [x] 4.1 `lib/render/docx.ts`: render `ApplicationContent` to a DOCX buffer with `docx` — single column, no tables/text-boxes/images, contact in body, standard headings, reverse-chron, `MM/AAAA` dates
- [x] 4.2 `lib/render/pdf.ts`: render the same model to a PDF buffer with `pdfkit` — selectable text, single column, no images, same headings/order/dates
- [x] 4.3 Render the letter to PDF + DOCX from `letter` (same constants); confirm both formats carry identical content from the one model

## 5. Generation core, persistence & surface

- [x] 5.1 `lib/generation/store.ts`: upsert `applications` by `offer_id` (cv_json, letter_text, provider, model); read helper to load a stored application
- [x] 5.2 `lib/generation/generate.ts`: shared core — load offer (error if not found) + profile → adapt → verify → persist → return content + summary (offer, provider/model, files available)
- [x] 5.3 `scripts/generate.ts` (+ `npm run generate -- --offer=<id>`): run the core, write the 4 files locally and/or print the summary
- [x] 5.4 `POST /api/applications/generate` (offerId in body): runs the core, returns the summary as JSON (Node runtime)
- [x] 5.5 `GET /api/applications/[offerId]/[file]` for `cv.pdf|cv.docx|lettre.pdf|lettre.docx`: re-render from stored content, correct `Content-Type` + `Content-Disposition: attachment`

## 6. Verify & wrap-up

- [x] 6.1 Manually generate for a real stored offer: 4 files produced; PDF text is selectable; CV is single-column with contact in body; content traces to the profile (no fabrication)
- [x] 6.2 Confirm graceful degradation when the LLM provider is unconfigured/unreachable (clear message, no crash, no fabricated output)
- [x] 6.3 Confirm `npm run build` succeeds with no type errors
- [x] 6.4 Update `RUNNING.md`: how to run generation and download the files
