## Why

Tatiana is a senior cadre: work-study (alternance) and internship offers should never reach her list. But offer **#1952** ("JCDecaux - Chargé de communication", `contractType=CDD`, score 76) is in fact an **alternance** — its description reads "Poste à pourvoir : **Alternance** - Chargé de Communication Interne F/H". It slipped through both guards:

- The **title** carries no junior keyword (it says "Chargé de communication").
- The **description filter** uses deliberately high-precision patterns (`\ben alternance\b`, `\ben apprentissage\b`) to avoid false positives like "une expérience en alternance est un plus". The **label form** "Alternance - …" / "Poste à pourvoir : Alternance" at the start of a line is not matched.
- France Travail labels the offer `CDD` (its `typeContrat`); the more reliable `natureContrat` field (e.g. "Contrat d'apprentissage") is **not captured** by our connector.

## What Changes

- Add **high-precision label-form signals** to the description exclusion in `lib/aggregation/filter.ts` — `alternance`/`apprentissage`/`professionnalisation` immediately followed by a separator (`-`/`:`), and the "poste à pourvoir / contrat / type de contrat : alternance" forms. Bare "alternance" is **not** added (would reintroduce false positives).
- **Capture `natureContrat`** from the France Travail connector and feed it into the contract-exclusion check, so apprenticeship/professionnalisation contracts are caught at the source regardless of description wording.
- Add **regression tests** for the filter (the "Alternance - …" offer is excluded; "une expérience en alternance est un plus" stays kept).
- **Purge the already-stored offer #1952** (existing rows are not re-filtered automatically).

## Capabilities

### Modified Capabilities
- `offer-aggregation`: the communication/zone filter now also excludes label-form alternance/apprenticeship offers detected in the description (and via the captured contract nature), closing the leak while preserving precision.
- `job-sources`: the France Travail connector additionally captures `natureContrat`, exposing a reliable work-study/apprenticeship signal to downstream filtering.

## Impact

- **Modified**: `lib/aggregation/filter.ts` (extend `JUNIOR_DESC_PATTERNS`; include contract nature in `isExcludedContract`), `lib/sources/france-travail.ts` (capture `natureContrat`, propagate it).
- **Tests**: filter unit tests (new file or extend existing) covering the leak + non-regression.
- **Data**: a one-off cleanup of offer #1952 from `data/tatiana.db`; future passes filter it correctly. No DB schema change.
- **No change** to LLM, generation, review, or tracking surfaces.
