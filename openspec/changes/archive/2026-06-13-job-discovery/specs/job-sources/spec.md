## ADDED Requirements

### Requirement: Pluggable JobSource connector interface

The system SHALL define a single `JobSource` connector interface that every site connector implements. Application code (aggregation, discovery) SHALL depend only on this interface, never on a specific site's transport. Each connector SHALL expose a stable `name` and a method to fetch offers for given search criteria (keywords + geographic zone), returning offers in a common normalised shape.

#### Scenario: Adding a new site needs no core changes

- **WHEN** a developer adds a new connector that implements the `JobSource` interface and registers it
- **THEN** the aggregation and discovery code can use it through the interface with no changes to their own logic

#### Scenario: Connector returns normalised offers

- **WHEN** any connector fetches offers
- **THEN** each returned offer conforms to the common normalised offer shape (at minimum: source name, source-local id, title, company, location, url, description, posting date when available)

### Requirement: France Travail connector (primary, reliable, free)

The system SHALL provide a `france-travail` connector that fetches real offers from the France Travail public "Offres d'emploi v2" API. It SHALL authenticate via OAuth2 `client_credentials` using configured credentials, query the offer-search endpoint filtered by keywords and Île-de-France departments, paginate results, and normalise each API offer to the common shape. This is the only connector the slice deliverable depends on.

#### Scenario: Successful fetch with valid credentials

- **WHEN** valid France Travail credentials are configured and a discovery pass runs with keywords and the Île-de-France zone
- **THEN** the connector obtains an access token, queries the search endpoint, and returns real offers normalised to the common shape

#### Scenario: Missing or invalid credentials

- **WHEN** France Travail credentials are absent or rejected by the token endpoint
- **THEN** the connector fails with a clear, friendly error naming the missing/invalid credentials and does not crash the overall discovery pass

#### Scenario: Pagination over multiple pages

- **WHEN** the search matches more offers than one API page returns (partial-content response)
- **THEN** the connector requests subsequent pages up to the API's documented ceiling and returns the combined set without duplicating offers within the source

#### Scenario: Île-de-France zone targeting

- **WHEN** the configured zone is Paris / Île-de-France
- **THEN** the connector restricts results to the Île-de-France departments (75, 77, 78, 91, 92, 93, 94, 95)

### Requirement: Additional reliable connectors (APEC, Welcome to the Jungle)

The system SHALL provide `apec` and `welcome-to-the-jungle` connectors behind the same `JobSource` interface, fetching offers via each site's available means (API or HTML scraping). These connectors are opt-in via configuration and MUST be non-blocking: if disabled, unavailable, or failing, the discovery pass continues with the remaining enabled connectors.

#### Scenario: Optional connector disabled

- **WHEN** a connector is not in the enabled-sources configuration
- **THEN** it is not invoked and its absence does not affect the discovery pass

#### Scenario: Optional connector fails at runtime

- **WHEN** an enabled connector throws or times out during a discovery pass
- **THEN** the error is isolated to that connector, recorded, and the offers from the other connectors are still aggregated and returned

### Requirement: Best-effort connectors (LinkedIn, Indeed, Glassdoor)

The system SHALL scaffold `linkedin`, `indeed`, and `glassdoor` connectors behind the `JobSource` interface using a headless browser, marked best-effort and disabled by default. The slice deliverable MUST NOT depend on them, and any headless-browser dependency MUST be optional/lazy so the core installs and runs without it.

#### Scenario: Best-effort source off by default

- **WHEN** the discovery pass runs with default configuration
- **THEN** no best-effort connector is invoked and the headless-browser dependency is not required to run the pass

#### Scenario: Best-effort source blocked by anti-bot measures

- **WHEN** a best-effort connector is explicitly enabled but is blocked or returns no parseable results
- **THEN** it yields zero offers with a recorded reason rather than failing the discovery pass

### Requirement: Connectors are configurable and French-language scoped

The system SHALL select which connectors run from configuration (an enabled-sources list) and SHALL scope fetched offers to French-language listings. Connector-specific secrets (e.g. France Travail credentials) SHALL be read from configuration and documented in `.env.example`.

#### Scenario: Selecting enabled connectors

- **WHEN** the enabled-sources configuration lists a subset of connectors
- **THEN** only those connectors run during the discovery pass

#### Scenario: Connector credential is documented

- **WHEN** a connector requires a secret
- **THEN** that secret is read from typed configuration and listed in `.env.example`
