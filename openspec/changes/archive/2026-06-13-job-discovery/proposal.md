## Why

Slice 0 + 1 gave Tatiana a runnable foundation and a structured `CandidateProfile`, but no offers to act on. The first visible value of the product is a curated list of **real** job offers: aggregated from several sites, de-duplicated across sources, stored locally, and scored for relevance against her profile (see `FONDATIONS.md` §4, §8 — capabilities C3 + C4). Without this slice there is nothing for the later "adapt / apply / track" slices to operate on. This change delivers Slice 2 — *Trouver*.

## What Changes

- Introduce a **pluggable connector architecture**: a single `JobSource` interface, one connector per site, each returning **normalised** offers. Adding a site later = adding one file, no core changes.
- Wire the first **reliable, free** source: **France Travail** (public "Offres d'emploi v2" API, OAuth2 `client_credentials`). This is the only mandatory source for the slice deliverable.
- Add **APEC** and **Welcome to the Jungle** connectors as further reliable/medium sources (scraping where no API exists), behind the same interface, **opt-in and non-blocking** — a connector that fails or is disabled never breaks aggregation.
- Treat **LinkedIn / Indeed / Glassdoor** as **best-effort** (headless browser): scaffolded behind the interface and **off by default**; the slice does not depend on them.
- Introduce **offer aggregation**: run the enabled connectors, **de-duplicate inter-source** (same offer on several sites → one stored entry; fuzzy key = normalised company + title + location), **persist to SQLite**, record which sources surfaced each offer.
- **Scope the crawl to communication roles only** (corporate / institutional / crisis communication, press relations — the core of Tatiana's profile). Journalism/media and academic/research are explicitly out of scope for this slice's discovery, even though the profile spans them.
- **Score relevance** of each stored offer against the communication facet of the `CandidateProfile`, deterministically first; produce a 0–100 score with a short rationale.
- Apply **filters**: geographic zone (Paris / Île-de-France — departments 75, 77, 78, 91, 92, 93, 94, 95) and **communication** keywords, scoped to French-language offers. Non-communication offers are excluded.
- Expose a **runnable discovery pass** (script + JSON route) that crawls on demand, aggregates, scores, stores, and returns the ranked list — the testable, showable deliverable for this slice.

Out of scope (later slices): CV/letter generation, document export, review UI surface (a polished list view is Slice 4 / C6), email handoff, application tracking, scheduled/automatic crawling (on-demand button only for the prototype).

## Capabilities

### New Capabilities
- `job-sources`: A provider-agnostic `JobSource` connector interface and its implementations (France Travail first; APEC, WTTJ; best-effort LinkedIn/Indeed/Glassdoor), each fetching site offers and normalising them to a common `RawOffer` shape. Selectable/enableable by configuration; failures are isolated per connector.
- `offer-aggregation`: Inter-source de-duplication, SQLite persistence of normalised offers and their source provenance, relevance scoring against the `CandidateProfile`, and zone/keyword filtering — producing one ranked, de-duplicated offer list.

### Modified Capabilities
<!-- None — both capabilities are new. profile-ingestion and llm-provider-bridge are consumed as-is, not modified at the spec level. -->

## Impact

- **New dependencies**: an HTTP layer for the France Travail OAuth2 + search calls (native `fetch`, no SDK); a lightweight HTML parser for scraping connectors (e.g. `cheerio`); a headless-browser dep (e.g. `playwright`) only for the best-effort connectors, kept optional/lazy so the core slice installs and runs without it.
- **New env/config**: `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`, and connector-enable flags (e.g. `JOB_SOURCES=france-travail,apec`); documented in `.env.example`. France Travail credentials are free (developer account on francetravail.io).
- **New DB schema**: migration adding `offers` (normalised offer + relevance score + rationale), `offer_sources` (provenance: which `JobSource` + original URL + per-source id, enabling dedup-with-provenance), and crawl-run bookkeeping.
- **New files/dirs**: `lib/sources/` (interface + connectors + normalisation), `lib/aggregation/` (dedup, scoring, filters, persistence), a discovery script under `scripts/`, and a `GET /api/discover` route.
- **Consumes existing**: `lib/profile` (`CandidateProfile` for scoring), `lib/config` (env), `lib/db` (storage + migration runner). The `llm-provider-bridge` is available for an optional LLM-assisted scoring pass but the baseline scoring is deterministic (decided in design.md).
- **Foundation for**: Slice 3 (application-generation reads stored offers) and Slice 4 (review UI lists them, tracking references them).
