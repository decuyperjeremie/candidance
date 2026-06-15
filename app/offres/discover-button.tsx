"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Lancer une recherche" — triggers a discovery pass via /api/discover, then
 * refreshes the server component so the new offers show. Read-only otherwise.
 */
export function DiscoverButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/discover", { cache: "no-store" });
      const data = await res.json();
      const s = data.summary;
      setMsg(
        `${s.totalStored} offres stockées · ${s.duplicatesMerged} doublons fusionnés` +
          ` · ${s.fetched} récupérées.`,
      );
      router.refresh();
    } catch (err) {
      setMsg(`Échec : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
      <button onClick={run} disabled={running} className="btn btn-primary">
        {running ? "Recherche en cours…" : "Lancer une recherche"}
      </button>
      {msg && <span className="muted small">{msg}</span>}
    </div>
  );
}
