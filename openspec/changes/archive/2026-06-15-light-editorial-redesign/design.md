## Context

Reskin of the whole web UI to a light editorial language, token-driven, keeping Next server components and inline-style-friendly structure (no component library). Today every page hardcodes its own colours/spacing inline (dark `#0b0b0f`, cyan `#7fd4ff`). We replace that with a shared token layer and reusable base classes, then apply it everywhere. Behaviour is untouched.

Constraints: throwaway prototype, no over-engineering; server components; no UI library; behaviour and generated documents unchanged.

## Goals / Non-Goals

**Goals:**
- One token source of truth; consistent type/colour/spacing/lines across all surfaces.
- Light editorial feel: off-white canvas, serif display + sans body, hairline rules, calm whitespace, one restrained accent.
- Apply to nav, home, `/offres`, `/offres/[id]` (all blocks), `/suivi`.
- Accessible contrast; readable for a non-technical user.

**Non-Goals:**
- Any behaviour change; any change to the generated CV/letter (PDF/DOCX keep their template look).
- A component library, CSS-in-JS lib, or Tailwind.
- A dark theme / theme switcher (light only for now).

## Decisions

### Tokens as CSS custom properties + a small TS mirror
`app/globals.css` defines `:root` variables — the single source of truth — and base element styles + a few reusable classes (`.card`, `.chip`, `.btn`, `.btn-primary`, `.section-rule`, `.muted`). Components use `className` plus inline `var(--token)` where dynamic. `app/ui/tokens.ts` mirrors the handful of values needed in JS (e.g. score-band and status colours). *Why:* CSS vars are the cleanest token store for server components without a lib; the TS mirror avoids magic numbers in logic. *Trade-off:* two small places hold colours — kept minimal and named identically.

### Proposed token set (tune at review)
- **Colour:** canvas `#faf9f6`, surface `#ffffff`, ink `#1b1a17`, muted `#6f6b62`, hairline `#e7e3da`, accent `#1f4e79` (the deep blue already used by the CV rule), accent-soft wash for chips. Status/score colours restated as calm tints.
- **Type:** display serif **Fraunces** (headings, optical) + body sans **Inter**, via `next/font/google` (self-hosted, no layout shift). Scale ≈ 14 / 16 / 20 / 28 / 40 with generous line-height; letter-spacing tightened on display.
- **Space:** 4-based scale (4/8/12/16/24/32/48). **Radii:** small (6–8px) or none for editorial crispness. **Lines:** 1px hairlines in `--hairline`.

### Light editorial patterns
Cards become near-flat: white surface, hairline border, ample padding, no heavy shadow. Section titles use the serif with a thin rule (mirrors the CV's blue rule). Chips are quiet (hairline outline, soft tint for emphasis). Buttons: primary = solid accent on light; secondary = hairline outline. Links use the accent with a subtle underline. Lots of whitespace; max content width ~720–860px retained.

### Apply per surface, behaviour untouched
Each page keeps its data flow and client/server split; only markup/styles change. The offer detail page's four blocks (header, preview, editor, tracking, email) get consistent card/spacing treatment. The `/offres` list keeps score + status chips but in the calm palette. Nav becomes a slim editorial header.

### Fonts via `next/font`
`next/font/google` for Fraunces + Inter in `app/layout.tsx`, exposing CSS variables (`--font-display`, `--font-body`) consumed by `globals.css`. *Why:* no FOUT, no external requests at runtime, standard Next approach.

## Risks / Trade-offs

- **Contrast/readability** on light theme → choose ink/muted values meeting WCAG AA; verify on real screens.
- **Scope creep** (endless polish) → bound to: tokens + base classes + the five surfaces; pixel-perfection beyond that is out.
- **Inline-style churn** → acceptable; we migrate page-by-page to classes/vars, verifying each still builds.

## Migration Plan

- Additive: new `globals.css`, `app/ui/tokens.ts`, font setup; pages refactored presentationally. No API/DB/logic change.
- Rollback = discard the change dir/branch (revert to inline dark styles).

## Open Questions

- Exact accent (deep blue `#1f4e79` vs a warmer editorial tone) and serif (Fraunces vs Newsreader/Spectral) — proposed defaults above; confirm during the screenshot pass.
- Keep the home page (`/`) or fold it into `/offres` as the entry — proposed: keep, lightly restyled.
