#!/usr/bin/env node
// @ts-nocheck
/*
 * Supervised launcher for the local single-user install.
 *
 * Responsibilities (see openspec change `local-install-and-updates`, Decision 3):
 *   1. start the production server (`next start`, bound to localhost only),
 *   2. open the browser at http://localhost:3000 once it is ready,
 *   3. watch for the restart sentinel written by POST /api/update after a
 *      successful rebuild, and cleanly stop + restart the server on it.
 *
 * This is what makes in-app "Mettre à jour" work without a terminal: the API
 * rebuilds, drops the sentinel, and this supervisor swaps the running process.
 *
 * Plain Node ESM (no build step) so it runs straight from the clone. Spawns the
 * Next CLI via `node node_modules/next/.../next` to avoid Windows `.cmd`/shell
 * quoting issues and to keep a directly-killable child process.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 3000;
const URL = `http://localhost:${PORT}`;
const RESTART_SENTINEL = join(REPO_ROOT, "data", ".restart");
const NEXT_BIN = join(REPO_ROOT, "node_modules", "next", "dist", "bin", "next");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve when a TCP connection to the port succeeds (server is listening). */
function portOpen(timeoutMs = 1000) {
  return new Promise((res) => {
    const socket = createConnection({ host: HOST, port: PORT });
    const done = (ok) => {
      socket.destroy();
      res(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitForPort(open, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    if ((await portOpen()) === open) return true;
    await sleep(1000);
  }
  return false;
}

function openBrowser() {
  const platform = process.platform;
  try {
    if (platform === "win32") spawn("cmd", ["/c", "start", "", URL], { detached: true, stdio: "ignore" }).unref();
    else if (platform === "darwin") spawn("open", [URL], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [URL], { detached: true, stdio: "ignore" }).unref();
  } catch {
    console.log(`Ouvrez votre navigateur : ${URL}`);
  }
}

let server = null;

function startServer() {
  console.log(`[candidance] démarrage du serveur sur ${URL} …`);
  server = spawn(process.execPath, [NEXT_BIN, "start", "-H", HOST, "-p", String(PORT)], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
  server.on("exit", (code) => {
    // An unexpected crash (not our restart) — surface it and stop the supervisor.
    if (!restarting && code !== null) {
      console.error(`[candidance] le serveur s'est arrêté (code ${code}).`);
      process.exit(code ?? 1);
    }
  });
}

function stopServer() {
  if (!server) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"]);
  else {
    try {
      server.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

let restarting = false;

async function restartOnNewBuild() {
  restarting = true;
  console.log("[candidance] mise à jour détectée — redémarrage…");
  try {
    rmSync(RESTART_SENTINEL, { force: true });
  } catch {
    /* ignore */
  }
  stopServer();
  await waitForPort(false); // wait for the old server to release the port
  startServer();
  await waitForPort(true);
  restarting = false;
  console.log("[candidance] redémarré sur la nouvelle version.");
}

async function main() {
  // A stale sentinel from a previous run must not trigger an immediate restart.
  try {
    rmSync(RESTART_SENTINEL, { force: true });
  } catch {
    /* ignore */
  }

  startServer();
  if (await waitForPort(true)) openBrowser();
  else console.error("[candidance] le serveur n'a pas démarré à temps.");

  // Watch for the restart sentinel for the lifetime of the launcher.
  for (;;) {
    await sleep(1000);
    if (!restarting && existsSync(RESTART_SENTINEL)) await restartOnNewBuild();
  }
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    restarting = true; // suppress the crash handler during shutdown
    stopServer();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[candidance] erreur du launcher :", err);
  stopServer();
  process.exit(1);
});
