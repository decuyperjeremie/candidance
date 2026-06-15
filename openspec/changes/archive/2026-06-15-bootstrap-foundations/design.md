## Context

Greenfield throwaway prototype (see `FONDATIONS.md`). No existing code. This change establishes the runnable foundation: a Next.js app, SQLite storage, env/config handling, a structured candidate profile built from two source files, and a switchable LLM backend. Everything downstream (crawling, generation, UI, tracking) depends on these primitives, so the goal is a small, clean base — not feature completeness.

Constraints:
- Non-technical end user (Tatiana) — but this slice has no UI surface yet; the deliverable is verifiable via a script/route.
- Source of truth for the candidate is two files in `source/`; data must never be fabricated.
- Must support Claude (default) and a local Ollama model interchangeably.

## Goals / Non-Goals

**Goals:**
- A runnable Next.js (TypeScript, App Router) app at the repo root.
- SQLite wired with a migration mechanism (schema can grow in later slices).
- Typed config/env loading with validation and a committed `.env.example`.
- `profile-ingestion`: produce a validated `CandidateProfile` from CV `.docx` + LinkedIn `.md`.
- `llm-provider-bridge`: one `LLMProvider` interface, Claude + Ollama implementations, selected by config.
- An end-to-end smoke check: load the profile and run one LLM completion through the active provider.

**Non-Goals:**
- Any job source / crawling / aggregation / dedup.
- CV/letter generation, document export (PDF/DOCX), review UI, email handoff, application tracking.
- Production hardening, auth, multi-user, deployment.

## Decisions

- **Next.js App Router + TypeScript.** Chosen in FONDATIONS (single full-stack TS app). App Router is the current default; Route Handlers give us a simple place to expose a smoke-test endpoint.
- **SQLite via `better-sqlite3`.** Synchronous, zero-server, ideal for a local prototype. Alternative: Prisma — heavier than needed for a throwaway; revisit if the schema grows complex in later slices. A tiny hand-rolled migration runner (ordered `.sql` files) keeps it lightweight.
- **docx parsing via `mammoth`.** Converts `.docx` to HTML/text reliably; we already validated the raw XML extraction by hand. The committed `source/CV_Tatiana_27.05.md` serves as a reference/fallback for the expected structure. Alternative: parse the committed markdown directly — simpler, but the spec asks to ingest the `.docx` as the canonical source, so `mammoth` is primary with markdown as cross-check.
- **LinkedIn extract parsed from markdown.** `source/extract-linkedin.md` is structured (tables, sections); parse the known sections rather than free-form NLP.
- **Profile build = deterministic parse + merge, no LLM.** Ingestion must not fabricate, so it is pure parsing/merging. Conflicting facts (e.g. 20+ vs 24 years) are preserved (kept as provided / flagged), never silently resolved.
- **`CandidateProfile` validated with `zod`.** Single typed schema, runtime validation at load.
- **`LLMProvider` interface.** Minimal surface: `complete({ system, messages }) => string` (plus model/options). Claude impl uses the Anthropic SDK; Ollama impl uses its HTTP `/api/chat`. A factory reads `LLM_PROVIDER` and returns the impl. Fail-fast config validation (missing key, unknown provider, unreachable endpoint).
- **Config module** centralises env access (`LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`) with validation; `.env.example` documents them; real `.env` is git-ignored.

## Risks / Trade-offs

- **`.docx` parsing fidelity** (mammoth may flatten some structure) → cross-check against committed `source/CV_Tatiana_27.05.md`; the parser targets the known section headings.
- **Ollama not installed locally** → Claude remains the default; Ollama path is opt-in and fails with a clear "unreachable" error, not a crash.
- **No Anthropic key yet** (user must create one) → smoke check must degrade gracefully: profile-loading works without any LLM; the LLM step reports the missing key clearly.
- **Over-engineering a throwaway** → deliberately avoid Prisma/ORM and heavy abstractions; keep the migration runner and provider factory tiny.

## Migration Plan

Greenfield — no migration. Deploy = run locally (`npm run dev`). Rollback = discard the change directory / branch.

## Open Questions

- Exact `CandidateProfile` shape (how granular per experience) — resolve while writing the zod schema; err toward the fields the generation slice (C5) will need.
- Default Anthropic model id and default Ollama model name — pick sensible current defaults in config, overridable via env.
