## Context

Target: one non-technical user on **Windows**, running the app locally. She has **Claude Desktop** (Claude Code) and a Claude subscription. The developer ships from a **GitHub repo**. Goals: trivial first install, trivial updates, no terminal, no API keys, no hosting. Implemented **last**, after the rest of the app stabilises.

Two hard technical facts shape the design:
- **`claude-code` provider** runs `claude` headless against the *locally logged-in* account → on her PC it transparently uses *her* Claude. This is why "her own Claude Max" is effectively free of extra setup once Claude Desktop is installed and logged in.
- **PDF rendering only works in a production build** (`npm run build && npm start`), per `RUNNING.md`. So the install and every update must (re)build, and the app must run via `start`, not `dev`.

## Decision 1 — Install via a single file run *in Claude Code*

She opens **one file in her Claude Code (Claude Desktop)** and tells it to run it. The file is a **deterministic runbook** (markdown instructions Claude Code executes, calling a helper script where a script is more reliable than prose). This leans on a tool she already has rather than shipping a separate installer.

Runbook steps (idempotent — safe to re-run):
1. **Prereqs**: detect Node.js LTS; if missing install via `winget install OpenJS.NodeJS.LTS`. Detect `git`; install via winget if missing. Confirm the `claude` CLI is callable and logged in (she runs from Claude Code, so the account exists) — if not, instruct `/login`.
2. **Fetch**: `git clone <repo>` into a fixed path (`%USERPROFILE%\tatiana`); if it already exists, skip to update.
3. **Install deps**: `npm ci`. Handle **better-sqlite3**: it ships prebuilt binaries for common Node/Windows combos; if the build falls back to source, ensure MSVC build tools (document the winget package) — keep this in a clearly-flagged fallback branch, not the happy path.
4. **Configure**: copy `.env.example` → `.env` with `LLM_PROVIDER=claude-code`; optionally prompt for `FRANCE_TRAVAIL_CLIENT_ID/SECRET` (skippable — discovery degrades gracefully to 0 offers).
5. **Build**: `npm run build`.
6. **Launcher**: create a desktop shortcut to a supervised launcher (Decision 3) and offer to launch immediately.

Why a Claude-Code runbook over a `.bat`/`.ps1` double-click: it self-heals (Claude reads errors and adapts), needs no code-signing/SmartScreen dance, and the user already trusts and has the tool. The runbook still *calls* scripts for the mechanical bits so behaviour is reproducible.

## Decision 2 — In-app update, GitHub-backed

A visible **"Mettre à jour"** control (home or a small settings strip) plus a **version badge**.

- `GET /api/version`: returns the running commit + date (read at build time or via `git rev-parse`) and, after a `git fetch`, whether `origin/main` is ahead → `{current, latest, updateAvailable}`.
- `POST /api/update`: runs the update sequence and streams/returns status:
  1. `git fetch && git reset --hard origin/main` (local checkout is read-only to the user → hard reset is safe and avoids merge conflicts). **`data/` and `.env` are git-ignored**, so her DB, applications, and config survive.
  2. `npm ci` only if `package-lock.json` changed.
  3. `npm run build`.
  4. trigger **restart** (Decision 3).
- **Safety**: both routes bound to `127.0.0.1`, no auth needed (single-user localhost); refuse to run if working tree is dirty in a way that isn't ours; surface errors verbatim in the UI; never leave the app un-runnable (build into a temp/marker, swap on success, keep last-good).

Open question for implementation: whether to also let her trigger updates by re-running the install runbook in Claude Code (it converges to the same state). The in-app button is the primary path; the runbook is the fallback if the app won't start.

## Decision 3 — Supervised launcher so rebuild/restart needs no terminal

`next start` holds the port; an update must rebuild and restart it. A plain `.bat` that runs `npm start` can't restart itself.

Approach: the launcher is a **small supervisor** (a `.bat`/`.ps1`, or a tiny Node wrapper) that:
- starts `npm start`, opens `http://localhost:3000`,
- watches for a **restart sentinel** (e.g. a file `data/.restart` or process exit code) that `/api/update` sets after a successful build,
- on sentinel: stop the server, start it again on the new build.

This keeps "update" fully in-app: button → build → supervisor swaps the process → page reloads on the new version. Alternative considered (reject for v1): packaging as Electron with electron-updater — more robust auto-update but far more build/signing overhead than a single local user needs.

## Risks / trade-offs

- **Native module (better-sqlite3)** build on a clean Windows box is the highest-risk install step → mitigate with prebuilt binaries first, documented build-tools fallback, and the runbook surfacing the exact error to Claude Code to self-heal.
- **Hard-reset updates** discard any local edits to tracked files — acceptable because the user never edits source; her data lives in git-ignored `data/`/`.env`. Must verify the ignore rules before shipping.
- **Restart UX**: brief downtime during rebuild; show a "mise à jour en cours…" state and auto-reload when back.
- **Trust**: she runs code from GitHub via Claude Code — fine for a personal tool from a known author; document the repo URL explicitly in the runbook so there's no ambiguity about what's being run.

## Sequencing

Planned now, **built last**. Prereqs: app surfaces stable, `claude-code` provider working, repo pushed to GitHub (public or shared private she can read). Verification is necessarily **manual on a real/clean Windows machine** (or VM): fresh install → launch → generate one application → push a trivial commit → click Update → confirm new version runs and her data survived.
