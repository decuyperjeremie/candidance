## Why

The app works end-to-end but its look is a default dark prototype skin: ad-hoc inline styles repeated across pages, no type system, neon cyan accent, no shared design language. For a non-technical user (Tatiana), the interface should feel calm, trustworthy, and considered. The user wants a **light editorial** direction (à la impeccable.style): off-white canvas, strong typographic hierarchy, hairline rules, generous whitespace, one restrained accent — applied **consistently** across every surface.

## What Changes

- Introduce a **design system**: a single source of truth for tokens (colour, type scale, spacing, radii, lines) as CSS custom properties in a global stylesheet, plus a small TS mirror for values needed in logic (e.g. score colours). No component library; server components stay.
- Adopt a **light editorial visual language**: off-white background, near-black ink text, a refined serif for headings + a clean sans for body (via `next/font`), hairline dividers, a single restrained accent, calm spacing.
- **Reskin every primary surface** consistently: global nav + layout, home (`/`), offer list (`/offres`), offer detail (`/offres/[id]` — header, CV/letter preview, editor, email handoff, tracking), and the tracking view (`/suivi`).
- Purely **presentational**: no change to behaviour (generate, edit/save, downloads, email `.eml`/`mailto`, status lifecycle) or to generated documents (PDF/DOCX keep their own template styling).

## Capabilities

### New Capabilities
- `design-system`: a shared, token-driven light-editorial visual language (typography, colour, spacing, lines, core UI patterns) consumed consistently by every web surface, with no component library and behaviour unchanged.

### Modified Capabilities
<!-- None at the behaviour level: review-ui, application-tracking, email-handoff keep their behaviour; only presentation changes. -->

## Impact

- **New**: `app/globals.css` (token custom properties + base element styles + a few reusable classes), `app/ui/tokens.ts` (TS mirror of key tokens), `next/font` setup in `app/layout.tsx`.
- **Modified (presentation only)**: `app/layout.tsx` (fonts, import CSS, nav), `app/page.tsx`, `app/offres/page.tsx` + `discover-button.tsx`, `app/offres/[id]/page.tsx` + `editor.tsx` + `tracking.tsx`, `app/suivi/page.tsx`.
- **Unchanged**: all API routes, `lib/**` logic, generation/rendering of CV/letter files, DB.
- **Verification**: build + a real screenshot pass of each surface for visual iteration.
