import Link from "next/link";
import { listTrackedApplications, STATUS_LABELS } from "@/lib/tracking/store";
import { STATUS_COLOR } from "@/app/ui/tokens";

// Reads the SQLite DB at request time — never statically prerendered.
export const dynamic = "force-dynamic";

export default function SuiviPage() {
  const apps = listTrackedApplications();

  return (
    <main className="container">
      <Link href="/offres" className="small">← Retour aux offres</Link>
      <h1 style={{ margin: "var(--sp-5) 0 var(--sp-2)" }}>Suivi des candidatures</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {apps.length} candidature{apps.length > 1 ? "s" : ""} générée{apps.length > 1 ? "s" : ""}.
      </p>

      {apps.length === 0 ? (
        <p className="muted">Aucune candidature pour l&apos;instant. Ouvrez une offre et générez une candidature.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "var(--sp-5) 0 0", display: "grid", gap: "var(--sp-3)" }}>
          {apps.map((a) => (
            <li key={a.offerId} className="card" style={{ padding: "var(--sp-4) var(--sp-5)", display: "flex", gap: "var(--sp-4)", alignItems: "center" }}>
              <span
                className="chip"
                style={{ color: STATUS_COLOR[a.status], borderColor: "color-mix(in srgb, currentColor 40%, var(--hairline))" }}
              >
                {STATUS_LABELS[a.status]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/offres/${a.offerId}`} style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {a.offerTitle}
                </Link>
                {a.company && <div className="muted small">{a.company}</div>}
              </div>
              <span className="small faint" style={{ whiteSpace: "nowrap" }}>
                maj {new Date(a.lastUpdate + "Z").toLocaleDateString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
