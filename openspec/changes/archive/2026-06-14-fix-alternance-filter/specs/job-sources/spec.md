## MODIFIED Requirements

### Requirement: France Travail connector (primary, reliable, free)

The system SHALL provide a `france-travail` connector that fetches real offers from the France Travail public "Offres d'emploi v2" API. It SHALL authenticate via OAuth2 `client_credentials` using configured credentials, query the offer-search endpoint filtered by keywords and Île-de-France departments, paginate results, and normalise each API offer to the common shape. When the API provides a contract nature (e.g. `natureContrat`, such as "Contrat d'apprentissage" / "Contrat de professionnalisation"), the connector SHALL capture it so downstream filtering can reliably detect work-study/apprenticeship offers even when the declared contract type is "CDD"/"CDI". This is the only connector the slice deliverable depends on.

#### Scenario: Successful fetch with valid credentials

- **WHEN** valid France Travail credentials are configured and a discovery pass runs with keywords and the Île-de-France zone
- **THEN** the connector obtains an access token, queries the search endpoint, and returns real offers normalised to the common shape

#### Scenario: Contract nature captured when present

- **WHEN** an API offer carries a contract-nature field indicating apprenticeship or professionnalisation
- **THEN** the connector captures that signal on the normalised offer so the aggregation filter can exclude it regardless of the declared contract type

#### Scenario: Missing or invalid credentials

- **WHEN** France Travail credentials are absent or rejected by the token endpoint
- **THEN** the connector fails with a clear, friendly error naming the missing/invalid credentials and does not crash the overall discovery pass

#### Scenario: Pagination over multiple pages

- **WHEN** the search matches more offers than one API page returns (partial-content response)
- **THEN** the connector requests subsequent pages up to the API's documented ceiling and returns the combined set without duplicating offers within the source

#### Scenario: Île-de-France zone targeting

- **WHEN** the configured zone is Paris / Île-de-France
- **THEN** the connector restricts results to the Île-de-France departments (75, 77, 78, 91, 92, 93, 94, 95)
