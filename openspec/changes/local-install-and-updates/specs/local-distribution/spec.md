## ADDED Requirements

### Requirement: One-shot install via Claude Code

The system SHALL be installable on a non-technical user's Windows PC by opening and running a **single file inside Claude Code (Claude Desktop)**, without the user using a terminal directly. The runbook SHALL be idempotent (safe to re-run) and SHALL leave the app in a runnable, production-built state.

#### Scenario: Fresh install on a clean machine

- **WHEN** the user runs the install file in her Claude Code on a machine without the app
- **THEN** Claude Code verifies/installs prerequisites (Node.js, git), confirms the `claude` CLI is logged in, clones the repository to a fixed folder, installs dependencies, writes a default `.env`, runs a production build, and creates a desktop launcher

#### Scenario: Re-running the install

- **WHEN** the install file is run again on a machine that already has the app
- **THEN** it converges to an up-to-date, runnable state without duplicating or corrupting the existing install or the user's data

#### Scenario: Native dependency fallback

- **WHEN** the native dependency (better-sqlite3) cannot use a prebuilt binary during install
- **THEN** the runbook surfaces the exact error and a documented build-tools fallback rather than leaving a half-installed, unrunnable app

### Requirement: User's own Claude account powers generation

The installed app SHALL use the `claude-code` provider so that CV/letter generation runs against the user's **own locally logged-in Claude account**, requiring no API key and no billing separate from her Claude subscription.

#### Scenario: Generation uses the local Claude login

- **WHEN** the user generates an application after installing
- **THEN** generation runs via the `claude` CLI under her logged-in Claude account, with no API key configured

### Requirement: Desktop launcher

The system SHALL provide a desktop launcher that starts the production app and opens it in the browser, so the user runs the app without a terminal. The launcher SHALL be supervised so that an in-app update can rebuild and restart the server without user terminal interaction.

#### Scenario: Launch from the desktop

- **WHEN** the user activates the desktop launcher
- **THEN** the production server starts and the app opens at `http://localhost:3000`

#### Scenario: Restart after an update

- **WHEN** an in-app update completes a successful rebuild
- **THEN** the supervised launcher stops and restarts the server on the new build, and the app becomes available on the new version without terminal use

### Requirement: GitHub-backed in-app updates

The system SHALL let the user update to the latest published version from **within the app**, backed by the GitHub repository, without using a terminal. The update SHALL preserve the user's local data and configuration.

#### Scenario: Update available is shown

- **WHEN** the local checkout is behind the repository's published version
- **THEN** the app indicates an update is available alongside the current running version

#### Scenario: Applying an update

- **WHEN** the user confirms the in-app "Mettre à jour" action
- **THEN** the system fetches and resets to the latest published version, reinstalls dependencies if they changed, rebuilds, and restarts on the new version

#### Scenario: User data survives an update

- **WHEN** an update is applied
- **THEN** the user's database, generated applications, and `.env` configuration (git-ignored) remain intact

#### Scenario: Failed update does not break the app

- **WHEN** an update step fails (fetch, install, or build)
- **THEN** the app reports the failure clearly and remains runnable on the last working version

### Requirement: Local, single-user, no external exposure

The distribution SHALL remain local and single-user: the update/version endpoints SHALL be reachable only from localhost, and the system SHALL NOT add authentication, hosting, multi-user support, or telemetry.

#### Scenario: Ops endpoints are localhost-only

- **WHEN** the version or update endpoints are requested from a non-localhost origin
- **THEN** the request is refused
