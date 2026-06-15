# job-sources Specification

## Purpose

Defines a pluggable connector layer for fetching job offers from external job sites behind a single, stable interface, so that aggregation and discovery code depends only on a common normalised offer shape and never on a specific site's transport. Connectors are configuration-selectable, French-language scoped, and graceful under failure.
## Requirements
### Requirement: Pluggable JobSource connector interface

The system SHALL define a single `JobSource` connector interface that every site connector implements. Application code (aggregation, discovery) SHALL depend only on this interface, never on a specific site's transport. Each connector SHALL expose a stable `name` and a method to fetch offers for given search criteria (keywords + geographic zone), returning offers in a common normalised shape.

#### Scenario: Adding a new site needs no core changes

- **WHEN** a developer adds a new connector that implements the `JobSource` interface and registers it
- **THEN** the aggregation and discovery code can use it through the interface with no changes to their own logic

#### Scenario: Connector returns normalised offers

- **WHEN** any connector fetches offers
- **THEN** each returned offer conforms to the common normalised offer shape (at minimum: source name, source-local id, title, company, location, url, description, posting date when available)

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

### Requirement: Additional reliable connectors (APEC, Welcome to the Jungle)

The system SHALL provide `apec` and `welcome-to-the-jungle` connectors behind the same `JobSource` interface, fetching offers via each site's available means (API or HTML scraping). These connectors are opt-in via configuration and MUST be non-blocking: if disabled, unavailable, or failing, the discovery pass continues with the remaining enabled connectors.

#### Scenario: Optional connector disabled

- **WHEN** a connector is not in the enabled-sources configuration
- **THEN** it is not invoked and its absence does not affect the discovery pass

#### Scenario: Optional connector fails at runtime

- **WHEN** an enabled connector throws or times out during a discovery pass
- **THEN** the error is isolated to that connector, recorded, and the offers from the other connectors are still aggregated and returned

### Requirement: Connectors are configurable and French-language scoped

The system SHALL select which connectors run from configuration (an enabled-sources list) and SHALL scope fetched offers to French-language listings. Connector-specific secrets (e.g. France Travail credentials) SHALL be read from configuration and documented in `.env.example`.

#### Scenario: Selecting enabled connectors

- **WHEN** the enabled-sources configuration lists a subset of connectors
- **THEN** only those connectors run during the discovery pass

#### Scenario: Connector credential is documented

- **WHEN** a connector requires a secret
- **THEN** that secret is read from typed configuration and listed in `.env.example`

### Requirement: Best-effort connectors (LinkedIn, Indeed, Glassdoor, Welcome to the Jungle, company sites)

The system SHALL provide `linkedin`, `indeed`, `glassdoor`, `welcome-to-the-jungle`, and direct company-site connectors behind the `JobSource` interface using a pluggable crawl backend (a headless browser such as Playwright, or a managed crawler such as Firecrawl/Obscura). They are marked best-effort and disabled by default. The slice deliverable MUST NOT depend on them, and any crawl/headless dependency MUST be optional and lazily loaded so the core installs and runs without it. Each connector SHALL emit an `OfferContact` via the shared extractor. (Welcome to the Jungle MAY instead use its existing cheerio-based fetch where that remains viable; the requirement is that it is selectable, non-blocking, and emits contact.)

#### Scenario: Best-effort source off by default

- **WHEN** the discovery pass runs with default configuration
- **THEN** no best-effort connector is invoked and the crawl/headless dependency is not required to run the pass

#### Scenario: Best-effort source blocked by anti-bot measures

- **WHEN** a best-effort connector is explicitly enabled but is blocked or returns no parseable results
- **THEN** it yields zero offers with a recorded reason rather than failing the discovery pass

#### Scenario: Crawl backend is interchangeable

- **WHEN** the configured crawl backend changes (e.g. Playwright to Firecrawl)
- **THEN** the connectors keep working through the same `JobSource` interface with no change to aggregation/discovery code

#### Scenario: Crawled offer carries a contact

- **WHEN** an enabled crawler connector parses an offer page that exposes an apply email or link
- **THEN** the returned offer carries the corresponding `OfferContact`

### Requirement: Every connector emits an offer contact

Each `JobSource` connector SHALL attach an `OfferContact` (produced via the shared contact-extraction helper) to every normalised offer it returns, populating it from that source's available signals (e.g. France Travail's `contact.courriel` / `contact.urlPostulation` / `origineOffre.urlOrigine`, a scraped page's `mailto:` link or apply button). Absent contact data SHALL stay absent (`method = "none"`); no address is fabricated.

#### Scenario: France Travail offer with only a redirect link

- **WHEN** the France Travail connector normalises an offer whose `courriel` is redirect text and which carries an `urlOrigine`
- **THEN** the offer's contact is `method = "url"` with the apply URL, not a bogus email

#### Scenario: Connector with no contact signal

- **WHEN** a connector normalises an offer for which the source exposes no email and no apply link
- **THEN** the offer's contact is `method = "none"`

### Requirement: Direct company-site connector

The system SHALL provide a connector that discovers offers from direct company career sites ("site en direct des entreprises"), behind the same `JobSource` interface and shared crawl backend, marked best-effort and disabled by default. It SHALL attempt to extract a contact (apply email or apply URL) from the company's offer/career page via the shared extractor.

#### Scenario: Company career page yields an apply email

- **WHEN** the company-site connector is enabled and a company career page exposes an apply `mailto:` address
- **THEN** the offer is returned with contact `method = "email"`

#### Scenario: Company career page yields only an apply link

- **WHEN** the company career page exposes an apply button/link but no email
- **THEN** the offer is returned with contact `method = "url"`

