import { join } from "node:path";

/**
 * Filesystem locations for the local-distribution ops (version/update/restart).
 *
 * The app always runs with `cwd` = repo root (the launcher starts `next start`
 * from the clone folder), so `process.cwd()` is the checkout root. All runtime
 * ops artifacts live under `data/` which is git-ignored — they never end up in
 * a commit and they survive a hard-reset update along with the user's DB.
 */
export const REPO_ROOT = process.cwd();
export const DATA_DIR = join(REPO_ROOT, "data");

/** Written by `/api/update` after a successful build; watched by the launcher. */
export const RESTART_SENTINEL = join(DATA_DIR, ".restart");
/** Current/last update progress, polled by the in-app update UI. */
export const UPDATE_STATUS_FILE = join(DATA_DIR, "update-status.json");
/** Records the last commit that built successfully, for rollback/diagnostics. */
export const LAST_GOOD_FILE = join(DATA_DIR, ".last-good");
