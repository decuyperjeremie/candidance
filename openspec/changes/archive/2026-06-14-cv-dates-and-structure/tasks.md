## 1. Content model & prompt

- [x] 1.1 `lib/generation/content.ts`: add optional `category: "professionnelle" | "enseignement_recherche"` to `CvExperience` (default `professionnelle`).
- [x] 1.2 `lib/generation/prompt.ts`: ask the LLM to set each experience's `category`, and to give year-based dates (`AAAA – AAAA`, ongoing → `AAAA – présent`); add `category` to the schema hint.

## 2. Render helper (dates, order, grouping)

- [x] 2.1 `lib/render/cv-layout.ts`: `formatPeriod(raw)` (parse 4-digit years; ongoing markers `présent`/`present`/`aujourd'hui`/`en cours`/`depuis`/single start year → `depuis AAAA`; single completion year → `AAAA`; two years → `AAAA – AAAA`; en-dash separator; unparseable → unchanged).
- [x] 2.2 In the same helper: an antichronological comparator (ongoing first, then end year desc, then start year desc) and `groupExperiences(cv)` → `{ professional[], teachingResearch[] }`, classifying via the experience `category` else a keyword heuristic (doctorat, doctorante, thèse, université, faculté, enseignement, recherche, travaux dirigés, ATER, maître de conférences, chercheur).

## 3. Renderers

- [x] 3.1 `lib/render/docx.ts`: point `TEMPLATE_PATH` to `source/template_cv_ok.docx`; align the right-tab stop to that template; render two experience sections (EXPÉRIENCE PROFESSIONNELLE, ENSEIGNEMENT & RECHERCHE) via the helper; format each `period` with `formatPeriod`; switch title–organisation / degree–institution separators from `—` to `–`; render COMPÉTENCES CLÉS in two columns (left tab stop); omit an empty section.
- [x] 3.2 `lib/render/pdf.ts`: mirror the same two sections, ordering, `formatPeriod`, en-dash separators, and two-column skills so PDF and DOCX match.

## 4. En-dash policy

- [x] 4.1 `lib/generation/verify.ts`: narrow `normalizeProse` to strip only the em-dash (—) and double hyphen; keep the en-dash (–).

## 5. Verify

- [x] 5.1 Quick `tsx` assertion check (ephemeral, `scripts/*.ts` style): `formatPeriod` cases ("02/2013 - 09/2014"→"2013 – 2014", "Depuis 2022"→"depuis 2022", "2022 - présent"→"depuis 2022", "2024 - 2025"→"2024 – 2025", unparseable passes through); the comparator orders ongoing-first; `groupExperiences` splits a doctorate/TD from corporate roles.
- [x] 5.2 Regenerate (or re-render) a real application (e.g. offre #1878) and confirm: dates consistent year-based with en-dash (ongoing = "depuis AAAA"); experiences antichronological; two sections present; skills in two columns; DOCX opens; PDF renders (prod build).
- [x] 5.3 Confirm `npm run build` passes with no type errors. Visually compare the DOCX against `source/template_cv_ok.docx`.
