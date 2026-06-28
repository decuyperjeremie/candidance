# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tatiana is a **throwaway personal prototype** (`prototype jetable`) — a single-user job-search assistant for one non-technical person (Tatiana Ávila Gomes). It crawls job offers from multiple sources, dedupes and scores them against her profile, generates ATS-optimized CV + cover letters per offer, and hands off to a **manual** email send. The guiding principle: automate everything up to the send, but **a human must validate before anything leaves** — no application is ever sent automatically.

`FONDATIONS.md` is the product/architecture spec (in French). `RUNNING.md` is the developer + end-user runbook. Read both for context that the code alone doesn't convey.

## Commands

```bash
npm run dev        # Next.js dev server -> http://localhost:3000
npm run build      # production build (REQUIRED for PDF rendering — see gotcha below)
npm start          # serve the production build
npm run lint       # next lint

npm run migrate    # apply pending SQL migrations to data/tatiana.db (auto-runs on db open too)
npm run smoke      # end-to-end check: load profile + 1 real LLM call via active provider
npm run smoke -- --no-llm          # profile only, no LLM
npm run discover                    # run a job-discovery pass (comm + Île-de-France)
npm run discover -- --keywords="relations presse" --departments=75,92 --limit=20
npm run generate -- --offer=<id>   # generate CV+letter (PDF+DOCX) for a stored offer
```

There is **no test runner** — `npm run smoke` (and the CLI scripts) are the verification path. CLI scripts under `scripts/` are thin wrappers (run via `tsx`) around the same `lib/` cores the API routes use; verify changes by running the relevant script or the matching `/api/*` route.

## Critical gotchas

- **PDFs only render in a production build.** Under `npm run dev`, pdfkit fails to load its `.afm` font metrics and PDF downloads / `.eml` attachments 500. DOCX works everywhere. To test PDF output: `npm run build && npm start`. `next.config.ts` keeps `better-sqlite3` and `pdfkit` as `serverExternalPackages` for this reason — don't remove that.
- **`.npmrc` pins the public npm registry** so installs are reproducible on any machine (the app ships to a non-developer's PC). Keep `package-lock.json` resolved against public npm.
- `better-sqlite3` is a native module (currently v12). Version bumps can break the portable install.

## Architecture

Full-stack **Next.js (App Router, TypeScript)**, single app, **SQLite** (better-sqlite3) for storage, no ORM. The `@/*` path alias maps to the repo root (see `tsconfig.json`). All real logic lives in `lib/`; `app/` (pages + `/api/*` routes) and `scripts/` (CLI) are thin shells over `lib/` cores so both entry points share one implementation.

### Two pluggable-provider bridges (the central pattern)

Both follow the same shape — an interface, concrete implementations behind it, and a factory/registry that picks one by config. Calling code depends only on the interface, never on a vendor SDK or a site's transport.

1. **LLM bridge** (`lib/llm/`) — interface `LLMProvider` (`types.ts`), selected by `LLM_PROVIDER` via `factory.ts`:
   - `claude-code` (**default**) — shells out to the local `claude` CLI in headless print mode (`claude -p --output-format json --max-turns 1`), using the machine's **Claude Max subscription, no API key**. This is the intended path. See `lib/llm/claude-code.ts`.
   - `ollama` — local model, free/offline.
   - `claude` — paid Anthropic API (separate billing, requires `ANTHROPIC_API_KEY`).
   - Prefer the `claude-code` provider / Claude Max over the paid API for any LLM work here.

2. **Job-source bridge** (`lib/sources/`) — interface `JobSource` (`types.ts`), one connector per site, wired by name in `registry.ts`. Adding a source = add a file + one line in the registry; aggregation/discovery code never changes. Connectors: `france-travail` (public API, default, the only one on unless `JOB_SOURCES` overrides), `apec` + `welcome-to-the-jungle` (scraping, opt-in, non-blocking), `linkedin`/`indeed`/`glassdoor`/`company-site` (best-effort, need the optional `playwright` dep via `crawl-backend.ts`).

### Config: fail-fast but lazy on secrets

`lib/config.ts` validates env with zod, cached, **fails fast on malformed values** (e.g. unknown `LLM_PROVIDER`) but validates **provider-specific secrets lazily** — only when that provider/connector actually runs. Result: profile loading, builds, and discovery with other sources all work with no keys configured. Missing credentials degrade gracefully (a clear per-source message + 0 offers), never a crash.

### Two pipelines

- **Discovery** (`lib/aggregation/discover.ts`): load profile → run enabled connectors (failures isolated per source) → filter (communication keywords + IDF zone) → dedupe inter-source (fuzzy key: company+title+location normalized) → score vs profile → upsert into SQLite. Shared by `scripts/discover.ts` and `/api/discover`.
- **Generation** (`lib/generation/generate.ts`): load offer + profile → LLM `adapt` → **zero-fabrication verify** → persist content → set status `générée`. Files (`cv.pdf`, `cv.docx`, `lettre.pdf`, `lettre.docx`) are rendered on download (`lib/render/`) from the persisted content, not at generation time.

### The zero-invention guardrail (core domain rule)

The whole point is passing ATS filters **without fabricating anything**. The LLM prompt forbids invention, but `lib/generation/verify.ts` enforces it deterministically: every generated experience/formation is traced back to a real `CandidateProfile` entry and **dropped if untraceable**; skills are restricted to ones the candidate actually has. Wording/ordering can change freely; invented entities and unsupported skills are removed and reported. When touching generation, preserve this guard — never weaken it to "improve" output.

### Profile = source of truth

`lib/profile/` assembles a validated `CandidateProfile` (zod) from `source/*.md` (the CV parsed from PDF + a merged LinkedIn extract). These markdown files in `source/` are the canonical facts the no-invention rule checks against.

### Local install + in-app updates

This ships to a non-developer's Windows PC via `setup/install.md` (run inside Claude Desktop). `lib/local-ops/` powers an in-app **"Mettre à jour"** button (`/api/update`, `app/ui/UpdateControl.tsx`) that git-fetches from GitHub, reinstalls, rebuilds, and restarts with a last-good-commit rollback. The repo is `https://github.com/decuyperjeremie/candidance`.

### Data model (SQLite, `lib/db/migrations/*.sql`)

Ordered `.sql` files, each applied once in filename order, tracked in `schema_migrations`. Key tables: `offers` (+ `offer_sources` for provenance, `crawl_runs` for pass history), `applications` (generated content + `status`), `application_events` (tracking history). Application status flow: `à_traiter` → `générée` → `validée` → `envoyée` → `relancée` → `réponse`. Add schema changes as a **new** additive migration file; don't edit applied ones.

## Conventions

- **User-facing strings are in French** (the user is French-speaking, non-technical). Code identifiers and comments are English; UI copy, error messages shown to the user, and CLI output are French. Match this when adding features.
- Errors use typed classes (`ConfigError`, `LLMProviderError`, `JobSourceError`, `GenerationError`) so callers can surface friendly messages instead of crashing. Follow this — degrade gracefully with a clear message rather than throwing raw.
- This repo uses **OpenSpec** (`openspec/`, `schema: spec-driven`) for spec-driven change management. Capability specs live in `openspec/specs/`; in-flight changes in `openspec/changes/<name>/` (proposal + design + tasks), archived when done. Use the `openspec-*` / `opsx:*` skills to propose/apply/archive changes rather than editing specs ad hoc.
