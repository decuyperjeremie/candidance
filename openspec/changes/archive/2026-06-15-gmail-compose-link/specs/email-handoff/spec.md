## ADDED Requirements

### Requirement: Open the draft in Gmail compose

The system SHALL provide an action that opens the same pre-filled draft (recipient when known, subject, body) directly in Gmail's web compose window, independent of the operating system or browser default mail handler. Like the `mailto:` link, this action SHALL NOT carry attachments (the `.eml` remains the attached-documents path) and SHALL NOT send anything automatically.

#### Scenario: Open the pre-filled draft in Gmail

- **WHEN** the user activates the "Ouvrir dans Gmail" action on an offer with a generated application
- **THEN** Gmail's compose window opens (in a new tab) with the subject and body pre-filled (and recipient if known), ready for the user to review, attach the documents, and send

#### Scenario: Independent of default mail handler

- **WHEN** the OS/browser default mail client is not Gmail
- **THEN** the Gmail action still opens Gmail's web compose, without relying on a `mailto:` handler
