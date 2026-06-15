## Why

Tatiana can find offers but can't tell the user *how to apply*: it never captures the recipient email or apply link an offer carries. A live France Travail call confirms the data exists (a `contact` object) but is booby-trapped — its `courriel` field is almost always redirect text ("Pour postuler, utiliser le lien suivant : https://candidat.francetravail.fr/…"), not a real address. We need a provider-agnostic way to extract a *usable* contact (prefer a real email, else an apply URL), so the email-handoff can pre-fill a recipient and the crawler sources we want to add (Indeed, LinkedIn, Welcome to the Jungle, Glassdoor, company sites) can feed the same shape.

## What Changes

- Introduce a shared **contact extractor**: from any source's raw payload, produce a normalised `OfferContact` of the form `{ method: "email" | "url" | "none", email?, applyUrl?, contactName? }`, **preferring a validated email, then an apply URL, then nothing** — never fabricating an address.
- Make the France Travail connector parse the previously-ignored `contact` object (`courriel`, `urlPostulation`, `nom`) plus `origineOffre.urlOrigine`, validate `courriel` as a real email before trusting it, and emit an `OfferContact`.
- Add an optional `contact` field to the normalised `RawOffer` shape; every connector populates it (absent data stays absent).
- **Persist** contact on stored offers/provenance via a new migration, and read it back on `StoredOffer`.
- Wire contact into **email-handoff**: when a real email is known, pre-fill it as the `mailto:` recipient; when only an apply URL is known, surface that link as the apply action instead of a blank recipient.
- Extend **job-sources** with first-class crawler connectors for **Indeed, LinkedIn, Welcome to the Jungle, Glassdoor, and direct company career sites** ("site en direct"), each emitting contact via the shared extractor. They stay best-effort: off by default, non-blocking, with scraper/headless deps optional and lazily loaded. The crawl tool (Playwright / Firecrawl / Obscura) is an implementation detail behind the connector.

## Capabilities

### New Capabilities
- `contact-extraction`: provider-agnostic extraction of a usable apply contact (validated email preferred, apply URL fallback, otherwise none) from any source's raw offer payload, behind a shared interface every connector feeds.

### Modified Capabilities
- `job-sources`: every connector emits an `OfferContact`; the best-effort crawler set is broadened to Indeed, LinkedIn, Welcome to the Jungle, Glassdoor, and direct company career sites, with a pluggable crawl backend.
- `offer-aggregation`: aggregated/stored offers carry and persist the extracted contact (with provenance), merged across sources.
- `email-handoff`: the pre-filled recipient comes from the extracted email when present; otherwise the apply URL is surfaced as the apply action.

## Impact

- Code: `lib/sources/contact.ts` (new), `lib/sources/types.ts` (RawOffer + `OfferContact`), `lib/sources/france-travail.ts` (parse `contact`), `lib/sources/best-effort.ts` + new company-site connector, `lib/sources/registry.ts`, `lib/aggregation/dedup.ts` + `store.ts`, `lib/email/draft.ts`, the offer detail page / email actions under `app/`.
- Data: new SQLite migration adding contact columns to `offers` (and/or `offer_sources`).
- Dependencies: optional/lazy crawl backend (Playwright already scaffolded; Firecrawl/Obscura optional) — core install/run must not require it.
- Scope unchanged: Île-de-France, French-language; aggregation/discovery code keeps depending only on the `JobSource` interface.
