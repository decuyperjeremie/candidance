## 1. Description-level fix (closes #1952)

- [x] 1.1 In `lib/aggregation/filter.ts`, extend `JUNIOR_DESC_PATTERNS` with high-precision label-form signals: `alternance`/`apprentissage`/`professionnalisation` followed by a separator (`-`/`:`), and "poste à pourvoir : alternance/apprentissage" + "(type de) contrat : alternance/apprentissage/professionnalisation" — applied to the already-normalised description. Do NOT add bare "alternance".
- [x] 1.2 Verify the filter behaviour with a quick `tsx` assertion check (the project has no test framework — match the `scripts/*.ts` + tsx style, ephemeral is fine): a "Poste à pourvoir : Alternance - …" offer (mirroring #1952) is excluded; "une expérience en alternance est un plus" stays kept; an "en alternance" offer still excluded.

## 2. Source-level hardening (France Travail contract nature)

- [x] 2.1 In `lib/sources/france-travail.ts`, add `natureContrat` to the `FtOffer` type and capture it on the normalised offer (append it to the text `isExcludedContract` inspects, or via an equivalent typed field).
- [x] 2.2 Confirm the real France Travail field name/libellé with a live call if credentials are present in `.env`; adjust the mapping if it differs. The description fix (section 1) must stand on its own if the field is absent.
- [x] 2.3 Include the captured contract nature in `isExcludedContract`'s checked text so "Contrat d'apprentissage"/"professionnalisation" matches the existing `JUNIOR_TITLE_WORDS`.

## 3. Cleanup & verify

- [x] 3.1 Purge the already-stored offer #1952 (and any provenance/application rows) from `data/tatiana.db` — existing rows are not re-filtered automatically.
- [x] 3.2 Confirm `npm run build` (and the filter tests) pass with no type errors.
- [x] 3.3 Real check: run a discovery pass (or re-verify on stored data) and confirm no label-form alternance offer remains in `/offres`; #1952 is gone.
