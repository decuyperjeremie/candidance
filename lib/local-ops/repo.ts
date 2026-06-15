/**
 * Source-of-truth for *where* the app comes from and *how* it runs locally.
 *
 * The clone URL is the published GitHub repo. It is overridable via env so the
 * same code works for a fork or a moved repo without editing source — but the
 * install runbook and the launcher rely on the default, so keep it accurate.
 */
export const REPO_URL =
  process.env.TATIANA_REPO_URL?.trim() ||
  "https://github.com/decuyperjeremie/candidance.git";

/** Branch the user tracks; updates fast-forward to `origin/<branch>`. */
export const REPO_BRANCH = process.env.TATIANA_REPO_BRANCH?.trim() || "main";

/** Port the production server binds to (localhost only — see launcher). */
export const APP_PORT = Number(process.env.PORT) || 3000;

/** The single fixed install folder name under %USERPROFILE% (documented in setup/install.md). */
export const INSTALL_DIR_NAME = "candidance";
