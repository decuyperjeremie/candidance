import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  currentCommit,
  dirtyTrackedFiles,
  fetchOrigin,
  GitError,
  lockfileChanged,
  resetHard,
  resolveCommit,
} from "./git";
import { DATA_DIR, LAST_GOOD_FILE, REPO_ROOT, RESTART_SENTINEL, UPDATE_STATUS_FILE } from "./paths";
import { REPO_BRANCH } from "./repo";

/** Ordered phases of an update. `done`/`error` are terminal; the rest are live. */
export type UpdatePhase =
  | "idle"
  | "starting"
  | "fetching"
  | "installing"
  | "building"
  | "restarting"
  | "done"
  | "error";

export type UpdateStatus = {
  phase: UpdatePhase;
  message: string;
  startedAt: string;
  finishedAt?: string;
  fromCommit?: string;
  toCommit?: string;
  /** Last lines of command output, surfaced verbatim on failure. */
  logTail?: string;
  error?: string;
};

const RUNNING_PHASES = new Set<UpdatePhase>([
  "starting",
  "fetching",
  "installing",
  "building",
  "restarting",
]);

const IDLE_STATUS: UpdateStatus = {
  phase: "idle",
  message: "Aucune mise à jour en cours.",
  startedAt: "",
};

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

/** Read the persisted update status (idle when none has run). */
export async function readUpdateStatus(): Promise<UpdateStatus> {
  try {
    const raw = await readFile(UPDATE_STATUS_FILE, "utf-8");
    return JSON.parse(raw) as UpdateStatus;
  } catch {
    return IDLE_STATUS;
  }
}

async function writeStatus(status: UpdateStatus): Promise<void> {
  await ensureDataDir();
  await writeFile(UPDATE_STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
}

/** Keep only the tail of long command output so status files stay small. */
function tail(text: string, max = 4000): string {
  return text.length <= max ? text : text.slice(-max);
}

/**
 * Run a shell command in the repo root, capturing combined output.
 * `shell: true` lets Windows resolve `npm` → `npm.cmd`. The build can take
 * minutes, so there is no timeout; failures reject with the captured output.
 */
function runCommand(command: string, label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: REPO_ROOT,
      shell: true,
      windowsHide: true,
      env: { ...process.env, CI: "1" },
    });
    let out = "";
    const onData = (d: Buffer) => {
      out += d.toString();
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => reject(new Error(`${label} could not start: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${label} failed (exit ${code}):\n${tail(out)}`));
    });
  });
}

/** True while an update is actively running (terminal states return false). */
export async function isUpdateRunning(): Promise<boolean> {
  const status = await readUpdateStatus();
  return RUNNING_PHASES.has(status.phase);
}

export type StartResult =
  | { started: true; status: UpdateStatus }
  | { started: false; reason: string; status: UpdateStatus };

/**
 * Begin an update if one isn't already running. Returns immediately; the work
 * proceeds in the background and progress is read via {@link readUpdateStatus}.
 */
export async function startUpdate(): Promise<StartResult> {
  if (await isUpdateRunning()) {
    return { started: false, reason: "Une mise à jour est déjà en cours.", status: await readUpdateStatus() };
  }
  const startedAt = new Date().toISOString();
  const initial: UpdateStatus = {
    phase: "starting",
    message: "Préparation de la mise à jour…",
    startedAt,
  };
  await writeStatus(initial);
  // Fire-and-forget: the route returns now; the UI polls for progress.
  void runUpdate(startedAt).catch(async (err) => {
    await writeStatus({
      phase: "error",
      message: "La mise à jour a échoué.",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
  });
  return { started: true, status: initial };
}

/**
 * The update sequence. On any failure after the reset, the working tree is
 * rolled back to the starting commit so the app stays runnable on the last
 * working version (the running server keeps serving its loaded build).
 */
async function runUpdate(startedAt: string): Promise<void> {
  const from = await currentCommit();
  const update = async (patch: Partial<UpdateStatus>) =>
    writeStatus({ phase: "starting", message: "", startedAt, fromCommit: from.commit, ...patch });

  // 1. Refuse if source was edited locally — a hard reset would discard it.
  const dirty = await dirtyTrackedFiles();
  if (dirty.length > 0) {
    await update({
      phase: "error",
      message: "Des fichiers source ont été modifiés localement — mise à jour annulée.",
      finishedAt: new Date().toISOString(),
      error: `Modifications non validées :\n${dirty.join("\n")}`,
    });
    return;
  }

  // 2. Fetch + resolve the target.
  await update({ phase: "fetching", message: "Téléchargement de la dernière version…" });
  await fetchOrigin();
  const target = await resolveCommit(`origin/${REPO_BRANCH}`);
  if (target === from.commit) {
    await update({
      phase: "done",
      message: "Déjà à jour.",
      toCommit: target,
      finishedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await resetHard(target);

    // 3. Reinstall deps only when the lockfile changed.
    if (await lockfileChanged(from.commit, target)) {
      await update({ phase: "installing", message: "Installation des dépendances…", toCommit: target });
      await runCommand("npm ci", "npm ci");
    }

    // 4. Production build (required for PDF rendering).
    await update({ phase: "building", message: "Construction de l'application…", toCommit: target });
    const buildLog = await runCommand("npm run build", "npm run build");

    // 5. Mark success and signal the launcher to restart onto the new build.
    await writeFile(LAST_GOOD_FILE, target, "utf-8");
    await update({
      phase: "restarting",
      message: "Redémarrage sur la nouvelle version…",
      toCommit: target,
      logTail: tail(buildLog, 1000),
    });
    await writeFile(
      RESTART_SENTINEL,
      JSON.stringify({ commit: target, at: new Date().toISOString() }),
      "utf-8",
    );
    // The supervisor will stop this process shortly; record the intended end.
    await update({
      phase: "done",
      message: "Mise à jour terminée. Redémarrage…",
      toCommit: target,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Roll source back so it matches the still-running build, then report.
    const message =
      err instanceof GitError || err instanceof Error ? err.message : String(err);
    try {
      await resetHard(from.commit);
      if (await lockfileChanged(target, from.commit)) {
        await runCommand("npm ci", "npm ci (rollback)");
      }
    } catch {
      // Rollback best-effort; the running server is unaffected regardless.
    }
    await update({
      phase: "error",
      message: "La mise à jour a échoué — l'application reste sur la version précédente.",
      toCommit: target,
      finishedAt: new Date().toISOString(),
      error: message,
    });
  }
}
