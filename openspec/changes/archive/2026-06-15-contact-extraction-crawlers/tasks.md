## 1. Shared contact extractor

- [x] 1.1 Add `OfferContact` type (`{ method: "email" | "url" | "none"; email?; applyUrl?; contactName? }`) to `lib/sources/types.ts` and add optional `contact?: OfferContact` to `RawOffer`.
- [x] 1.2 Create `lib/sources/contact.ts` with `extractContact(input: { emailish?; urls?: (string | undefined)[]; name? }): OfferContact`: regex-validate the email, lift any URL embedded in non-email `emailish` text into the URL candidates, then pick email → first http(s) URL → `none`.
- [x] 1.3 Add a `firstEmail`/`firstUrl` helper + an email regex that rejects redirect prose (e.g. "Pour postuler, utiliser le lien suivant : https://…").
- [x] 1.4 Unit-test the extractor against the live FT shapes: valid `courriel`, redirect-text `courriel` + `urlOrigine`, empty `contact: {}`, and a real `mailto:`-style address.

## 2. France Travail connector emits contact

- [x] 2.1 Extend `FtOffer` in `lib/sources/france-travail.ts` with `contact?: { nom?; courriel?; urlPostulation? }` (keep parsing defensive).
- [x] 2.2 In `normalise`, call `extractContact({ emailish: o.contact?.courriel, urls: [o.contact?.urlPostulation, o.origineOffre?.urlOrigine], name: o.contact?.nom })` and set `contact` on the returned `RawOffer`.
- [x] 2.3 Verify with a real call (or recorded fixture) that redirect-text offers resolve to `method = "url"` and any real address resolves to `method = "email"`.

## 3. Persist + merge contact

- [x] 3.1 Add migration `lib/db/migrations/0006_offer_contact.sql` adding nullable `contact_method`, `contact_email`, `contact_url`, `contact_name` to `offers`.
- [x] 3.2 Merge contact across sources in `lib/aggregation/dedup.ts` by strongest method (`email` > `url` > `none`).
- [x] 3.3 Write contact columns in `persistOffers` and read them back into `StoredOffer` (`mapOfferRow`, `OFFER_COLUMNS`) in `lib/aggregation/store.ts`.
- [x] 3.4 Confirm `npm run discover` repopulates contact and that re-running does not duplicate or wipe it.

## 4. Email-handoff wiring

- [x] 4.1 In `lib/email/draft.ts`, default `recipient` from `offer.contact.email` when `method === "email"`.
- [x] 4.2 In the offer detail page (`app/offres/[id]/`) + email actions, choose the apply action: email → `mailto:`; else `applyUrl` → "Postuler en ligne"; else posting URL; else blank `mailto:` draft.
- [x] 4.3 Verify the three handoff paths render correctly for offers with email / url / none.

## 5. Crawler connectors (best-effort, off by default)

- [x] 5.1 Introduce a thin `CrawlBackend` seam (`fetchRendered(url) -> html`) in `lib/sources/` wrapping the existing lazy-Playwright loader; keep the dependency optional and lazily imported.
- [x] 5.2 Update LinkedIn / Indeed / Glassdoor connectors (`lib/sources/best-effort.ts`) to route through the seam and emit `OfferContact` via `extractContact` over the rendered offer HTML (`mailto:` links + apply buttons).
- [x] 5.3 Ensure Welcome to the Jungle (`welcome-to-the-jungle.ts`) also emits contact via the shared extractor.
- [x] 5.4 Add a `company-site` connector for direct company career pages (seeded from a configured company list), behind `JobSource`, best-effort, emitting contact; register it in `registry.ts` and add `company-site` to `JobSourceName` in `lib/config`.
- [x] 5.5 Document the new sources + any crawl-backend config (Playwright/Firecrawl/Obscura) in `.env.example`, keeping them disabled by default.

## 6. Validate

- [x] 6.1 Run `npm run discover` with `france-travail` only and confirm contacts are populated and stored.
- [x] 6.2 Enable one crawler with the crawl backend installed and confirm it yields offers with contacts, and yields `[]` (not a crash) when blocked or when the backend is absent.
- [x] 6.3 Run `openspec validate contact-extraction-crawlers --strict` and `npm run build`/typecheck.
