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
      <button
        onClick={run}
        disabled={running}
        style={{
          background: running ? "#2a2a33" : "#7fd4ff",
          color: running ? "#9a9aa3" : "#0b0b0f",
          border: "none",
          borderRadius: 8,
          padding: "0.6rem 1.1rem",
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: running ? "default" : "pointer",
        }}
      >
        {running ? "Recherche en cours…" : "Lancer une recherche"}
      </button>
      {msg && <span style={{ color: "#9a9aa3", fontSize: "0.9rem" }}>{msg}</span>}
    </div>
  );
}
