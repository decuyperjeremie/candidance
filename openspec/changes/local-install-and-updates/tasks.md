> Implement **last**, after the rest of the app is stable and the repo is pushed to GitHub.

## 1. Prerequisites (must be true before starting)

- [ ] 1.1 App surfaces (home, /offres, /offres/[id], /suivi) and the `claude-code` generation path are stable.
- [ ] 1.2 Repo is published to GitHub (public, or private the user can read); the exact clone URL is fixed and recorded.
- [ ] 1.3 Confirm `data/` and `.env` are git-ignored (user data must survive a hard-reset update). Add ignores if missing.

## 2. Install runbook (run in Claude Code on Claude Desktop)

- [ ] 2.1 `setup/install.md`: deterministic, idempotent runbook Claude Code executes — prereqs (Node LTS + git via winget; verify `claude` CLI logged in), clone to `%USERPROFILE%\tatiana` (or update if present), `npm ci`, copy `.env` (`LLM_PROVIDER=claude-code`, optional France Travail prompt), `npm run build`, create launcher shortcut, offer to launch.
- [ ] 2.2 Helper script(s) the runbook calls for the mechanical steps (so behaviour is reproducible, not prose-dependent), incl. a clearly-flagged **better-sqlite3 build fallback** (prebuilt first, MSVC build-tools instructions otherwise).
- [ ] 2.3 Record the exact repo URL and a one-line "how to run this file in Claude Code" instruction at the top of the runbook.

## 3. Supervised launcher

- [ ] 3.1 Launcher (`.bat`/`.ps1` or tiny Node wrapper): start `npm start`, open `http://localhost:3000`, watch for the restart sentinel and cleanly stop/restart the server on it.
- [ ] 3.2 Desktop shortcut creation (done by the install runbook) pointing at the launcher.

## 4. In-app update + version

- [ ] 4.1 `GET /api/version`: current commit/date + `git fetch` comparison to `origin` → `{current, latest, updateAvailable}`. Localhost-only.
- [ ] 4.2 `POST /api/update`: `git fetch` + `reset --hard origin/main`, conditional `npm ci`, `npm run build` into a marker/last-good scheme, then set the restart sentinel. Localhost-only; refuse on unexpected dirty tree; return errors verbatim.
- [ ] 4.3 UI: version badge + **"Mettre à jour"** button (home or settings strip) with "à jour" / "mise à jour disponible" / "mise à jour en cours…" states and auto-reload when the server returns on the new build.

## 5. Docs

- [ ] 5.1 `RUNNING.md`: add a non-developer "Installer sur le PC de Tatiana" section pointing to `setup/install.md` (the rest stays as the developer runbook).
- [ ] 5.2 `.env.example`: ensure friend-friendly defaults (`LLM_PROVIDER=claude-code`, France Travail commented as optional).

## 6. Verify (manual, on a clean Windows machine or VM)

- [ ] 6.1 Fresh install via the Claude Code runbook on a clean Windows box → app launches from the desktop shortcut → generate one full application (CV + lettre, PDF + DOCX) using her own Claude account.
- [ ] 6.2 Push a trivial commit → version badge shows "mise à jour disponible" → click Update → app rebuilds, restarts, runs the new version.
- [ ] 6.3 Confirm her data survives the update: existing offers, generated applications in `data/`, and `.env` are intact after the hard-reset update.
