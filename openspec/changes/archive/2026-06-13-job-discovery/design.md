## Context

Slice 2 (*Trouver*) builds the first value-delivering layer on top of the Slice 0+1 foundation (`lib/profile`, `lib/llm`, `lib/db`, `lib/config`). It must turn "the web has jobs somewhere" into "a ranked, de-duplicated, stored list of real offers relevant to Tatiana". See `proposal.md` for motivation and `specs/job-sources` + `specs/offer-aggregation` for requirements.

Constraints carried from `FONDATIONS.md`:
- Throwaway prototype — keep it light, no over-engineering, no auth/multi-user/deploy.
- Pluggable connectors (one file per site) so coverage can grow without touching the core.
- Reliable/free sources first; best-effort scrapers must never be load-bearing.
- Target: Paris / Île-de-France, French-language offers. **This slice's crawl is scoped to communication roles only** (corporate / institutional / crisis communication, press relations) — journalism/media and academic/research are out of scope for discovery here, even though the profile spans them.
- LLM defaults to the `claude-code` provider (Claude Max subscription, no paid API). Any LLM use must stay optional.

Research input (France Travail API, verified 2025-2026 against francetravail.io and open-source wrappers):
- OAuth2 `client_credentials`; token endpoint `POST https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire` (the `realm=/partenaire` query param is mandatory); scope `api_offresdemploiv2 o2dsoffre`; token TTL ~25 min (read `expires_in`).
- Search: `GET https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search` with `Authorization: Bearer`; params `motsCles`, `departement`, `commune` (INSEE), `range=p-d` (page ≤ 150 offers, hard ceiling 1150), `minCreationDate`.
- Returns `resultats[]`; `206 Partial Content` + `Content-Range: offres p-d/total` signals more pages; `204` = no offers.
- Offer fields: `id`, `intitule`, `description`, `dateCreation`, `lieuTravail.{libelle,codePostal,commune}`, `typeContrat`, `entreprise.nom`, `origineOffre.urlOrigine`, `romeCode`, `qualificationLibelle`. Fields like `entreprise.nom` and `salaire` can be absent (anonymised) → code defensively.
- Free; ~3 req/s rate limit; multi-`departement` in one call is documented but not formally confirmed → fall back to one request per department.

## Goals / Non-Goals

**Goals:**
- A `JobSource` interface + a registry, with connectors isolated per file.
- A working `france-travail` connector returning real, in-zone, normalised offers — the slice's hard deliverable.
- `apec` + `welcome-to-the-jungle` connectors (scraping) behind the same interface, opt-in, non-blocking.
- `linkedin`/`indeed`/`glassdoor` scaffolded best-effort, off by default, optional headless dep.
- Inter-source dedup, SQLite persistence with provenance, deterministic relevance scoring, and **communication-only** filtering (zone + communication keywords).
- An on-demand discovery pass: `scripts/discover.ts` + `GET /api/discover`, returning a ranked list and a run summary.

**Non-Goals:**
- CV/letter generation, document export, review UI surface, email handoff, tracking (later slices).
- Scheduled/automatic crawling (on-demand only for the prototype).
- LLM-based scoring as the baseline (deterministic first; LLM is an optional enhancement, see Decisions).
- Robustness/coverage guarantees for best-effort scrapers.

## Decisions

### `JobSource` interface mirrors the `LLMProvider` bridge
A minimal interface keeps the core decoupled, exactly like `lib/llm`:
```ts
interface JobSource {
  readonly name: string;           // "france-travail" | "apec" | ...
  readonly reliability: "high" | "medium" | "best-effort";
  fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]>;
}
```
`SearchCriteria` = `{ keywords: string[]; zone: Zone /* IDF dept codes */; }`. `RawOffer` is the common normalised shape (source, sourceLocalId, title, company?, location?, departmentCode?, url, description?, postedAt?, contractType?, romeCode?, raw?). A small registry maps connector name → factory; `lib/config` exposes `JOB_SOURCES` (enabled list, default `["france-travail"]`). *Alternative considered:* a class hierarchy / plugin loader — too heavy for a throwaway; a flat registry object is enough.

### Errors are isolated per connector (`Promise.allSettled`)
Aggregation runs enabled connectors concurrently and collects results with `allSettled`, so one connector throwing/timing-out yields zero offers + a recorded reason instead of failing the pass. Mirrors the "fail-soft, report clearly" stance of the existing `LLMProviderError`. A new `JobSourceError` carries the connector name. Each connector also gets a per-call timeout.

### France Travail = native `fetch`, no SDK; cached OAuth token; throttle; paginate
Use native `fetch` (Node 20+/Next 15) — no vendor SDK, consistent with the bridge philosophy. A small token client caches the bearer until `expires_in` and refreshes on demand. A simple ~3 req/s throttle and `range`-based pagination (stop at `Content-Range` total or the 1150 ceiling). For IDF, attempt `departement=75,77,...` once; on rejection, fall back to one request per department and dedup by source-local id. *Alternative:* a community wrapper lib — avoided to keep deps minimal and control auth/throttle.

### Scraping connectors use `cheerio`; headless is lazy/optional
APEC and WTTJ are HTML-scraped with `cheerio` (tiny, no browser). The best-effort trio (LinkedIn/Indeed/Glassdoor) needs a real browser; `playwright` is imported lazily (dynamic `import()`) and only when such a connector is explicitly enabled, so the core installs/runs without it and CI/`npm run build` stays light. *Alternative:* Puppeteer — Playwright chosen for better anti-bot handling and a single install path, but kept optional either way. Scrapers are inherently fragile; the spec already makes them non-load-bearing.

### Dedup = normalised fuzzy key on company + title + location
Compute a `dedupKey` = lowercased, accent-stripped, whitespace-collapsed `company | title | city`. Offers sharing a key collapse to one stored offer with N provenance rows. Re-runs upsert on `dedupKey` rather than inserting. *Alternative considered:* full fuzzy/edit-distance clustering or embeddings — overkill for the prototype; a normalised composite key handles the common "same posting syndicated to several boards" case. Edge cases (anonymised company) degrade to title+location; documented as a known limitation.

### Communication-only scope: filter then score
The crawl targets communication roles only. Two gates:
1. **Communication keyword filter** (inclusion gate): an offer must match the communication keyword set to be kept (e.g. "communication", "communication de crise", "relations presse", "chargé(e)/responsable/directeur de communication", "RP", "communication corporate/institutionnelle", "attaché de presse"). France Travail offers are also constrained at fetch time via `motsCles` so most non-communication offers never arrive. Optionally seed the fetch with the ROME family for communication roles (e.g. E1103) to tighten source-side relevance.
2. **Deterministic relevance score** (0–100, ranking within communication): for kept offers, match the offer text against the communication facet of the `CandidateProfile` (crisis comm, press relations, corporate/institutional, event management, FR/EN/PT) → score + short rationale ("matched: communication de crise, relations presse"). Journalism/media and academic/research categories are dropped from scoring for this slice.
This needs no LLM, so scoring works even when no provider is reachable (spec requirement) and avoids hundreds of CLI calls per crawl. An **optional** LLM re-scoring pass (via the existing bridge / `claude-code`) can refine the top-N later; scaffolded as a flag, not built into the baseline. *Alternative:* LLM-scores-every-offer — rejected for cost/latency on a prototype crawling potentially hundreds of offers.

### Persistence: three tables via the existing migration runner
New migration `0002_offers.sql`:
- `offers` — `id` (internal), `dedup_key` (unique), normalised fields, `score`, `score_rationale`, `category`, `first_seen_at`, `last_seen_at`.
- `offer_sources` — `offer_id` FK, `source` (connector name), `source_local_id`, `url`, `seen_at`; unique `(source, source_local_id)`. Gives dedup-with-provenance.
- `crawl_runs` — run bookkeeping (started_at, criteria, per-source counts, duplicates merged, total stored) for the discovery summary.
Storage helpers live in `lib/aggregation/store.ts`; follows the hand-rolled-SQL, no-ORM convention from Slice 0.

### Discovery pass surface mirrors the smoke check
`lib/aggregation/discover.ts` holds the shared core (run connectors → aggregate → dedup → score → persist → rank → summary), reused by `scripts/discover.ts` (CLI, like `scripts/smoke.ts`) and `GET /api/discover` (JSON, like `/api/smoke`). Default criteria target IDF + a communication-leaning keyword set, overridable via query/CLI args.

## Risks / Trade-offs

- **France Travail `departement` multi-value behaviour unconfirmed** → implement the per-department fallback from the start; dedup by source-local id makes either path safe.
- **Token endpoint/realm quirks** (`realm=/partenaire` mandatory, scope string exact) → centralise in one token client; on auth failure surface the raw status/body in the friendly error to debug fast.
- **Scrapers break when sites change their markup** → spec makes them opt-in and non-blocking; selectors isolated per connector file; failures recorded, never fatal.
- **Anti-bot blocks best-effort sources** → off by default; explicit-enable yields zero offers + reason, never a crash; no dependence in the deliverable.
- **Dedup false merges/splits** (anonymised employers, reworded titles) → normalised key is a pragmatic 80/20; fallback to title+location when company absent; documented limitation, acceptable for a prototype.
- **Rate-limit / volume** (1150-offer ceiling, ~3 req/s) → throttle + narrow filters (zone + keywords) keep volume well under the ceiling for this use case.
- **Over-engineering a throwaway** → no ORM, no plugin framework, native `fetch`, lazy/optional browser dep, deterministic scoring; LLM scoring deferred behind a flag.

## Migration Plan

- Additive only: new `lib/sources/`, `lib/aggregation/`, migration `0002_offers.sql`, `scripts/discover.ts`, `/api/discover`, new env vars in `.env.example`. No changes to existing Slice 0+1 modules' contracts.
- New deps: `cheerio` (required), `playwright` (optional — install only to use best-effort connectors).
- Deploy = run locally (`npm run discover` / hit `/api/discover`). Rollback = discard the change dir/branch and drop the new tables (or delete `data/tatiana.db`).
- France Travail credentials: user creates a free developer app on francetravail.io and sets `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET`; documented in `RUNNING.md` + `.env.example`.

## Open Questions

- **Communication keyword set** — RESOLVED. The inclusion gate + fetch `motsCles` use: `communication`, `relations presse`, `communication de crise`, `communication corporate/institutionnelle`, `chargé/responsable/directeur de communication`, `RP`. (Expand the slash-variants into their concrete forms when matching, e.g. "communication corporate", "communication institutionnelle", "chargé de communication", "responsable de communication", "directeur de communication"; match "RP" as a whole word to avoid false hits.) Refine with Tatiana after the first real run. Still open: whether to also seed the fetch with the communication ROME code(s) to tighten source-side relevance.
- **Score formula weights** (title vs description matches; how much crisis-comm / press-relations specialisations boost the score) — start simple, tune against the first real result set.
- **APEC access** — confirm whether a usable public/JSON endpoint exists or pure HTML scraping is required; resolve during implementation of that connector (does not block the France Travail deliverable).
