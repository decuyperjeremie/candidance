"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { scoreColor, sourceLabel } from "@/app/ui/tokens";
import type { SalaryInfo } from "@/lib/aggregation/salary";
import { SalaryChips } from "./salary-chips";

/** Serializable view-model for one offer row, built server-side in page.tsx. */
export type OfferRow = {
  id: number;
  title: string;
  company?: string;
  location?: string;
  contractType?: string;
  salary?: string;
  postedAt?: string;
  score: number;
  scoreRationale?: string;
  sources: { source: string; url?: string }[];
  statusLabel: string | null;
  statusColor: string | null;
  /** Structured pay breakdown; salaryInfo.annual drives salary sorting. */
  salaryInfo: SalaryInfo | null;
};

type SortKey = "score" | "date" | "salary";
type Dir = "asc" | "desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "date", label: "Date" },
  { key: "salary", label: "Rémunération" },
];

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

/** Comparable value for an offer under a given sort key (null → ranked last). */
function valueFor(o: OfferRow, key: SortKey): number | null {
  if (key === "score") return o.score;
  if (key === "salary") return o.salaryInfo?.annual ?? null;
  const t = o.postedAt ? Date.parse(o.postedAt) : NaN;
  return Number.isNaN(t) ? null : t;
}

/** Numeric compare that always pushes missing values to the bottom. */
function compare(a: number | null, b: number | null, dir: Dir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

export function OffersList({ offers }: { offers: OfferRow[] }) {
  const [key, setKey] = useState<SortKey>("score");
  const [dir, setDir] = useState<Dir>("desc");

  const sorted = useMemo(() => {
    return [...offers].sort((a, b) => {
      const primary = compare(valueFor(a, key), valueFor(b, key), dir);
      // Stable, sensible tie-break: highest score first.
      return primary !== 0 ? primary : b.score - a.score;
    });
  }, [offers, key, dir]);

  function pick(next: SortKey) {
    if (next === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(next);
      setDir("desc"); // best-first by default for every key
    }
  }

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap", marginBottom: "var(--sp-4)" }}
      >
        <span className="small" style={{ color: "var(--muted)" }}>Trier par</span>
        {SORTS.map((s) => {
          const active = s.key === key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pick(s.key)}
              className="btn btn-sm"
              aria-pressed={active}
              style={{
                borderColor: active ? "var(--accent)" : undefined,
                color: active ? "var(--accent)" : undefined,
                background: active ? "var(--accent-soft)" : undefined,
                fontWeight: active ? 600 : undefined,
              }}
            >
              {s.label}
              {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          );
        })}
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--sp-3)" }}>
        {sorted.map((o) => {
          const url = o.sources.find((s) => s.url)?.url;
          const sourceNames = Array.from(new Set(o.sources.map((s) => s.source)));
          const where = [o.company, o.location].filter(Boolean).join(" · ");
          const fresh = freshness(o.postedAt);
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
                    {o.statusLabel && o.statusColor && (
                      <span
                        className="chip"
                        style={{ color: o.statusColor, borderColor: "color-mix(in srgb, currentColor 35%, var(--hairline))" }}
                        title="Statut de la candidature"
                      >
                        {o.statusLabel}
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
                        <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: "0.4rem" }}>
                          <SalaryChips info={o.salaryInfo} raw={o.salary} />
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
    </>
  );
}
