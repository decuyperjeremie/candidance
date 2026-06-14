import Link from "next/link";
import { listOffers } from "@/lib/aggregation/store";
import { DiscoverButton } from "./discover-button";

// Reads the SQLite DB at request time — never statically prerendered.
export const dynamic = "force-dynamic";

const ACCENT = "#7fd4ff";
const MUTED = "#9a9aa3";
const CARD_BG = "#14141b";
const BORDER = "#23232d";

/** Colour the score chip green/amber/grey by relevance band. */
function scoreColor(score: number): string {
  if (score >= 70) return "#3ddc84";
  if (score >= 40) return "#ffcc66";
  return MUTED;
}

/** Format a posting date as "12/06/2026 · il y a 3 j", with a freshness colour. */
function freshness(postedAt?: string): { label: string; color: string } | null {
  if (!postedAt) return null;
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  const date = d.toLocaleDateString("fr-FR");
  const ago = days === 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} j`;
  // green < 7j, amber < 30j, grey beyond.
  const color = days < 7 ? "#3ddc84" : days < 30 ? "#ffcc66" : MUTED;
  return { label: `${date} · ${ago}`, color };
}

export default function OffresPage() {
  const offers = listOffers(200);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.25rem" }}>
        Offres — Communication · Île-de-France
      </h1>
      <p style={{ color: MUTED, marginTop: 0 }}>
        {offers.length} offre{offers.length > 1 ? "s" : ""} en base, triées par
        pertinence. Cliquez un titre pour générer et éditer la candidature.
      </p>

      <div style={{ margin: "1.5rem 0 2rem" }}>
        <DiscoverButton />
      </div>

      {offers.length === 0 && (
        <p style={{ color: MUTED }}>
          Aucune offre en base. Clique sur « Lancer une recherche » (nécessite
          les identifiants France Travail dans <code>.env</code>).
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.9rem" }}>
        {offers.map((o, i) => {
          const url = o.sources.find((s) => s.url)?.url;
          const where = [o.company, o.location].filter(Boolean).join(" · ");
          return (
            <li
              key={o.id}
              style={{
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: "1rem 1.1rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.9rem", alignItems: "baseline" }}>
                <span
                  style={{
                    color: scoreColor(o.score),
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: "2.4rem",
                  }}
                  title="Score de pertinence (0–100)"
                >
                  {o.score}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>
                    <Link href={`/offres/${o.id}`} style={{ color: "#e7e7ea", textDecoration: "none" }}>
                      {o.title}
                    </Link>
                  </div>
                  {where && <div style={{ color: MUTED, fontSize: "0.92rem", marginTop: 2 }}>{where}</div>}
                  {(() => {
                    const fresh = freshness(o.postedAt);
                    const chip = {
                      display: "inline-block",
                      fontSize: "0.78rem",
                      color: MUTED,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      padding: "1px 7px",
                    } as const;
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginTop: 6 }}>
                        {o.contractType && <span style={chip}>{o.contractType}</span>}
                        {o.salary && <span style={{ ...chip, color: "#cfe8d4", borderColor: "#2e4a36" }}>💶 {o.salary}</span>}
                        {fresh && (
                          <span style={{ fontSize: "0.78rem", color: fresh.color }} title="Date de publication">
                            🗓 {fresh.label}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {o.description && (
                    <div style={{ color: MUTED, fontSize: "1.2rem", marginTop: 8 }}>
                      {o.description}
                    </div>
                  )}
                  {o.scoreRationale && (
                    <div style={{ color: MUTED, fontSize: "0.82rem", marginTop: 8 }}>
                      {o.scoreRationale}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: "0.78rem", color: MUTED }}>
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>
                        Voir l&apos;offre ↗
                      </a>
                    )}
                    <span style={{ marginLeft: url ? "0.8rem" : 0 }}>
                      sources : {o.sources.map((s) => s.source).join(", ")}
                    </span>
                  </div>
                </div>
                <span style={{ color: MUTED, fontSize: "0.8rem" }}>#{i + 1}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
