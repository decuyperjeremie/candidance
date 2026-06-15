"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_COLOR } from "@/app/ui/tokens";

export type StatusOption = { value: string; label: string };
export type HistoryEvent = { id: number; type: string; note?: string; createdAt: string };

function eventLabel(e: HistoryEvent): string {
  if (e.type === "status") return `Statut → ${e.note ?? ""}`;
  if (e.type === "relance") return "Relance";
  return "Note";
}

/**
 * Status + history controls for an application. Sets the lifecycle status, logs
 * a relance (which also moves the status to "relancée"), adds a free-text note,
 * and shows the event history. Each action calls its API route then
 * router.refresh(). Behaviour unchanged by the redesign.
 */
export function TrackingControls({
  offerId,
  status,
  statuses,
  events,
}: {
  offerId: number;
  status: string;
  statuses: StatusOption[];
  events: HistoryEvent[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? `Échec (HTTP ${res.status}).` });
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: `Échec : ${err instanceof Error ? err.message : String(err)}` });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(value: string) {
    if (value === status) return;
    if (await post(`/api/applications/${offerId}/status`, { status: value })) {
      setMsg({ ok: true, text: `Statut mis à jour : ${value}.` });
    }
  }

  async function logRelance() {
    const ok = await post(`/api/applications/${offerId}/events`, { type: "relance" });
    if (ok) {
      await post(`/api/applications/${offerId}/status`, { status: "relancée" });
      setMsg({ ok: true, text: "Relance enregistrée." });
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    if (await post(`/api/applications/${offerId}/events`, { type: "note", note })) {
      setNote("");
      setMsg({ ok: true, text: "Note ajoutée." });
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">Suivi</h2>

      <div className="label">Statut</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {statuses.map((s) => {
          const active = s.value === status;
          const color = STATUS_COLOR[s.value as keyof typeof STATUS_COLOR] ?? "var(--accent)";
          return (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              disabled={busy}
              style={{
                background: active ? color : "transparent",
                color: active ? "#fff" : color,
                border: `1px solid ${active ? color : "var(--hairline-strong)"}`,
                borderRadius: "var(--pill)",
                padding: "0.3rem 0.8rem",
                fontSize: "0.85rem",
                fontWeight: active ? 600 : 500,
                fontFamily: "inherit",
                cursor: busy ? "default" : "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginTop: "var(--sp-4)" }}>
        <button onClick={logRelance} disabled={busy} className="btn" style={{ color: "var(--warn)" }}>
          Noter une relance
        </button>
        {msg && <span className="small" style={{ color: msg.ok ? "var(--good)" : "#b3261e" }}>{msg.text}</span>}
      </div>

      <div style={{ marginTop: "var(--sp-4)", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 240 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ajouter une note (ex : contact RH, date d'entretien…)"
        />
        <button onClick={addNote} disabled={busy || !note.trim()} className="btn btn-primary">
          Ajouter
        </button>
      </div>

      {events.length > 0 && (
        <div style={{ marginTop: "var(--sp-5)" }}>
          <div className="label">Historique</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
            {events.map((e) => (
              <li key={e.id} className="small" style={{ display: "flex", gap: "0.6rem" }}>
                <span className="muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {new Date(e.createdAt + "Z").toLocaleString("fr-FR")}
                </span>
                <span>
                  <strong style={{ fontWeight: 600 }}>{eventLabel(e)}</strong>
                  {e.type === "note" && e.note ? ` — ${e.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
