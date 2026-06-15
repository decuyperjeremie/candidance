# profile-ingestion Specification

## Purpose
TBD - created by archiving change bootstrap-foundations. Update Purpose after archive.
## Requirements
### Requirement: Parse the candidate CV from markdown

The system SHALL extract the textual and structural content of the candidate CV file at `source/CV_Tatiana_Avila_Gomes.12.06.md` into an intermediate representation suitable for building a structured profile.

#### Scenario: CV file is present and readable

- **WHEN** the ingestion runs and `source/CV_Tatiana_Avila_Gomes.12.06.md` exists
- **THEN** the system extracts the document text and produces an intermediate representation containing the CV sections (profil, expériences, formations, publications, langues, contact)

#### Scenario: CV file is missing

- **WHEN** the ingestion runs and the CV file does not exist
- **THEN** the system fails with a clear error naming the expected path and does not produce a partial profile

### Requirement: Merge LinkedIn extract into the profile

The system SHALL read the LinkedIn extract at `source/extract-linkedin.md` and merge its content (headline, additional experiences, achievements, tagged skills, years of experience) with the CV-derived data into a single `CandidateProfile`.

#### Scenario: Both sources present

- **WHEN** both the CV and the LinkedIn extract are available
- **THEN** the resulting `CandidateProfile` contains contact info, a headline, a list of experiences, formations, skills, languages, and publications drawn from both sources

#### Scenario: Conflicting facts between sources

- **WHEN** the CV and LinkedIn extract state a different value for the same field (e.g. years of experience: "20+" vs "24")
- **THEN** the system retains both values or records the discrepancy rather than silently discarding one

### Requirement: Profile is the source of truth and never fabricated

The system SHALL populate the `CandidateProfile` only with facts present in the source files. It MUST NOT invent experiences, diplomas, dates, skills, or any other data not found in `source/CV_Tatiana_Avila_Gomes.12.06.md` or `source/extract-linkedin.md`.

#### Scenario: No invented data

- **WHEN** the `CandidateProfile` is produced
- **THEN** every experience, formation, skill, language, and publication in it can be traced back to content in one of the two source files

#### Scenario: Missing optional field

- **WHEN** a profile field has no corresponding data in either source
- **THEN** the field is left empty/absent rather than filled with a guessed value

### Requirement: Structured profile is typed and validated

The system SHALL expose the `CandidateProfile` as a typed, validated structure with at minimum: identity/contact, headline, experiences (title, organisation, period, location, highlights), formations, skills, languages with levels, and publications.

#### Scenario: Loading the profile

- **WHEN** application code requests the candidate profile
- **THEN** it receives a validated `CandidateProfile` object, or a validation error if the structure is incomplete or malformed

