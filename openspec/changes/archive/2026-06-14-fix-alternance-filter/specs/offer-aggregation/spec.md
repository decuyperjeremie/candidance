## MODIFIED Requirements

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
