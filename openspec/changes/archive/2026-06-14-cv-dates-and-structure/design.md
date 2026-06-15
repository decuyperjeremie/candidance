## Context

The generated CV must match the candidate's reference layout `source/template_cv_ok.docx`. Today the DOCX renderer clones `template_cv.docx` and rebuilds the body from `ApplicationContent.cv` (flat `experiences[]` then `formations[]`); the PDF mirrors it. Periods are whatever the LLM emits (inconsistent), order is unstructured, and a separate teaching/research section does not exist. `normalizeProse` (added with the cv-lettre skill) currently strips both em- and en-dashes.

Constraints: throwaway prototype, no over-engineering; zero-fabrication unchanged; match the reference template's conventions.

## Goals / Non-Goals

**Goals:**
- Consistent year-based dates (`AAAA – AAAA`, `AAAA – présent`) with an en-dash.
- Antichronological order within each section.
- Two experience sections: EXPÉRIENCE PROFESSIONNELLE and ENSEIGNEMENT & RECHERCHE.
- Two-column COMPÉTENCES CLÉS like the template.
- Clone `template_cv_ok.docx`; PDF look aligned.

**Non-Goals:**
- Changing what content is generated (no new facts; zero-fabrication intact).
- A pixel-perfect reproduction of every template detail beyond the items above.
- DB schema changes; re-running the LLM on existing applications.

## Decisions

### Format dates + order + group at render time (shared helper)
A new `lib/render/cv-layout.ts` exposes `formatPeriod(raw)`, a comparator for antichronological order, and `groupExperiences(cv)` returning `{ professional[], teachingResearch[] }`. Both renderers call it. *Why:* render-time means existing stored applications and user-edited ones render consistently without regeneration, and the logic lives once for PDF + DOCX. *Trade-off:* a user's hand-typed period is reformatted on render — acceptable and consistent.

### `formatPeriod` is year-based and tolerant
Parse 4-digit years from the raw period; ongoing markers (`présent`, `present`, `aujourd'hui`, `en cours`, `depuis`, or a single start year with no end) → `depuis AAAA`; a single completion year → `AAAA`; two years → `AAAA – AAAA`. Separator is the en-dash `–`. Unparseable strings are passed through untouched (never invent a date). *Why:* deterministic, matches the template, never fabricates.

### Experience category: LLM field + deterministic fallback
Add optional `category: "professionnelle" | "enseignement_recherche"` to `CvExperience` (default `professionnelle`). The prompt asks the LLM to set it. At render, if absent/uncertain, a keyword heuristic on title+organisation decides (doctorat, doctorante, thèse, université, faculté, enseignement, recherche, travaux dirigés, ATER, maître de conférences, chercheur). *Why:* the LLM has the context; the heuristic guarantees correct grouping even on older/edited content. Empty groups render no heading.

### En-dash policy: keep en-dash, strip only em-dash
Narrow `normalizeProse` to strip the em-dash (—) and double hyphen only (the cv-lettre skill's literal rule), leaving the en-dash (–) intact, because the reference template uses `–` for dates and incises. Render separators (title–organisation, degree–institution) switch from `—` to `–`. *Why:* reconciles the skill rule with the template; the date formatter owns the en-dash in periods.

### Clone `template_cv_ok.docx`
Point `TEMPLATE_PATH` to `source/template_cv_ok.docx` and align the right-tab stop used for dates to that template's geometry. The body is rebuilt as today (styles/theme inherited from the cloned file). *Why:* single source of styling truth, matches the candidate's chosen layout.

### Two-column COMPÉTENCES CLÉS
Render skills two per line: in DOCX a paragraph with a left tab stop (template's ~4680 twips) separating the pair; in PDF two columns at half-width. An odd final skill sits alone on the last line. *Why:* matches the reference template's key-skills block.

## Risks / Trade-offs

- **Misclassification** of an experience's section → keyword fallback is conservative (defaults to professional); the LLM field is the primary signal; user can edit text but section is derived — acceptable for a prototype.
- **Date parsing edge cases** (ranges like "02/2013 – 09/2014") collapse to years (`2013 – 2014`) — intended (template is year-based); unparseable strings pass through.
- **Reformatting edited periods** on render may surprise a user who typed a specific format → consistent with the template; documented.

## Migration Plan

- Additive: new render helper + optional `category` field; renderer/prompt/normalize edits. No DB schema change. Existing applications render with the new layout immediately (re-rendered on download).
- Rollback = discard the change dir/branch (and revert `TEMPLATE_PATH`).

## Open Questions

- Resolved: two-column COMPÉTENCES CLÉS is **in scope**.
- Resolved: all ongoing roles render as **`depuis AAAA`**.
