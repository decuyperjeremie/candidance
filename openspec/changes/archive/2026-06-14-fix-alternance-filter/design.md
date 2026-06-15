## Context

Bug fix on the Slice 2 filtering pipeline (`lib/aggregation/filter.ts`) and the France Travail connector (`lib/sources/france-travail.ts`). The filter favours **precision over recall**: its description patterns target signals that the *offer itself* is junior, not mere mentions. The leak (#1952) is a real alternance whose only junior signal is the label form "Alternance - <titre>" in the description, which the current patterns miss; France Travail reports it as `CDD` via `typeContrat`.

Constraints: throwaway prototype, no over-engineering; match the existing filter style; SQL by hand; no schema change.

## Goals / Non-Goals

**Goals:**
- Exclude label-form alternance/apprenticeship/professionnalisation offers without losing precision.
- Capture a reliable contract-nature signal from France Travail.
- Prove the fix with tests and remove the already-stored offending offer.

**Non-Goals:**
- Re-filtering the whole existing DB programmatically (one-off purge of #1952 only).
- Touching other sources' mappings, scoring, or any non-filter behaviour.
- Catching every conceivable phrasing — only high-precision, low-false-positive forms.

## Decisions

### Add label-form patterns, keep bare "alternance" out
Extend `JUNIOR_DESC_PATTERNS` (applied to the normalised description where accents are stripped and `·`/`/` become spaces) with:
- `/\b(alternance|apprentissage|professionnalisation)\s*[-:]/` — the "Alternance - …" / "Alternance : …" label form.
- `/\bposte a pourvoir\s*:?\s*(alternance|apprentissage)\b/`
- `/\b(type de )?contrat\s*:?\s*(alternance|apprentissage|professionnalisation)\b/`

*Why:* these match the way an offer **announces itself** as work-study, not incidental mentions. Bare `alternance` (no separator/label) is intentionally NOT added, so a senior role that merely mentions managing "alternants et stagiaires" stays kept. *Note:* the pre-existing `\ben alternance\b` pattern (unchanged) already excludes the offer's-own-contract phrasing; these additions only cover the label form it missed. *Trade-off:* a few exotic phrasings may still pass; acceptable for a prototype, and the France Travail nature signal backs it up.

### Feed contract nature into `isExcludedContract`
Capture France Travail's `natureContrat` (libellé) onto the raw offer and include it in the `head` text checked against `JUNIOR_TITLE_WORDS` (which already contains `apprentissage`, `professionnalisation`). So `natureContrat = "Contrat d'apprentissage"` is caught regardless of description wording. *Why:* the source's own contract nature is the most reliable signal; description parsing is the source-agnostic backstop. *To verify at apply time:* the exact field name/libellé via a real France Travail call if credentials are in `.env`; if the field differs, adjust the mapping accordingly (the description fix already closes #1952 on its own).

### Where contract nature lives on the raw offer
`natureContrat` is France-Travail-specific. To avoid widening the shared `RawOffer` contract unnecessarily, append it to the text `isExcludedContract` already inspects (title + contractType) rather than adding a new typed field — simplest, matches the "precision via combined text" approach already used. If a typed field reads cleaner during implementation, that is an acceptable equivalent.

## Risks / Trade-offs

- **False positives** from the new patterns → mitigated by requiring a separator/label context (no bare keyword) and a regression test on the "est un plus" phrasing.
- **France Travail field name assumption** → verified against a live call at apply time; the description fix is sufficient on its own if the field is absent.
- **Stale stored offers** → only #1952 is purged; other already-stored junior offers (if any) clear on the next discovery pass.

## Migration Plan

- Additive code change + tests; no DB schema change. One-off `DELETE` of offer #1952 (and its provenance/any application) from the local DB.
- Rollback = discard the change dir/branch.

## Open Questions

- Should a future pass re-filter the entire existing DB? Out of scope here; a discovery re-run already applies the corrected filter to incoming offers.
