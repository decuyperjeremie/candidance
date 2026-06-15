## ADDED Requirements

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

## RENAMED Requirements

- FROM: `### Requirement: Best-effort connectors (LinkedIn, Indeed, Glassdoor)`
- TO: `### Requirement: Best-effort connectors (LinkedIn, Indeed, Glassdoor, Welcome to the Jungle, company sites)`

## MODIFIED Requirements

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
