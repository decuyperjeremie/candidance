import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "./paths";
import { REPO_BRANCH } from "./repo";

const pExecFile = promisify(execFile);

/** A git invocation failed; carries the exact stderr for verbatim surfacing. */
export class GitError extends Error {
  constructor(
    message: string,
    readonly args: string[],
    readonly stderr: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * Run `git` in the repo root. Network commands (fetch) need a longer timeout;
 * everything else is local and fast. Throws GitError with stderr on failure.
 */
async function git(args: string[], timeoutMs = 30_000): Promise<string> {
  try {
    const { stdout } = await pExecFile("git", args, {
      cwd: REPO_ROOT,
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout.trim();
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new GitError(
      `git ${args.join(" ")} failed: ${e.stderr?.trim() || e.message || "unknown error"}`,
      args,
      (e.stderr ?? "").toString().trim(),
    );
  }
}

export type CommitInfo = {
  commit: string;
  shortCommit: string;
  committedAt: string; // ISO 8601
};

/** Read the running checkout's HEAD commit + date. Throws if not a git repo. */
export async function currentCommit(): Promise<CommitInfo> {
  const out = await git([
    "show",
    "-s",
    "--format=%H%n%h%n%cI",
    "HEAD",
  ]);
  const [commit, shortCommit, committedAt] = out.split("\n");
  return { commit, shortCommit, committedAt };
}

/** Fetch the tracked branch from origin (network). */
export async function fetchOrigin(): Promise<void> {
  await git(["fetch", "--quiet", "origin", REPO_BRANCH], 60_000);
}

/** Resolve a ref to a full commit hash (e.g. `origin/main`). */
export async function resolveCommit(ref: string): Promise<string> {
  return git(["rev-parse", ref]);
}

/** How many commits `to` is ahead of `from` (0 = nothing to pull). */
export async function commitsBehind(from: string, to: string): Promise<number> {
  const out = await git(["rev-list", "--count", `${from}..${to}`]);
  return Number.parseInt(out, 10) || 0;
}

/**
 * Tracked-file changes in the working tree. Empty when clean. `data/` and
 * `.env` are git-ignored so the user's DB/config never appear here — a
 * non-empty result means someone edited *source*, which blocks a hard reset.
 */
export async function dirtyTrackedFiles(): Promise<string[]> {
  const out = await git(["status", "--porcelain", "--untracked-files=no"]);
  return out ? out.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

/** True when package-lock.json differs between two commits (→ reinstall deps). */
export async function lockfileChanged(from: string, to: string): Promise<boolean> {
  const out = await git(["diff", "--name-only", from, to, "--", "package-lock.json"]);
  return out.length > 0;
}

/** Hard-reset the working tree to a ref. Used for both update and rollback. */
export async function resetHard(ref: string): Promise<void> {
  await git(["reset", "--hard", ref]);
}
