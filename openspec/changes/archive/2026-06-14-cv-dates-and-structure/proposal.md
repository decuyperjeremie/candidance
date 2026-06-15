## Why

The generated CV's **dates** and **experience ordering** don't match the candidate's reference layout (`source/template_cv_ok.docx`). On a real generation (offre #1878) the periods were inconsistent (`2022 - 2025`, `02/2013 - 09/2014`, `Depuis 2022`, `2022 - présent` mixed), the experiences formed one flat list mixing the doctorate / teaching roles with corporate roles, and the order was not antichronological. The reference template instead uses a single year-based format with an en-dash (`2022 – 2025`, `2022 – présent`, `depuis 2022`), and splits roles into **EXPÉRIENCE PROFESSIONNELLE** and a separate **ENSEIGNEMENT & RECHERCHE** section, each most-recent-first.

## What Changes

- **Adopt `template_cv_ok.docx`** as the cloned DOCX template (replaces `template_cv.docx`); align the PDF look to it.
- **Deterministic date formatting**: normalise every experience `period` to `AAAA – AAAA` (year-based, en-dash), ongoing roles to `depuis AAAA`. Applied at **render time** (shared helper), so existing and edited applications render consistently without regeneration.
- **Two-column COMPÉTENCES CLÉS**: render the key-skills section in two columns like the reference template.
- **Deterministic antichronological ordering**: within each section, sort most-recent-first (ongoing first, then by end year, then start year). Also at render time.
- **Section grouping**: classify each experience as professional vs teaching/research and render two sections (EXPÉRIENCE PROFESSIONNELLE, ENSEIGNEMENT & RECHERCHE). The classification is set by the LLM (new optional `category` field) with a deterministic keyword fallback at render time (doctorat, thèse, université, enseignement, recherche, travaux dirigés, ATER, maître de conférences).
- **En-dash policy fix**: narrow `normalizeProse` to strip only the **em-dash (—)** and double hyphen (the cv-lettre skill's literal rule); **keep the en-dash (–)** since the reference template uses it for dates and separators. Render separators switch from `—` to `–`.

## Capabilities

### Modified Capabilities
- `application-generation`: the adapted CV now formats experience dates consistently (year-based, en-dash, "présent" for ongoing), orders experiences antichronologically, and groups them into professional vs teaching/research sections, rendered against the `template_cv_ok.docx` styling. Content still traces to the profile (zero-fabrication unchanged).

## Impact

- **Modified**: `lib/generation/content.ts` (optional `category` on `CvExperience`), `lib/generation/prompt.ts` (ask for category + year-based dates), `lib/generation/verify.ts` (narrow em-dash stripping, keep en-dash), `lib/render/cv-layout.ts` (new shared helper: period formatting, ordering, grouping), `lib/render/docx.ts` (template path → `template_cv_ok.docx`; two experience sections; two-column skills; en-dash separators; tab stops to match), `lib/render/pdf.ts` (same two sections + two-column skills + look).
- **Template**: relies on `source/template_cv_ok.docx` (already present).
- **No DB schema change.** Existing stored applications re-render with the new formatting/ordering on next download (content is re-rendered on demand); periods are reformatted at render/normalisation time.
- **No change** to discovery, review, email, or tracking surfaces.
