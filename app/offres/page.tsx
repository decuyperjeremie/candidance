import Link from "next/link";
import { listOffers } from "@/lib/aggregation/store";
import { getStatuses, STATUS_LABELS } from "@/lib/tracking/store";
import { scoreColor, sourceLabel, STATUS_COLOR } from "@/app/ui/tokens";
import { DiscoverButton } from "./discover-button";

// Reads the SQLite DB at request time — never statically prerendered.
export const dynamic = "force-dynamic";

/** Format a posting date as "12/06/2026 · il y a 3 j", with a freshness colour. */
function freshness(postedAt?: string): { label: string; color: string } | null {
  if (!postedAt) return null;
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  const date = d.toLocaleDateString("fr-FR");
  const ago = days === 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} j`;
  const color = days < 7 ? "var(--good)" : days < 30 ? "var(--warn)" : "var(--muted)";
  return { label: `${date} · ${ago}`, color };
}

export default function OffresPage() {
  const offers = listOffers(200);
  const statuses = getStatuses(offers.map((o) => o.id));

  return (
    <main className="container">
      <p className="small" style={{ color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--sp-2)" }}>
        Communication · Île-de-France
      </p>
      <h1 style={{ marginBottom: "var(--sp-2)" }}>Offres</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {offers.length} offre{offers.length > 1 ? "s" : ""} en base, triées par
        pertinence. Cliquez un titre pour générer et éditer la candidature.
      </p>

      <div style={{ margin: "var(--sp-5) 0 var(--sp-6)" }}>
        <DiscoverButton />
      </div>

      {offers.length === 0 && (
        <p className="muted">
          Aucune offre en base. Cliquez sur « Lancer une recherche » (nécessite les
          identifiants France Travail dans <code>.env</code>).
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--sp-3)" }}>
        {offers.map((o) => {
          const url = o.sources.find((s) => s.url)?.url;
          const sourceNames = Array.from(new Set(o.sources.map((s) => s.source)));
          const where = [o.company, o.location].filter(Boolean).join(" · ");
          const fresh = freshness(o.postedAt);
          const status = statuses.get(o.id);
          return (
            <li key={o.id} className="card" style={{ padding: "var(--sp-4) var(--sp-5)" }}>
              <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "baseline" }}>
                <span
                  style={{ color: scoreColor(o.score), fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: "2.2rem", fontSize: "1.05rem" }}
                  title="Score de pertinence (0–100)"
                >
                  {o.score}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "baseline" }}>
                    <div style={{ fontSize: "1.08rem", fontWeight: 600, flex: 1, minWidth: 0 }}>
                      <Link href={`/offres/${o.id}`} style={{ color: "var(--ink)" }}>
                        {o.title}
                      </Link>
                    </div>
                    {sourceNames.length > 0 && (
                      <span style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                        {sourceNames.map((s) => (
                          <span key={s} className="chip chip-source" title="Provenance de l'offre">
                            {sourceLabel(s)}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {where && <div className="muted small" style={{ marginTop: 2 }}>{where}</div>}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginTop: "var(--sp-3)" }}>
                    {status && (
                      <span
                        className="chip"
                        style={{ color: STATUS_COLOR[status], borderColor: "color-mix(in srgb, currentColor 35%, var(--hairline))" }}
                        title="Statut de la candidature"
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    )}
                    {o.contractType && <span className="chip">{o.contractType}</span>}
                  </div>

                  {o.scoreRationale && (
                    <div className="muted small" style={{ marginTop: "var(--sp-3)" }}>{o.scoreRationale}</div>
                  )}
                  {(url || o.salary || fresh) && (
                    <div className="small" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "var(--sp-3)" }}>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--faint)" }}>
                          Voir l&apos;offre ↗
                        </a>
                      )}
                      {(o.salary || fresh) && (
                        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {o.salary && <span className="chip chip-pay">💶 {o.salary}</span>}
                          {fresh && (
                            <span style={{ color: fresh.color }} title="Date de publication">
                              🗓 {fresh.label}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
