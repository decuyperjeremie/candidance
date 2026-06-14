## Why

Slice 2 gave Tatiana a ranked, de-duplicated list of real communication offers. The next step in the product flow (`FONDATIONS.md` §2, §5, §8 — capability C5) is the core value: for a chosen offer, produce a **CV and cover letter adapted to that offer** and engineered to **pass the ATS** (the automated résumé screeners that reject applications before a human reads them). This is what turns "here are offers" into "here is a ready-to-send application", and it is the precondition for the review/validate/send slice. Without it there is nothing for Tatiana to review or send.

## What Changes

- Introduce capability **`application-generation`**: given a stored offer + the `CandidateProfile`, generate an **adapted CV** and an **adapted cover letter**, then export both as **PDF and DOCX**.
- **Adaptation via the LLM bridge** (`claude-code` by default): reorder/reword/prioritise the candidate's real experience and skills toward the offer, reinject the offer's **exact keywords** (job title, skills, tools) naturally, and write a tailored letter — **strictly from facts in the `CandidateProfile`**.
- **Hard guardrail — zero fabrication** (`FONDATIONS.md` §5): the generator MUST NOT invent experiences, employers, diplomas, dates, or skills. Every experience/formation in the generated CV must trace back to a profile entry; a deterministic check rejects/flags anything that doesn't.
- **Anti-ATS rendering**: single-column layout, no tables/text-boxes/images/icons, contact details in the body (not header/footer), standard fonts, conventional section headings, reverse-chronological order, unambiguous dates, selectable (non-image) text. One **structured content model** feeds both renderers so DOCX and PDF stay identical.
- **Persist generated applications** (CV content + letter text + which offer/model) so they survive and can be reviewed/edited in the next slice.
- **Runnable surface**: a generation script (`npm run generate -- --offer=<id>`) and API routes to generate and to **download** `cv.pdf` / `cv.docx` / `lettre.pdf` / `lettre.docx`. The visible deliverable of the slice: real, ATS-formatted CV + letter files for a chosen offer, built only from Tatiana's verified facts.

Out of scope (later slices): the review/edit UI surface and validation flow (Slice 4 / C6), email handoff and `.eml`/`mailto:` (C7), application status tracking (C8), automatic sending.

## Capabilities

### New Capabilities
- `application-generation`: For a given offer + `CandidateProfile`, produce an offer-adapted, ATS-optimised CV and cover letter (LLM-assisted, zero-fabrication), render them to PDF + DOCX from a single structured content model, and persist the generated content.

### Modified Capabilities
<!-- None at the spec level. profile-ingestion, llm-provider-bridge and offer-aggregation are consumed as-is. -->

## Impact

- **New dependencies**: `docx` (DOCX generation), `pdfkit` + `@types/pdfkit` (text-based PDF). Both pure-JS, no headless browser, run in the Node runtime.
- **New DB schema**: migration adding `applications` (offer_id FK, generated CV content as JSON, letter text, model/provider used, timestamps).
- **New files/dirs**: `lib/generation/` (LLM adaptation + content model + zero-fabrication check), `lib/render/` (shared content model → `docx` and `pdfkit` renderers), a generation script under `scripts/`, and API routes for generate + downloads.
- **Consumes existing**: `lib/profile` (`CandidateProfile`), `lib/llm` (`LLMProvider.complete`), `lib/aggregation/store` (stored offers), `lib/db`, `lib/config`.
- **Foundation for**: Slice 4 (review UI edits the persisted application; email handoff attaches the generated files; tracking references the application).
