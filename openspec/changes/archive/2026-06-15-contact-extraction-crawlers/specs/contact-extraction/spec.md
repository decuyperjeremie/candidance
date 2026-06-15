## ADDED Requirements

### Requirement: Provider-agnostic contact extraction interface

The system SHALL provide a single contact-extraction helper that, given a source's raw offer payload, returns a normalised `OfferContact` of the shape `{ method, email?, applyUrl?, contactName? }` where `method` is one of `"email"`, `"url"`, or `"none"`. The helper SHALL be source-independent so every connector (France Travail, APEC, Welcome to the Jungle, and the crawlers) feeds the same shape, and aggregation/handoff code depends only on `OfferContact`.

#### Scenario: Connector produces a normalised contact

- **WHEN** any connector normalises an offer
- **THEN** it attaches an `OfferContact` whose `method` accurately reflects what was found (`email`, `url`, or `none`)

#### Scenario: Same shape across providers

- **WHEN** two different sources surface contact data in different raw formats
- **THEN** both are reduced to the same `OfferContact` shape consumable without source-specific logic

### Requirement: Email is preferred over link

The system SHALL prefer a usable email address over an apply link, and an apply link over nothing. When a real email is found it SHALL set `method = "email"` and populate `email`; when no email but an apply URL is found it SHALL set `method = "url"` and populate `applyUrl`; when neither is found it SHALL set `method = "none"`.

#### Scenario: Both email and link present

- **WHEN** an offer payload yields both a valid email and an apply URL
- **THEN** the extracted contact has `method = "email"` and carries the email (the URL MAY also be retained but the email is the primary contact)

#### Scenario: Only a link present

- **WHEN** an offer payload yields an apply URL but no valid email
- **THEN** the extracted contact has `method = "url"` and carries the URL

#### Scenario: Neither present

- **WHEN** an offer payload yields no email and no apply URL
- **THEN** the extracted contact has `method = "none"` and carries no fabricated value

### Requirement: Email must be validated before it is trusted

The system SHALL treat a candidate email string as an email only if it matches an email-address pattern. Redirect/instruction text that is not an address (e.g. France Travail's "Pour postuler, utiliser le lien suivant : https://…" placed in a `courriel`-style field) SHALL NOT be treated as an email; any URL embedded in such text MAY instead be used as the apply URL. The system SHALL NEVER fabricate or guess an address.

#### Scenario: Redirect text in an email field is rejected

- **WHEN** a source's email field contains instruction text rather than an address (e.g. "Pour postuler, utiliser le lien suivant : https://candidat.francetravail.fr/…")
- **THEN** it is not used as the email, and the embedded URL is used as the apply URL instead (`method = "url"`)

#### Scenario: A real address is accepted

- **WHEN** a source's email field contains a syntactically valid address (e.g. `rh@entreprise.fr`)
- **THEN** it is accepted as the email (`method = "email"`)

#### Scenario: No invention

- **WHEN** a source provides no usable contact at all
- **THEN** no address or link is invented; the contact stays `method = "none"`
