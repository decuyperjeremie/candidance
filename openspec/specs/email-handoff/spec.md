# email-handoff Specification

## Purpose

Defines how a generated application is handed off to the user's own mail client for sending. The system prepares email drafts — a pre-filled `mailto:` link and a downloadable `.eml` file with the generated documents attached — but never sends anything itself; the user reviews and sends manually.
## Requirements
### Requirement: Pre-filled mailto link

The system SHALL provide a `mailto:` link pre-filled with the recipient, a subject (e.g. "Candidature — <intitulé de l'offre>"), and a body message, from the offer detail page. The recipient SHALL be the offer's extracted contact email when the offer's contact `method = "email"`; otherwise the recipient is left blank. The system SHALL make clear that attachments must be added manually with `mailto:`.

#### Scenario: Open a pre-filled email with a known recipient

- **WHEN** the offer's extracted contact has `method = "email"` and the user activates the pre-filled email action
- **THEN** their mail client opens a draft with the recipient set to that email and the subject and body filled in

#### Scenario: No recipient known

- **WHEN** the offer's extracted contact is not an email (`method = "url"` or `"none"`)
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

### Requirement: Open the draft in Gmail compose

The system SHALL provide an action that opens the same pre-filled draft (recipient when known, subject, body) directly in Gmail's web compose window, independent of the operating system or browser default mail handler. Like the `mailto:` link, this action SHALL NOT carry attachments (the `.eml` remains the attached-documents path) and SHALL NOT send anything automatically.

#### Scenario: Open the pre-filled draft in Gmail

- **WHEN** the user activates the "Ouvrir dans Gmail" action on an offer with a generated application
- **THEN** Gmail's compose window opens (in a new tab) with the subject and body pre-filled (and recipient if known), ready for the user to review, attach the documents, and send

#### Scenario: Independent of default mail handler

- **WHEN** the OS/browser default mail client is not Gmail
- **THEN** the Gmail action still opens Gmail's web compose, without relying on a `mailto:` handler

### Requirement: Apply-link fallback when no email is known

The system SHALL, when an offer has no contact email but has an apply URL (contact `method = "url"`), surface that apply URL as the primary apply action on the offer detail page (e.g. an "Postuler en ligne" link), instead of presenting only an empty `mailto:`. When the offer has neither (`method = "none"`), the system SHALL fall back to the original posting URL if available, and otherwise present the manual `mailto:` draft.

#### Scenario: Apply URL surfaced when no email

- **WHEN** an offer's contact has `method = "url"`
- **THEN** the detail page presents the apply URL as the apply action

#### Scenario: Falls back to posting URL

- **WHEN** an offer's contact is `method = "none"` but the offer has an original posting URL
- **THEN** the detail page links to the posting URL so the user can apply on the source site

#### Scenario: Nothing to link

- **WHEN** an offer has no contact and no posting URL
- **THEN** the detail page still offers the pre-filled `mailto:` draft with a blank recipient

