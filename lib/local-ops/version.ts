import {
  commitsBehind,
  currentCommit,
  fetchOrigin,
  resolveCommit,
  type CommitInfo,
} from "./git";
import { REPO_BRANCH } from "./repo";

export type VersionInfo = {
  /** The running build's commit, or null if the checkout isn't a git repo. */
  current: CommitInfo | null;
  /** origin/<branch> after a fetch, or null if the remote wasn't checked/reachable. */
  latest: { commit: string; shortCommit: string } | null;
  updateAvailable: boolean;
  /** Number of commits the local checkout is behind origin. */
  behind: number;
  /** Whether we actually reached the remote (false = offline / fetch failed). */
  checkedRemote: boolean;
  /** Human-readable reason when current/latest could not be determined. */
  error?: string;
};

/**
 * Report the running version and, optionally, whether origin is ahead.
 *
 * Never throws: a missing git repo or an offline fetch degrades to a partial
 * answer (current shown, update unknown) so the badge still renders.
 * Pass `checkRemote: false` for cheap local-only polling (no network).
 */
export async function getVersionInfo({
  checkRemote = true,
}: { checkRemote?: boolean } = {}): Promise<VersionInfo> {
  let current: CommitInfo | null = null;
  try {
    current = await currentCommit();
  } catch (err) {
    return {
      current: null,
      latest: null,
      updateAvailable: false,
      behind: 0,
      checkedRemote: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!checkRemote) {
    return { current, latest: null, updateAvailable: false, behind: 0, checkedRemote: false };
  }

  try {
    await fetchOrigin();
    const latestCommit = await resolveCommit(`origin/${REPO_BRANCH}`);
    const behind = await commitsBehind("HEAD", `origin/${REPO_BRANCH}`);
    return {
      current,
      latest: { commit: latestCommit, shortCommit: latestCommit.slice(0, 7) },
      updateAvailable: behind > 0,
      behind,
      checkedRemote: true,
    };
  } catch (err) {
    // Offline or no remote: still useful — show the current version.
    return {
      current,
      latest: null,
      updateAvailable: false,
      behind: 0,
      checkedRemote: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
