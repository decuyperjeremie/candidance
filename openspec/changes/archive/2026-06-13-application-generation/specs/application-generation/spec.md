## ADDED Requirements

### Requirement: Generate an offer-adapted CV and cover letter

The system SHALL, given a stored offer and the `CandidateProfile`, produce an adapted CV and an adapted cover letter tailored to that offer. Adaptation uses the active LLM provider (the `llm-provider-bridge`) to reorder, reword, and prioritise the candidate's real experience and skills toward the offer, and to write a letter addressed to the offer's context. The generated content SHALL be produced in French.

#### Scenario: Generate for a chosen offer

- **WHEN** generation is requested for a stored offer id
- **THEN** the system loads that offer and the `CandidateProfile`, and produces a structured adapted CV and a cover letter text targeted at the offer

#### Scenario: Offer not found

- **WHEN** generation is requested for an id that is not in storage
- **THEN** the system fails with a clear error and produces no partial application

#### Scenario: LLM provider unavailable

- **WHEN** the active LLM provider is unconfigured or unreachable
- **THEN** the system reports a clear, friendly error instead of crashing, and no fabricated application is produced

### Requirement: Never fabricate candidate facts

The system SHALL populate the CV and letter only with facts present in the `CandidateProfile`. It MUST NOT invent experiences, employers, diplomas, dates, skills, or any other fact. The system SHALL apply a deterministic verification step: every experience and formation appearing in the generated CV must trace back to a `CandidateProfile` entry, and content that cannot be traced is rejected or flagged rather than silently kept.

#### Scenario: Generated experiences trace to the profile

- **WHEN** an adapted CV is produced
- **THEN** each experience and formation in it corresponds to an entry in the `CandidateProfile` (no invented employer, role, diploma, or date)

#### Scenario: Untraceable content is caught

- **WHEN** the adaptation step returns an experience, employer, or diploma not present in the `CandidateProfile`
- **THEN** the verification step flags or removes it rather than including it in the output

#### Scenario: Reformulation is allowed, invention is not

- **WHEN** the adaptation rewords or reorders existing profile facts to match the offer
- **THEN** this is permitted, but no new factual claim (skill, tool, result, date) absent from the profile is introduced

### Requirement: Reinject the offer's keywords for ATS matching

The system SHALL incorporate the offer's exact wording — at minimum the job title and the skills/tools named in the offer — into the adapted CV where they correspond to real profile facts, so the document matches the screener's keywords. Keyword reinjection MUST NOT introduce skills the candidate does not have (no keyword stuffing of unsupported claims).

#### Scenario: Offer title and matching skills appear

- **WHEN** the offer names a job title and skills that the candidate genuinely has
- **THEN** the adapted CV uses the offer's exact wording for those where supported by the profile

#### Scenario: Unsupported keyword not injected

- **WHEN** the offer requires a skill that is absent from the `CandidateProfile`
- **THEN** that skill is not added to the CV as if possessed

### Requirement: Render ATS-parsable CV and letter to PDF and DOCX

The system SHALL render the generated CV and letter to both PDF and DOCX. The output MUST be ATS-parsable: a single-column layout with no tables, text-boxes, images, or icons; contact details in the document body (not header/footer); standard fonts; conventional section headings; reverse-chronological experience; unambiguous dates; and selectable (non-image) text in the PDF. Both formats SHALL be produced from one shared structured content model so they carry the same content.

#### Scenario: Both formats produced from one model

- **WHEN** an application is rendered
- **THEN** a PDF and a DOCX are produced from the same structured content, with matching content

#### Scenario: PDF text is selectable

- **WHEN** the CV PDF is produced
- **THEN** its text is real selectable text (not a rasterised image), so an ATS can parse it

#### Scenario: Layout is single-column and header-free

- **WHEN** either format is produced
- **THEN** it uses a single-column layout and places contact details in the body, avoiding tables, text-boxes, images, and header/footer regions

### Requirement: Persist generated applications

The system SHALL persist each generated application — the structured CV content, the letter text, the originating offer, and the provider/model used — in SQLite, so it survives restarts and can be reviewed/edited in a later slice. A schema migration SHALL create the required table following the existing migration mechanism.

#### Scenario: Application is stored

- **WHEN** an application is generated for an offer
- **THEN** the database holds its CV content, letter text, offer reference, and the model/provider used

#### Scenario: Regenerating updates rather than duplicates

- **WHEN** an application is generated again for the same offer
- **THEN** the stored application for that offer is updated rather than duplicated

### Requirement: Runnable generation and download surface

The system SHALL expose an on-demand way to generate an application for an offer (a script and an API route) and to download the resulting `cv.pdf`, `cv.docx`, `lettre.pdf`, and `lettre.docx`. Downloads SHALL be served with the correct content type and as file attachments.

#### Scenario: Generate then download

- **WHEN** generation is run for an offer id and then a download is requested for one of the four files
- **THEN** the corresponding PDF or DOCX is returned with the correct content type as a downloadable attachment

#### Scenario: Generation reports a summary

- **WHEN** a generation run completes
- **THEN** it reports which offer was used, the provider/model, and that the four files are available, so the result is verifiable
