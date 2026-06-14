## ADDED Requirements

### Requirement: Offer detail page

The system SHALL provide a web detail page for a stored offer that shows the offer's key fields (title, company, location, contract, salary, publication date, relevance score, source link) and whether an application has been generated for it.

#### Scenario: Open an offer from the list

- **WHEN** the user clicks an offer in the list
- **THEN** a detail page opens showing the offer's fields and whether an application exists

#### Scenario: Offer not found

- **WHEN** the detail page is requested for an id that is not stored
- **THEN** the page shows a clear "offre introuvable" message rather than crashing

### Requirement: Generate from the detail page

The system SHALL let the user trigger generation of the adapted CV + cover letter from the detail page, reusing the application-generation capability (zero-fabrication, ATS rendering), and display the result once ready.

#### Scenario: Generate an application

- **WHEN** the user triggers generation on the detail page for an offer with no application
- **THEN** the adapted CV and cover letter are generated, persisted, and displayed

#### Scenario: Generation provider unavailable

- **WHEN** generation is triggered but the LLM provider is unconfigured/unreachable
- **THEN** the page shows a clear message and no fabricated application is produced

### Requirement: Inline edit and save the application

The system SHALL let the user edit the generated CV (headline, summary, experiences and their highlights, skills, languages) and the cover letter (paragraphs) inline, and save the edits. Saved edits SHALL persist (as the stored `ApplicationContent`) and become the content used for all downloads.

#### Scenario: Edit and save

- **WHEN** the user edits CV or letter fields and saves
- **THEN** the updated content is validated and persisted, replacing the previous stored content

#### Scenario: Invalid edit rejected

- **WHEN** a save is attempted with content that does not satisfy the application schema (e.g. an empty required field)
- **THEN** the save is rejected with a clear message and the previous stored content is unchanged

#### Scenario: Downloads reflect saved edits

- **WHEN** the user downloads a file after saving edits
- **THEN** the downloaded PDF/DOCX reflects the latest saved content

### Requirement: List links to detail

The system SHALL link each offer in the offer list to its detail page.

#### Scenario: Navigate from list to detail

- **WHEN** the user selects an offer in the list
- **THEN** its detail page opens
