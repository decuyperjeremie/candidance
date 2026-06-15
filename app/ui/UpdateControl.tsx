"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VersionInfo = {
  current: { commit: string; shortCommit: string; committedAt: string } | null;
  latest: { commit: string; shortCommit: string } | null;
  updateAvailable: boolean;
  behind: number;
  checkedRemote: boolean;
  error?: string;
};

type UpdateStatus = {
  phase: "idle" | "starting" | "fetching" | "installing" | "building" | "restarting" | "done" | "error";
  message: string;
  fromCommit?: string;
  toCommit?: string;
  error?: string;
};

const RUNNING = new Set(["starting", "fetching", "installing", "building", "restarting"]);
const POLL_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Version badge + "Mettre à jour" control for the local single-user install.
 *
 * Reads /api/version on mount; when origin is ahead it offers the update.
 * Running an update POSTs /api/update then polls progress; once the server is
 * rebuilt and the supervised launcher restarts it, this polls /api/version
 * until the commit changes and reloads onto the new build.
 */
export default function UpdateControl() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const startCommit = useRef<string | null>(null);

  const loadVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (res.ok) setInfo((await res.json()) as VersionInfo);
    } catch {
      /* offline — keep last known */
    }
  }, []);

  useEffect(() => {
    void loadVersion();
  }, [loadVersion]);

  /** Poll /api/version (local-only) until HEAD differs, then reload. */
  const waitForRestart = useCallback(async () => {
    for (let i = 0; i < 240; i++) {
      await sleep(POLL_MS);
      try {
        const res = await fetch("/api/version?remote=0", { cache: "no-store" });
        if (res.ok) {
          const v = (await res.json()) as VersionInfo;
          const head = v.current?.commit;
          if (head && head !== startCommit.current) {
            window.location.reload();
            return;
          }
        }
      } catch {
        /* server is bouncing — keep waiting */
      }
    }
    // Gave up waiting; let the user reload manually.
    setStatus({ phase: "restarting", message: "Redémarrage… rechargez la page si rien ne se passe." });
  }, []);

  const runUpdate = useCallback(async () => {
    setBusy(true);
    startCommit.current = info?.current?.commit ?? null;
    setStatus({ phase: "starting", message: "Préparation de la mise à jour…" });
    try {
      await fetch("/api/update", { method: "POST" });
    } catch {
      /* request may not return cleanly if the server restarts — keep polling */
    }

    for (let i = 0; i < 600; i++) {
      try {
        const res = await fetch("/api/update", { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as UpdateStatus;
          setStatus(s);
          if (s.phase === "error") {
            setBusy(false);
            return;
          }
          if (s.phase === "restarting" || s.phase === "done") {
            await waitForRestart();
            return;
          }
        }
      } catch {
        // Server unreachable mid-update → it is restarting; wait for it back.
        await waitForRestart();
        return;
      }
      await sleep(POLL_MS);
    }
    setBusy(false);
  }, [info, waitForRestart]);

  if (!info?.current) return null;

  const running = status && RUNNING.has(status.phase);
  const short = info.current.shortCommit;

  return (
    <span className="update-control">
      {running ? (
        <span className="update-state" aria-live="polite">
          <span className="update-spinner" aria-hidden />
          {status?.message ?? "Mise à jour en cours…"}
        </span>
      ) : status?.phase === "error" ? (
        <span className="update-error" role="alert">
          <span title={status.error}>Échec de la mise à jour.</span>
          <button className="btn btn-sm" onClick={runUpdate} disabled={busy}>
            Réessayer
          </button>
        </span>
      ) : info.updateAvailable ? (
        <button className="btn btn-sm btn-primary" onClick={runUpdate} disabled={busy}>
          Mettre à jour
        </button>
      ) : (
        <span className="update-uptodate" title={`v${short} · à jour`}>
          v{short} · à jour
        </span>
      )}
    </span>
  );
}
