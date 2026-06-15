## ADDED Requirements

### Requirement: Pre-filled mailto link

The system SHALL provide a `mailto:` link pre-filled with the recipient (when the offer provides one), a subject (e.g. "Candidature — <intitulé de l'offre>"), and a body message, from the offer detail page. The system SHALL make clear that attachments must be added manually with `mailto:`.

#### Scenario: Open a pre-filled email

- **WHEN** the user activates the pre-filled email action
- **THEN** their mail client opens a draft with the subject and body filled in (and recipient if known)

#### Scenario: No recipient known

- **WHEN** the offer carries no contact address
- **THEN** the subject and body are still pre-filled and the recipient is left blank

### Requirement: Downloadable .eml with attachments

The system SHALL produce a downloadable `.eml` file for an offer that contains the pre-filled subject and body AND the generated PDF (and DOCX) as MIME attachments, so the user can open it in their mail client with the documents already attached.

#### Scenario: Generate an .eml with the documents attached

- **WHEN** the user requests the `.eml` for an offer with a generated application
- **THEN** a valid `.eml` is downloaded whose body is the pre-filled message and whose attachments are the generated CV/letter files

#### Scenario: No application generated yet

- **WHEN** the `.eml` is requested for an offer with no generated application
- **THEN** the system responds with a clear message rather than an empty or broken file

### Requirement: Sending stays manual

The system SHALL NOT send any email automatically. It only prepares drafts/files; the user reviews and sends manually.

#### Scenario: No automatic send

- **WHEN** the email handoff is prepared
- **THEN** nothing is transmitted to any mail server by the system; the user sends manually
