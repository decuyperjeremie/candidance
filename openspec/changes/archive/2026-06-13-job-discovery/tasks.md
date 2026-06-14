## 1. Config, deps & schema

- [x] 1.1 Add `cheerio` (required) to dependencies; add `playwright` as an optional/lazy dep (document that it is only needed for best-effort connectors)
- [x] 1.2 Extend `lib/config` with `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` (lazy-validated, only when the connector runs) and `JOB_SOURCES` (enabled-connector list, default `["france-travail"]`)
- [x] 1.3 Document the new env vars in `.env.example` and the France Travail developer-app signup in `RUNNING.md`
- [x] 1.4 Add migration `lib/db/migrations/0002_offers.sql`: `offers` (dedup_key unique, normalised fields, score/rationale/category, first_seen_at/last_seen_at), `offer_sources` ((source, source_local_id) unique, url, seen_at, offer_id FK), `crawl_runs` (criteria + counts); verify it runs via `npm run migrate`

## 2. JobSource interface & registry

- [x] 2.1 Define `lib/sources/types.ts`: `RawOffer`, `SearchCriteria`, `Zone`, `JobSource` interface, and `JobSourceError` (carries connector name)
- [x] 2.2 Add `lib/sources/registry.ts`: name → connector factory map, and a helper returning the enabled connectors from `JOB_SOURCES`
- [x] 2.3 Add a shared `normalise` helper (build `RawOffer` defensively from partial source data; missing fields stay absent)

## 3. France Travail connector (primary)

- [x] 3.1 OAuth2 token client: `POST .../access_token?realm=/partenaire`, scope `api_offresdemploiv2 o2dsoffre`, cache token until `expires_in`, refresh on demand; clear error on auth failure (surface status/body)
- [x] 3.2 Search client: `GET .../offresdemploi/v2/offres/search` with `motsCles` + IDF `departement`; native `fetch`, `Authorization: Bearer`, ~3 req/s throttle
- [x] 3.3 Pagination via `range=p-d` (≤150/page); follow `Content-Range`/`206` until total or the 1150 ceiling; dedup within source by id
- [x] 3.4 IDF zone targeting: try `departement=75,77,78,91,92,93,94,95` in one call; fall back to one request per department if rejected
- [x] 3.5 Normalise each `resultats[]` offer to `RawOffer` (id, intitule, description, entreprise.nom?, lieuTravail, typeContrat, origineOffre.urlOrigine, dateCreation, romeCode), coding defensively for absent fields
- [x] 3.6 Handle missing/invalid credentials with a friendly error that does not crash the discovery pass

## 4. Additional & best-effort connectors

- [x] 4.1 `lib/sources/apec.ts`: fetch cadre offers (API if available, else `cheerio` HTML scrape); normalise; opt-in; failures isolated
- [x] 4.2 `lib/sources/welcome-to-the-jungle.ts`: `cheerio` scrape of comm/media listings; normalise; opt-in; failures isolated
- [x] 4.3 Scaffold `lib/sources/{linkedin,indeed,glassdoor}.ts` best-effort via lazily-imported `playwright`; off by default; enabled-but-blocked yields zero offers + reason, never a crash
- [x] 4.4 Verify the core installs and a discovery pass runs without `playwright` installed

## 5. Aggregation: dedup, scoring, filters, persistence

- [x] 5.1 `lib/aggregation/aggregate.ts`: run enabled connectors concurrently with `Promise.allSettled`; collect offers + per-connector outcome (count or error reason)
- [x] 5.2 `lib/aggregation/dedup.ts`: compute normalised fuzzy `dedupKey` (company|title|city, lowercased/accent-stripped/whitespace-collapsed); fallback to title|city when company absent; collapse matches into one offer with N provenance rows
- [x] 5.3 `lib/aggregation/score.ts`: deterministic 0–100 relevance vs the **communication facet** of `CandidateProfile` (crisis comm, press relations, corporate/institutional, event mgmt); output score + short rationale; works with no LLM
- [x] 5.4 `lib/aggregation/filter.ts`: communication inclusion gate (keyword set) + zone filter (IDF dept codes); French-language scope; exclude non-communication and out-of-zone offers
- [x] 5.5 `lib/aggregation/store.ts`: upsert offers by `dedupKey` (update last_seen_at, no duplicates on re-run), insert/ignore `offer_sources`, write a `crawl_runs` summary row; read helpers return stored offers ranked by score

## 6. On-demand discovery pass (deliverable)

- [x] 6.1 `lib/aggregation/discover.ts`: shared core — load profile, run aggregate → dedup → score → persist → rank → build run summary (per-source counts, duplicates merged, total stored)
- [x] 6.2 `scripts/discover.ts` (+ `npm run discover`): CLI runner with IDF + the default communication keyword set (also fed to France Travail `motsCles`), overridable via args; prints the ranked list and summary
- [x] 6.3 `GET /api/discover` route: runs the pass (query params for keywords/zone), returns ranked offers + summary as JSON
- [x] 6.4 Manually verify against real France Travail credentials: a real, de-duplicated, scored, in-zone list is returned and persisted; re-running does not duplicate stored offers

## 7. Wrap-up

- [x] 7.1 Confirm `npm run build` succeeds with no type errors
- [x] 7.2 Update `RUNNING.md`: how to get France Travail credentials, set `JOB_SOURCES`, run `npm run discover` / hit `/api/discover`, and note that best-effort connectors need `playwright`
