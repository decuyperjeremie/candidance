## Why

Tatiana is a throwaway prototype to help a non-technical job seeker find offers, adapt her applications, and pass ATS filters (see `FONDATIONS.md`). Before any of the value-delivering slices (crawling, generation, UI) can be built, the project needs a runnable foundation: an app shell, persistent storage, a structured candidate profile that acts as the single source of truth, and a swappable LLM backend. This change delivers Slice 0 + Slice 1 — the scaffolding everything else builds on.

## What Changes

- Scaffold a **Next.js app** (TypeScript, App Router) at the repo root.
- Add **SQLite** storage with a minimal schema bootstrap (tables for later slices can grow; this slice only needs the DB wired and migratable).
- Add **config/env management** for secrets (Anthropic API key, provider selection, Ollama endpoint), with a committed `.env.example` and runtime validation.
- Introduce capability **`profile-ingestion`**: parse the candidate CV (`source/CV_Tatiana_27.05.docx`) and merge it with the LinkedIn extract (`source/extract-linkedin.md`) into one structured `CandidateProfile`. The profile is the **source of truth** and must contain only facts present in the source files — no fabrication.
- Introduce capability **`llm-provider-bridge`**: a single `LLMProvider` interface with two interchangeable implementations — Claude (Anthropic API, default) and a local Ollama model — selected via config/env.
- Provide a way to verify the foundation end-to-end: load Tatiana's structured profile and run a test LLM completion through the active provider.

Out of scope (later slices): job sources/crawling, offer aggregation/dedup, CV+letter generation, review UI, email handoff, application tracking.

## Capabilities

### New Capabilities
- `profile-ingestion`: Parse the CV `.docx` and LinkedIn markdown extract into a single validated, structured `CandidateProfile` used as the source of truth; never invents data not present in the sources.
- `llm-provider-bridge`: A provider-agnostic `LLMProvider` interface with Claude (Anthropic) and Ollama (local) implementations, switchable by configuration.

### Modified Capabilities
<!-- None — greenfield project, no existing specs. -->

## Impact

- **New project tooling**: Next.js, TypeScript, App Router, SQLite driver, docx parser, Anthropic SDK, Ollama client.
- **New files/dirs**: app scaffold, `lib/profile/`, `lib/llm/`, `lib/db/`, `.env.example`.
- **Secrets**: introduces `ANTHROPIC_API_KEY`, `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` env vars.
- **Source files consumed**: `source/CV_Tatiana_27.05.docx`, `source/extract-linkedin.md`.
- **Foundation for**: all subsequent slices (job-sources, offer-aggregation, application-generation, review-ui, email-handoff, application-tracking).
