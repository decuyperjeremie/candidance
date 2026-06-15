## ADDED Requirements

### Requirement: Persist and merge offer contact across sources

The system SHALL persist each offer's extracted contact (method, email, apply URL, contact name) alongside its normalised fields, via a schema migration following the existing migration mechanism, and SHALL surface it on the stored offer read back from SQLite. When the same offer is de-duplicated across sources, the system SHALL merge contacts preferring the strongest method (an `email` contact wins over a `url` contact, which wins over `none`), so the best available way to apply is retained.

#### Scenario: Contact stored with the offer

- **WHEN** an aggregated offer with an extracted contact is persisted
- **THEN** the database stores the contact and a subsequent read of the offer returns it

#### Scenario: Email contact wins on merge

- **WHEN** the same offer is surfaced by two sources, one providing only an apply URL and the other a valid email
- **THEN** the stored offer's contact has `method = "email"` with that email

#### Scenario: Contact absent stays absent

- **WHEN** no source for an offer provides a usable contact
- **THEN** the stored offer's contact is `method = "none"` and no value is fabricated
