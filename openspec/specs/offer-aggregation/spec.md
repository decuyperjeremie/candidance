# offer-aggregation Specification

## Purpose

Defines how normalised offers from enabled `JobSource` connectors are aggregated, de-duplicated across sources, scored for relevance against the candidate's communication profile, filtered to in-zone communication roles, and persisted with provenance in SQLite. Exposes an on-demand discovery pass that produces a ranked, de-duplicated list of real offers.
## Requirements
### Requirement: Aggregate offers from enabled connectors

The system SHALL run all enabled `JobSource` connectors for given search criteria, collect their normalised offers, and combine them into a single result set. A failing connector SHALL NOT prevent aggregation of the others.

#### Scenario: Combine results from multiple connectors

- **WHEN** more than one connector is enabled and returns offers
- **THEN** the system produces one combined result set containing offers from all of them

#### Scenario: One connector fails

- **WHEN** an enabled connector errors during the pass
- **THEN** the aggregation completes using the offers from the remaining connectors and records that the failing connector contributed none

### Requirement: De-duplicate offers across sources

The system SHALL detect when the same offer appears on more than one source and store it as a single entry, recording all sources that surfaced it. The dedup key SHALL be a normalised, fuzzy match on company + title + location (case/accents/whitespace-insensitive), so trivially-different postings of the same job collapse into one.

#### Scenario: Same offer on two sources

- **WHEN** two connectors return the same job (matching normalised company + title + location)
- **THEN** the system stores exactly one offer entry and associates both sources (with each source's original URL) to it

#### Scenario: Distinct offers are kept separate

- **WHEN** two offers differ in normalised company, title, or location
- **THEN** they are stored as separate entries

#### Scenario: Re-running discovery does not duplicate stored offers

- **WHEN** a discovery pass runs again and re-surfaces an offer already stored
- **THEN** the existing entry is updated/kept rather than duplicated

### Requirement: Persist offers and their provenance in SQLite

The system SHALL persist de-duplicated offers in SQLite, including their normalised fields, relevance score and rationale, and per-source provenance (which connector, original URL, source-local id). A schema migration SHALL create the required tables following the existing migration mechanism.

#### Scenario: Offer is stored with provenance

- **WHEN** an aggregated offer is persisted
- **THEN** the database contains the offer's normalised fields and one provenance record per source that surfaced it

#### Scenario: Stored offers survive across runs

- **WHEN** the application is restarted and the offer list is requested
- **THEN** previously stored offers are returned from SQLite without re-crawling

### Requirement: Extract salary and publication date when available

The system SHALL extract the offer's pay information and its publication date from the source when present, persist them, and surface them in the offer list. Extraction is best-effort and never fabricated: when the source provides no salary, the field stays absent. The publication date SHALL be shown with a freshness indication (how recent the posting is).

#### Scenario: Salary present at the source

- **WHEN** the source provides pay information for an offer (e.g. France Travail `salaire.libelle`)
- **THEN** the stored offer carries that salary string and the list displays it

#### Scenario: Salary absent

- **WHEN** the source provides no pay information
- **THEN** the salary stays absent (no guessed value) and the offer is still listed

#### Scenario: Publication date and freshness

- **WHEN** an offer has a source publication date
- **THEN** the list shows that date together with how recent it is (freshness)

### Requirement: Score communication relevance against the candidate profile

The system SHALL compute a relevance score (0–100) for each retained offer against the **communication facet** of the `CandidateProfile` (corporate / institutional / crisis communication, press relations, event management). The baseline scoring SHALL be deterministic (e.g. keyword overlap between the offer text and the profile's communication terms), produce a short human-readable rationale, and SHALL be stored with the offer and used to rank the list.

#### Scenario: Offer closer to the communication profile scores higher

- **WHEN** one communication offer strongly matches the profile's communication specialisations (e.g. crisis communication, press relations) and another only weakly matches
- **THEN** the strongly-matching offer receives a higher score

#### Scenario: Score carries a rationale

- **WHEN** an offer is scored
- **THEN** the stored offer includes its numeric score and a short rationale naming the matched communication terms

#### Scenario: Deterministic baseline needs no LLM

- **WHEN** no LLM provider is configured or reachable
- **THEN** scoring still completes using the deterministic baseline

### Requirement: Filter offers to communication roles in the Île-de-France zone

The system SHALL keep only **communication** offers (corporate / institutional / crisis communication, press relations) and SHALL exclude offers outside Paris / Île-de-France (departments 75, 77, 78, 91, 92, 93, 94, 95). Results SHALL be scoped to French-language offers. The communication filter acts as an inclusion gate applied at fetch time (via source query parameters) and/or on the aggregated set, so the candidate sees only in-zone communication offers. Journalism/media and academic/research offers are out of scope for this slice. Work-study/internship exclusion SHALL detect not only "en alternance"-style mentions but also the **label form** by which an offer announces itself as work-study (e.g. "Alternance - <intitulé>", "Poste à pourvoir : Alternance", "Contrat : apprentissage"), and SHALL use a reliable contract-nature signal from the source when available, while continuing to keep offers that merely mention work-study incidentally.

#### Scenario: Out-of-zone offer excluded

- **WHEN** an offer's location is outside Île-de-France
- **THEN** it is excluded from the returned list

#### Scenario: Non-communication offer excluded

- **WHEN** a retained offer does not match the communication keyword set (e.g. a software-engineer or accountant role)
- **THEN** it is excluded from the returned list

#### Scenario: Communication offer kept

- **WHEN** an in-zone offer matches the communication keyword set (e.g. "chargé de communication", "relations presse")
- **THEN** it is kept and scored

#### Scenario: Internship / work-study offer excluded

- **WHEN** an offer is an internship, apprenticeship, or work-study role — signalled either in the title (e.g. "alternance", "stage", "apprenti", "professionnalisation") OR in the description (e.g. "en alternance", "(stage)", "recherchons un stagiaire")
- **THEN** it is excluded from the returned list, regardless of its declared contract type (these are routinely labelled "CDD"/"CDI" at the source)

#### Scenario: Work-study announced in the label form excluded

- **WHEN** an offer announces itself as work-study via the label form in its description (e.g. "Poste à pourvoir : Alternance - Chargé de Communication", "Contrat : apprentissage") even though its title carries no junior keyword and its declared contract type is "CDD"/"CDI"
- **THEN** it is excluded from the returned list

#### Scenario: Incidental mention of work-study kept

- **WHEN** a senior communication offer only mentions work-study incidentally as a bare keyword without the contract label or "en alternance" form (e.g. "vous encadrez des alternants et stagiaires")
- **THEN** it is kept (the bare mention alone does not exclude it)

#### Scenario: Hospitality employer excluded

- **WHEN** the offer's employer is a restaurant / bar / café — determined by the source activity (NAF) code (hébergement/restauration), the company name, or a self-description naming several hospitality activities
- **THEN** it is excluded from the returned list

#### Scenario: Graphic-design role excluded

- **WHEN** the role itself is graphic design (its title names a graphic-design job, e.g. "graphiste", "motion designer", "directeur artistique")
- **THEN** it is excluded from the returned list (a communication role that merely mentions graphic-creation tasks is kept)

#### Scenario: Parental-leave cover or short fixed-term contract excluded

- **WHEN** the offer is a parental-/maternity-leave replacement, or a fixed-term/agency contract (CDD/intérim) whose stated duration is under 6 months
- **THEN** it is excluded from the returned list (a permanent role that merely mentions a replacement is kept)

### Requirement: On-demand discovery pass producing a ranked list

The system SHALL expose an on-demand discovery pass (a script and a JSON route) that runs the enabled connectors, aggregates and de-duplicates, scores, persists, and returns the de-duplicated offers ranked by relevance score. Crawling is on-demand for the prototype (no scheduling).

#### Scenario: Running a discovery pass returns ranked real offers

- **WHEN** the discovery pass is invoked with keywords and the Île-de-France zone and at least France Travail is configured
- **THEN** it returns a list of real, de-duplicated offers ordered by descending relevance score, and persists them

#### Scenario: Discovery summary is reported

- **WHEN** a discovery pass completes
- **THEN** it reports a summary (per-source counts, number of duplicates merged, total stored) so the result is verifiable

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

