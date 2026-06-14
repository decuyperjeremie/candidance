## Context

Slice 3 (*Adapter*) is the product's core value: turn a stored offer + Tatiana's `CandidateProfile` into a ready-to-send, ATS-friendly CV and cover letter (`FONDATIONS.md` §5, §8 / C5). It builds on Slice 0–2: `lib/profile` (the source-of-truth profile), `lib/llm` (the switchable provider bridge, default `claude-code`), `lib/aggregation/store` (stored offers), `lib/db`, `lib/config`.

Constraints from `FONDATIONS.md`:
- **Zero fabrication** is the non-negotiable rule (§5): the AI reformulates and prioritises real facts; it never invents.
- Non-technical end user; throwaway prototype — keep it light, no over-engineering.
- LLM defaults to `claude-code` (Claude Max subscription, no paid API); generation must work through the existing `LLMProvider.complete` interface and degrade gracefully when unconfigured.
- Output must be **PDF + DOCX** (§6): PDF universal, DOCX editable / sometimes required.

Research input (verified 2025-26; see proposal):
- **Anti-ATS rules**: single column; no tables/text-boxes/images/icons; contact in the body (ATS often ignore header/footer); standard fonts (Arial/Calibri/Garamond…); conventional section headings; reverse-chronological; unambiguous dates (`MM/AAAA`); reinject the offer's exact title/skills naturally (no stuffing of unsupported skills); PDF must be selectable text, not an image; producing **both** PDF and DOCX is the safe choice across modern and legacy ATS.
- **Libraries (pure-JS, no headless browser, Node runtime)**: `docx` (dolanmiu, v9.7.x, TS-native, single-column by default) for DOCX; `pdfkit` (v0.19.x) + `@types/pdfkit` for selectable-text PDF. No pure-JS lib renders full HTML/CSS to *selectable* PDF, and HTML→DOCX converters are unmaintained — so a shared structured model feeding two small native renderers beats an HTML-template approach.

## Goals / Non-Goals

**Goals:**
- An `ApplicationContent` structured model (adapted CV sections + letter text) — the single source for both renderers.
- LLM adaptation through `LLMProvider.complete`, returning that structure, tailored to the offer, in French.
- A deterministic **zero-fabrication verification** step gating the output.
- ATS-compliant `docx` and `pdfkit` renderers sharing the model.
- Persistence of generated applications (one per offer, upsert).
- A runnable surface: `npm run generate -- --offer=<id>` + API generate route + four download routes.

**Non-Goals:**
- Review/edit UI surface and the validate flow (Slice 4 / C6).
- Email handoff, `.eml`/`mailto:` (C7); status tracking (C8); automatic sending.
- A pixel-perfect/designer CV — ATS-parsability and truthfulness trump visual flourish.
- LLM fine-tuning, multi-candidate, or non-French output.

## Decisions

### Structured content model first; LLM fills it, renderers consume it
Define `ApplicationContent`: `{ cv: { headline, summary, contact, experiences[], formations[], skills[], languages[] }, letter: { recipientContext?, paragraphs[] } }` (zod-validated). The LLM returns this as JSON; `docx` and `pdfkit` each render it. *Why:* one model keeps PDF and DOCX identical and makes the zero-fabrication check operate on structured data, not prose. *Alternative rejected:* LLM emits two free-text documents → impossible to verify facts or guarantee identical content across formats.

### LLM returns JSON, validated with zod; one repair retry
The adaptation prompt instructs the provider to return ONLY a JSON object matching the schema. We parse + zod-validate; on failure, one repair attempt (feed the error back) before surfacing a clear error. `complete()` already returns text, so this stays within the existing bridge — no new provider surface. *Why:* structured, checkable output without coupling to any vendor's tool-calling. *Risk:* smaller/local models (Ollama) may produce messy JSON → the repair retry + clear error handle it; `claude-code` (default) handles JSON well.

### Zero-fabrication = constrained input + deterministic post-check
Two layers: (1) the prompt is given ONLY the profile facts + offer text, with an explicit "never invent; only reword/reorder/select" system instruction; (2) a deterministic verifier maps every generated CV experience/formation back to a `CandidateProfile` entry (by organisation + period / degree + institution, using the normalisation already in `lib/aggregation/text`). Unmatched entries are dropped and recorded; if core content is missing, the run is flagged. *Why:* the prompt alone is not a guarantee; the post-check is the real guardrail (§5). *Trade-off:* the verifier matches structural facts (jobs, diplomas), not every adjective — wording is allowed to change; invented *entities/dates* are caught. Documented limitation: a fabricated bullet inside a real job is not structurally detectable; mitigated by the constrained prompt and by surfacing the source profile for human review (Slice 4).

### ATS rendering rules baked into both renderers
Shared constants (font family/sizes, headings "Expérience professionnelle / Formation / Compétences / Langues", spacing). `docx`: stacked `Paragraph`s, no `columns`, no tables, contact lines as body paragraphs. `pdfkit`: linear `text()` flow, real font (selectable text), single column, no images. Dates normalised to `MM/AAAA`. *Why:* directly encodes the verified anti-ATS guidance; both emit native selectable text. *Note:* French section headings' ATS parsing is unverified (research) — we use standard FR headings as a reasonable default for the French market; revisit if needed.

### Persistence: one `applications` row per offer (upsert)
Migration `0004_applications.sql`: `applications(id, offer_id FK UNIQUE, cv_json TEXT, letter_text TEXT, provider TEXT, model TEXT, created_at, updated_at)`. Upsert on `offer_id` so regenerating updates in place. Files are NOT stored as blobs — they are re-rendered on demand from `cv_json`/`letter_text` (cheap, keeps the DB small, lets us tweak rendering without re-running the LLM). *Why:* persistence enables Slice 4 editing; re-rendering from content avoids stale binaries.

### Surface mirrors prior slices
`lib/generation/generate.ts` shared core (load offer + profile → adapt → verify → persist → return content + summary), reused by `scripts/generate.ts` (CLI, like `scripts/discover.ts`) and `POST /api/applications/generate`. Downloads: `GET /api/applications/[offerId]/[file]` where file ∈ `cv.pdf|cv.docx|lettre.pdf|lettre.docx`, rendered on the fly with correct `Content-Type` + `Content-Disposition: attachment`. Node runtime (`docx`/`pdfkit` need Node buffers/streams, not Edge).

## Risks / Trade-offs

- **LLM invents despite instructions** → constrained input + deterministic structural verifier (drops untraceable entities); human review in Slice 4 as backstop. Residual: fabricated detail inside a real role — documented, not auto-detectable.
- **Malformed JSON from the model** → zod validation + one repair retry + clear error; default `claude-code` handles JSON reliably.
- **DOCX/PDF drift** → single shared `ApplicationContent`; renderers only lay out, never add content.
- **ATS heading language unverified (FR)** → use standard FR headings; easy to switch to EN per-offer later.
- **Over-engineering a throwaway** → pure-JS libs, no headless browser, re-render from stored content (no binary storage), tiny upsert table.
- **Provider latency/cost** → one LLM call per generation (plus at most one repair); on-demand only.

## Migration Plan

- Additive: new `lib/generation/`, `lib/render/`, migration `0004_applications.sql`, `scripts/generate.ts`, API routes, new deps (`docx`, `pdfkit`, `@types/pdfkit`). No changes to Slice 0–2 module contracts.
- Deploy = run locally (`npm run generate -- --offer=<id>`, or POST the route, then download). Rollback = discard the change dir/branch and drop the `applications` table.

## Open Questions

- **Letter length/tone** — default to a concise 3–4 paragraph professional French letter; refine with Tatiana after the first real output.
- **Recipient/company address block** — offers rarely include a contact; the letter will address the company/role generically unless the offer provides a name. (Full recipient + email is C7/Slice 4.)
- **How aggressively to prioritise** which experiences to surface for a given offer (all vs top-N most relevant) — start by keeping all real experiences but reordering/weighting toward the offer; tune later.
- **Ollama JSON reliability** — acceptable as the free fallback; `claude-code` remains the default for quality.
