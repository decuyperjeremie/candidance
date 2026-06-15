## MODIFIED Requirements

### Requirement: Generate an offer-adapted CV and cover letter

The system SHALL, given a stored offer and the `CandidateProfile`, produce an adapted CV and an adapted cover letter tailored to that offer. Adaptation uses the active LLM provider (the `llm-provider-bridge`) to reorder, reword, and prioritise the candidate's real experience and skills toward the offer, and to write a letter addressed to the offer's context. The generated content SHALL be produced in French. Each experience MAY be classified as professional or teaching/research so the CV can present them in distinct sections.

#### Scenario: Generate for a chosen offer

- **WHEN** generation is requested for a stored offer id
- **THEN** the system loads that offer and the `CandidateProfile`, and produces a structured adapted CV and a cover letter text targeted at the offer

#### Scenario: Offer not found

- **WHEN** generation is requested for an id that is not in storage
- **THEN** the system fails with a clear error and produces no partial application

#### Scenario: LLM provider unavailable

- **WHEN** the active LLM provider is unconfigured or unreachable
- **THEN** the system reports a clear, friendly error instead of crashing, and no fabricated application is produced

### Requirement: Render ATS-parsable CV and letter to PDF and DOCX

The system SHALL render the generated CV and letter to both PDF and DOCX. The output MUST be ATS-parsable: a single-column layout with no tables, text-boxes, images, or icons; contact details in the document body (not header/footer); standard fonts; conventional section headings; reverse-chronological experience; unambiguous dates; and selectable (non-image) text in the PDF. Both formats SHALL be produced from one shared structured content model so they carry the same content.

Experience dates SHALL be rendered in a consistent year-based form (`AAAA – AAAA`, ongoing roles as `depuis AAAA`) using an en-dash, regardless of how the underlying period was phrased; an unparseable period is rendered unchanged rather than fabricated. Experiences SHALL be ordered antichronologically (ongoing first, then most recent) within each section, and grouped into a professional-experience section and a teaching/research section (a section with no entries is omitted). The key-skills section SHALL be rendered in two columns. The CV SHALL be styled from the candidate's reference template.

#### Scenario: Both formats produced from one model

- **WHEN** an application is rendered
- **THEN** a PDF and a DOCX are produced from the same structured content, with matching content

#### Scenario: PDF text is selectable

- **WHEN** the CV PDF is produced
- **THEN** its text is real selectable text (not a rasterised image), so an ATS can parse it

#### Scenario: Layout is single-column and header-free

- **WHEN** either format is produced
- **THEN** it uses a single-column layout and places contact details in the body, avoiding tables, text-boxes, images, and header/footer regions

#### Scenario: Dates are consistent and year-based

- **WHEN** the CV is rendered from experiences whose periods are phrased inconsistently (e.g. "02/2013 - 09/2014", "Depuis 2022", "2022 - présent")
- **THEN** each renders in the consistent year-based form ("2013 – 2014", "depuis 2022") with an en-dash, and an unparseable period is shown unchanged

#### Scenario: Experiences grouped and ordered

- **WHEN** the CV contains both corporate roles and teaching/research roles
- **THEN** they render under separate "Expérience professionnelle" and "Enseignement & recherche" sections, each ordered most-recent-first, and an empty section is omitted

#### Scenario: Key skills in two columns

- **WHEN** the CV is rendered with several key skills
- **THEN** the key-skills section lays them out in two columns (two per line), an odd final skill alone on the last line
