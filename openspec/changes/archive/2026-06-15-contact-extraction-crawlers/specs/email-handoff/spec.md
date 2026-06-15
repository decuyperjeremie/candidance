## MODIFIED Requirements

### Requirement: Pre-filled mailto link

The system SHALL provide a `mailto:` link pre-filled with the recipient, a subject (e.g. "Candidature — <intitulé de l'offre>"), and a body message, from the offer detail page. The recipient SHALL be the offer's extracted contact email when the offer's contact `method = "email"`; otherwise the recipient is left blank. The system SHALL make clear that attachments must be added manually with `mailto:`.

#### Scenario: Open a pre-filled email with a known recipient

- **WHEN** the offer's extracted contact has `method = "email"` and the user activates the pre-filled email action
- **THEN** their mail client opens a draft with the recipient set to that email and the subject and body filled in

#### Scenario: No recipient known

- **WHEN** the offer's extracted contact is not an email (`method = "url"` or `"none"`)
- **THEN** the subject and body are still pre-filled and the recipient is left blank

## ADDED Requirements

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
