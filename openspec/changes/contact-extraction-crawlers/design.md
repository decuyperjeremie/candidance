## Context

Tatiana's connector layer (`lib/sources/`) already normalises offers behind a `JobSource` interface (`RawOffer`), aggregates/de-dups/scores/persists them (`lib/aggregation/`), and hands a generated application off to the user's mail client (`lib/email/draft.ts` builds the `mailto:`; `eml.ts` builds the `.eml`). Today none of this captures *how to apply*: `draft.ts` always leaves the recipient blank, and the France Travail connector's `FtOffer` type doesn't even parse the `contact` object.

A live France Travail call (`GET /offres/v2/offres/search`) confirmed the trap: the `contact` object exists but its `courriel` field is usually redirect text — `"Pour postuler, utiliser le lien suivant : https://candidat.francetravail.fr/offres/recherche/detail/<id>"` — not an address. `urlPostulation` (external apply URL) appears on some offers; `origineOffre.urlOrigine` is always present. So we cannot trust an "email" field by name; we must validate it.

Separately, the user wants the best-effort crawlers (Indeed, LinkedIn, Welcome to the Jungle, Glassdoor) plus direct company career sites turned into real, selectable connectors, each also yielding a contact.

Constraints: Île-de-France + French-language; prototype stack (Next.js, better-sqlite3, tsx scripts); aggregation/discovery depend only on the `JobSource` interface; crawl/headless deps must be optional and lazy; no-invention rule.

## Goals / Non-Goals

**Goals:**
- One shared, source-independent extractor turning any raw payload into `OfferContact { method, email?, applyUrl?, contactName? }`, email-preferred, link-fallback, never fabricated.
- France Travail connector parses `contact` + `origineOffre` and emits an `OfferContact` (validating `courriel`).
- `contact` carried on `RawOffer`, merged across sources in dedup, persisted via a new migration, read back on `StoredOffer`.
- Email-handoff uses the extracted email as recipient when present; surfaces the apply URL otherwise.
- Crawler connectors (Indeed, LinkedIn, WTTJ, Glassdoor, company-site) selectable, off by default, non-blocking, each emitting contact, behind a pluggable crawl backend.

**Non-Goals:**
- Sending email (handoff stays manual — unchanged).
- Scheduling/automated crawling (discovery stays on-demand).
- Hardened, production-grade per-site scrapers or anti-bot defeat — best-effort only.
- Enriching contacts by visiting external pages from the France Travail connector (it uses only what the API returns).

## Decisions

### `OfferContact` as a small tagged shape, optional on `RawOffer`
`type OfferContact = { method: "email" | "url" | "none"; email?: string; applyUrl?: string; contactName?: string }`. Add `contact?: OfferContact` to `RawOffer` (optional → existing connectors compile; absent stays absent). The `method` tag makes downstream branching (mailto vs apply-link) explicit and testable rather than inferring from which optional field is set.
- *Alternative considered*: separate `contactEmail?`/`applyUrl?` fields with no tag. Rejected — callers would re-derive precedence everywhere; a single `method` centralises the "email > url > none" rule.

### A single `extractContact(input)` helper in `lib/sources/contact.ts`
Connectors pass the candidate signals they have (raw email-ish string, candidate URLs, name). The helper: (1) regex-validates the email-ish string as a real address; (2) if it's not an address but contains a URL, lifts that URL into the apply-URL candidates; (3) picks the first valid email, else the first http(s) URL, else `none`. Email regex is intentionally simple/pragmatic (`/[^\s@]+@[^\s@]+\.[^\s@]+/`) — goal is rejecting redirect prose, not RFC-perfect validation.
- *Alternative considered*: per-connector ad-hoc parsing. Rejected — duplicates the France Travail trap-handling into every source.

### France Travail mapping
Extend `FtOffer` with `contact?: { nom?; courriel?; urlPostulation? }`. In `normalise`, call `extractContact({ emailish: contact.courriel, urls: [contact.urlPostulation, origineOffre.urlOrigine], name: contact.nom })`. Given the live data, most FT offers resolve to `method = "url"` (urlOrigine), some to `"email"`.

### Persistence: columns on `offers`, merge in dedup
Add a migration `0006_offer_contact.sql` adding `contact_method`, `contact_email`, `contact_url`, `contact_name` to `offers`. Merge during dedup by strongest method (`email` > `url` > `none`) so multi-source offers keep the best apply path. Store/read in `lib/aggregation/store.ts`; extend `StoredOffer`.
- *Alternative considered*: put contact on `offer_sources` (per-source). Deferred — the consumer (email-handoff) wants one best contact per offer; per-source provenance of contact is not needed for the slice. Offer-level column + merge is simpler.

### Email-handoff wiring
`buildDraft` already takes an optional `recipient`. Default it from `offer.contact` when `method === "email"`. The offer detail page (`app/offres/[id]/`) chooses the apply action: email present → mailto; else `applyUrl` → "Postuler en ligne"; else posting URL; else blank mailto.

### Pluggable crawl backend for best-effort connectors
Keep the existing lazy-Playwright pattern in `best-effort.ts` as the default backend, but route it through a thin `CrawlBackend` seam (`fetchRendered(url) -> html`) so Firecrawl/Obscura can be dropped in by config later without touching connectors. Add a `company-site` connector for direct career pages. WTTJ keeps its cheerio path. All emit contact via `extractContact` over the rendered HTML (scan `mailto:` links + apply buttons).
- *Alternative considered*: commit to one crawl tool now. Rejected — the user is explicitly undecided (Playwright vs Firecrawl vs Obscura); a seam keeps the choice open and the connectors stable.

## Risks / Trade-offs

- **False-positive emails** (e.g. an address in body text that isn't the recruiter's) → only read email from contact-designated fields/`mailto:` links, never free-text body scraping; when unsure, prefer `url`.
- **France Travail `urlOrigine` is a candidate-portal redirect, not a direct apply** → acceptable: it's a real, working apply path; email simply wins when present.
- **Crawlers blocked / markup drift** → already covered by best-effort spec (yield `[]` + recorded reason, never fatal); contact extraction inherits the same isolation.
- **Migration on an existing DB** → additive `ALTER TABLE ADD COLUMN` (nullable), consistent with `0003`; no backfill needed (re-running discovery repopulates).
- **Optional crawl deps** → backend import stays lazy/try-caught; core install/run unaffected if absent.

## Migration Plan

1. Ship code + `0006_offer_contact.sql`; migration runner applies it on next `getDb()`.
2. Re-run discovery to populate contact on existing offers (additive; old rows simply read `contact_method = "none"` until re-seen).
3. Rollback: columns are additive and nullable; reverting code leaves them unread (no destructive step).

## Open Questions

- Final crawl backend (Playwright vs Firecrawl vs Obscura) — deferred behind the `CrawlBackend` seam; pick when hardening a specific site.
- Should `company-site` discovery be seeded from a configured company list, or derived from offers already found elsewhere? (Leaning: configured seed list for the prototype.)
