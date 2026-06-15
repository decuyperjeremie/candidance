## 1. Scaffold Next.js app

- [x] 1.1 Initialize a Next.js app (TypeScript, App Router) at the repo root, preserving existing files (`FONDATIONS.md`, `source/`, `openspec/`, `.claude/`, `.gitignore`)
- [x] 1.2 Configure `tsconfig.json` path aliases (e.g. `@/lib/*`) and confirm `npm run dev` boots a blank page
- [x] 1.3 Add a minimal landing route confirming the app runs (placeholder, no product UI)

## 2. Config & environment

- [x] 2.1 Create a typed config module that reads and validates env vars: `LLM_PROVIDER` (default `claude`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- [x] 2.2 Fail fast with clear errors on unknown `LLM_PROVIDER` or missing required values for the selected provider
- [x] 2.3 Add a committed `.env.example` documenting every variable; confirm real `.env` is git-ignored

## 3. SQLite storage

- [x] 3.1 Add `better-sqlite3` and a `lib/db` module that opens/creates the SQLite database file
- [x] 3.2 Implement a tiny ordered-`.sql` migration runner and an initial migration (bootstrap/meta table; product tables added in later slices)
- [x] 3.3 Verify the DB initializes on first run without manual steps

## 4. Capability: profile-ingestion

- [x] 4.1 Define the `CandidateProfile` zod schema (contact, headline, experiences, formations, skills, languages, publications)
- [x] 4.2 Parse `source/CV_Tatiana_27.05.docx` with `mammoth` into an intermediate representation of the known sections
- [x] 4.3 Parse `source/extract-linkedin.md` sections (headline, experiences, achievements, skills, years of experience)
- [x] 4.4 Merge CV + LinkedIn into one `CandidateProfile`; preserve/flag conflicting facts instead of silently dropping either
- [x] 4.5 Enforce no-fabrication: only data traceable to the source files; missing optional fields stay empty
- [x] 4.6 Handle the missing-CV case with a clear error naming the expected path
- [x] 4.7 Expose a `loadCandidateProfile()` that returns a validated profile or a validation error

## 5. Capability: llm-provider-bridge

- [x] 5.1 Define the `LLMProvider` interface (`complete({ system, messages, ...opts }) => string`)
- [x] 5.2 Implement the Claude provider using the Anthropic SDK (uses `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`); missing key fails fast before any network call
- [x] 5.3 Implement the Ollama provider against the local HTTP API (`OLLAMA_BASE_URL` + `OLLAMA_MODEL`); unreachable endpoint returns a clear error
- [x] 5.4 Implement a factory that returns the active provider from `LLM_PROVIDER` with no caller code changes
- [x] 5.5 Ensure no application code imports a vendor SDK directly — only the `LLMProvider` interface

## 6. End-to-end smoke check

- [x] 6.1 Add a smoke route/script that loads the `CandidateProfile` and prints a short structured summary (works with no LLM key)
- [x] 6.2 Extend it to run one LLM completion through the active provider (e.g. "summarize this candidate in one line"), reporting a clear message if the provider is unconfigured/unreachable
- [x] 6.3 Manually verify the smoke check with `LLM_PROVIDER=claude` (if a key is available) and document how to run it with `ollama`

## 7. Wrap-up

- [x] 7.1 Update `README` (or a short `RUNNING.md`) with setup steps: install, `.env`, run dev, run smoke check
- [x] 7.2 Confirm `npm run build` (or `next build`) succeeds with no type errors
