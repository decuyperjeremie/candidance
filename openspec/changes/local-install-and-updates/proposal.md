## Why

The app is built for a single non-technical user (Tatiana) who will run it **on her own Windows PC**, not on the developer's machine. Two things stand in the way of "just give it to her":

1. **Install** is currently a developer runbook (`RUNNING.md`): clone, `npm install`, `.env`, build, run. She will not do this by hand.
2. **The AI provider** defaults to `claude-code`, which spawns the `claude` CLI using the logged-in Claude account **on the local machine**. On her PC that means *her own* Claude account — which is fine, because she has **Claude Desktop** (with Claude Code) and her own Claude subscription. So the plan leans into this: she runs a single **install file inside her Claude Code** (Claude Desktop), and the same Claude account then powers generation. No API key, no separate billing.

She also needs to **stay up to date** as the developer keeps shipping, without touching a terminal: the app is backed by a **GitHub repo**, and an **"Update" button inside the app** pulls the latest version and rebuilds.

This change is scoped and planned now but **implemented last**, once the rest of the app is stable.

## What Changes

- Add a **one-shot install** distributed as a single file the user opens/runs **in her Claude Code (Claude Desktop)**. Claude Code executes a deterministic runbook: verify/install prerequisites (Node.js, git; confirm the `claude` CLI is present and logged in), clone the GitHub repo to a fixed folder, install deps, do a **production build** (so PDFs render), write a default `.env` (`LLM_PROVIDER=claude-code`, optional France Travail creds), and create a **desktop launcher** that starts the app and opens the browser.
- Add an **in-app update mechanism** backed by GitHub: a visible **"Mettre à jour"** control that checks whether the local checkout is behind `origin` and, on confirm, pulls, reinstalls if needed, rebuilds, and restarts — with clear success/failure feedback. The app also **shows its current version** (commit/date) and whether an update is available.
- Add a small **local-ops API** (update/version) and a **supervised launcher** so a rebuild can take effect without the user using a terminal.
- Keep everything **local and single-user**: no hosting, no auth, no telemetry; the update endpoint is bound to localhost only.

## Capabilities

### New Capabilities
- `local-distribution`: install the app on a non-technical user's Windows PC via a single Claude-Code-run file, run it from a desktop launcher, keep it current through a GitHub-backed in-app "Update" button, and surface the running version — all local and single-user, with generation powered by the user's own Claude account (`claude-code` provider).

## Impact

- **New**: an install runbook file run inside Claude Code (e.g. `setup/install.md` + any helper script it calls), a Windows launcher (`.bat`/shortcut, supervised so it survives a rebuild/restart), an update UI surface in the web app, and a local-ops API (`/api/version`, `/api/update`).
- **Modified**: `RUNNING.md` (point non-dev users to the one-shot install), `.env.example` (defaults for the friend's setup), app navigation/home (entry point for version + update).
- **Depends on**: `app` (Next.js UI + API routes), `application-generation` (the `claude-code` provider is the AI backend), and a published **GitHub repo** as the update source.
- **Constraints**: better-sqlite3 is a native module — the install must handle prebuilt binaries / Windows build fallback; PDF rendering requires a prod build (`build` + `start`), not `dev`.
- **Non-goals**: cross-platform installers beyond Windows, hosted/multi-user deployment, auto-update without consent, packaging as an Electron/MSI app (the launcher + browser is enough for now).
