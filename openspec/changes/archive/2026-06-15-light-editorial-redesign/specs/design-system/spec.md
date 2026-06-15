## ADDED Requirements

### Requirement: Shared design tokens

The system SHALL define design tokens (colour, typography scale, spacing, radii, hairlines) in a single source of truth, consumed by every web surface, so the visual language is consistent and changeable in one place.

#### Scenario: Tokens defined once

- **WHEN** a colour, type, or spacing value is needed on any page
- **THEN** it derives from the shared tokens (CSS custom properties, mirrored in TS only where logic needs the value) rather than an ad-hoc per-page literal

#### Scenario: Change a token once

- **WHEN** a core token (e.g. the accent colour) is changed in the source of truth
- **THEN** the change propagates to every surface that uses it

### Requirement: Light editorial visual language

The system SHALL present a light editorial visual language: an off-white canvas with near-black ink text, a serif display face for headings and a clean sans for body text (self-hosted via the framework's font pipeline), hairline dividers, a single restrained accent, and generous whitespace. Text contrast SHALL meet WCAG AA for body and primary UI text.

#### Scenario: Light editorial surfaces

- **WHEN** any primary surface is rendered
- **THEN** it uses the off-white canvas, the serif/sans pairing, hairline rules, and the restrained accent — not the previous dark prototype skin

#### Scenario: Readable contrast

- **WHEN** body and primary interface text is shown on the canvas/surfaces
- **THEN** its contrast meets WCAG AA

### Requirement: Consistent application across surfaces

The system SHALL apply the design system consistently to the global navigation/layout, the home page, the offer list, the offer detail page (including its CV/letter preview, editor, email handoff, and tracking blocks), and the tracking view.

#### Scenario: Every surface adopts the system

- **WHEN** the user moves between the home, offer list, offer detail, and tracking views
- **THEN** typography, colour, spacing, cards, chips, and buttons are visually consistent across them

### Requirement: Presentation-only redesign

The redesign SHALL be presentational: it SHALL NOT change application behaviour (offer discovery, generation, edit/save, downloads, email handoff, status lifecycle) or the styling of the generated CV/letter documents. It SHALL NOT introduce a component library.

#### Scenario: Behaviour preserved

- **WHEN** the user generates, edits and saves, downloads files, prepares an email, or changes a status after the redesign
- **THEN** each behaves exactly as before; only the presentation differs

#### Scenario: Generated documents unchanged

- **WHEN** a CV or letter file is downloaded
- **THEN** its document styling is unchanged by the web redesign
