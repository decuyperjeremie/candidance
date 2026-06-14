import Link from "next/link";
import { getOffer } from "@/lib/aggregation/store";
import { getApplication } from "@/lib/generation/store";
import { APPLICATION_FILES } from "@/lib/render";
import type { ApplicationContent } from "@/lib/generation/content";
import { ApplicationEditor, GenerateButton } from "./editor";

// Reads the SQLite DB at request time — never statically prerendered.
export const dynamic = "force-dynamic";

const ACCENT = "#7fd4ff";
const MUTED = "#9a9aa3";
const CARD_BG = "#14141b";
const BORDER = "#23232d";

function scoreColor(score: number): string {
  if (score >= 70) return "#3ddc84";
  if (score >= 40) return "#ffcc66";
  return MUTED;
}

const chip = {
  display: "inline-block",
  fontSize: "0.8rem",
  color: MUTED,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: "1px 8px",
} as const;

const backLink = { color: ACCENT, textDecoration: "none", fontSize: "0.9rem" } as const;

/** Read-only rendering of the generated CV + letter, mirroring what downloads carry. */
function ApplicationView({ content }: { content: ApplicationContent }) {
  const { cv, letter } = content;
  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "1.25rem 1.4rem",
        marginTop: "1.5rem",
      }}
    >
      <h2 style={{ fontSize: "1.15rem", marginTop: 0 }}>Aperçu</h2>

      {cv.headline && <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{cv.headline}</div>}
      {cv.summary && (
        <p style={{ color: "#cfcfd6", lineHeight: 1.55, marginTop: 8 }}>{cv.summary}</p>
      )}

      {cv.experiences.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.95rem", color: ACCENT, margin: "1rem 0 0.5rem" }}>Expériences</h3>
          {cv.experiences.map((e, i) => (
            <div key={i} style={{ marginBottom: "0.8rem" }}>
              <div style={{ fontWeight: 600 }}>
                {e.title}
                {e.organisation ? ` — ${e.organisation}` : ""}
              </div>
              <div style={{ color: MUTED, fontSize: "0.85rem" }}>
                {[e.period, e.location].filter(Boolean).join(" · ")}
              </div>
              {e.highlights.length > 0 && (
                <ul style={{ margin: "4px 0 0", paddingLeft: "1.2rem", color: "#cfcfd6", lineHeight: 1.5 }}>
                  {e.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {cv.formations.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.95rem", color: ACCENT, margin: "1rem 0 0.5rem" }}>Formations</h3>
          {cv.formations.map((f, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{f.degree}</span>
              {f.institution ? ` — ${f.institution}` : ""}
              {f.period ? <span style={{ color: MUTED }}> ({f.period})</span> : null}
            </div>
          ))}
        </>
      )}

      {cv.skills.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.95rem", color: ACCENT, margin: "1rem 0 0.5rem" }}>Compétences</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {cv.skills.map((s, i) => (
              <span key={i} style={chip}>{s}</span>
            ))}
          </div>
        </>
      )}

      {cv.languages.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.95rem", color: ACCENT, margin: "1rem 0 0.5rem" }}>Langues</h3>
          <div style={{ color: "#cfcfd6" }}>
            {cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(" · ")}
          </div>
        </>
      )}

      <h3 style={{ fontSize: "0.95rem", color: ACCENT, margin: "1.2rem 0 0.5rem" }}>Lettre de motivation</h3>
      {letter.recipientContext && (
        <div style={{ color: MUTED, fontSize: "0.85rem", marginBottom: 6 }}>{letter.recipientContext}</div>
      )}
      {letter.paragraphs.map((p, i) => (
        <p key={i} style={{ color: "#cfcfd6", lineHeight: 1.6, margin: "0 0 0.7rem" }}>{p}</p>
      ))}
    </section>
  );
}

export default async function OffreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offerId = Number(id);
  const offer = Number.isNaN(offerId) ? undefined : getOffer(offerId);

  if (!offer) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <Link href="/offres" style={backLink}>← Retour aux offres</Link>
        <h1 style={{ fontSize: "1.6rem", marginTop: "1.5rem" }}>Offre introuvable</h1>
        <p style={{ color: MUTED }}>
          Aucune offre ne correspond à l&apos;identifiant #{id}. Elle a peut-être été
          retirée de la base.
        </p>
      </main>
    );
  }

  const app = getApplication(offerId);
  const url = offer.sources.find((s) => s.url)?.url;
  const where = [offer.company, offer.location].filter(Boolean).join(" · ");
  const postedAt = offer.postedAt ? new Date(offer.postedAt) : null;
  const postedLabel =
    postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt.toLocaleDateString("fr-FR") : null;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <Link href="/offres" style={backLink}>← Retour aux offres</Link>

      <header style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.9rem", alignItems: "baseline" }}>
          <span
            style={{ color: scoreColor(offer.score), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
            title="Score de pertinence (0–100)"
          >
            {offer.score}
          </span>
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>{offer.title}</h1>
        </div>
        {where && <div style={{ color: MUTED, marginTop: 6 }}>{where}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginTop: 10 }}>
          {offer.contractType && <span style={chip}>{offer.contractType}</span>}
          {offer.salary && <span style={{ ...chip, color: "#cfe8d4", borderColor: "#2e4a36" }}>💶 {offer.salary}</span>}
          {offer.sector && <span style={chip}>{offer.sector}</span>}
          {postedLabel && <span style={chip}>🗓 {postedLabel}</span>}
        </div>

        {offer.scoreRationale && (
          <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: 10 }}>{offer.scoreRationale}</p>
        )}
        <div style={{ marginTop: 8, fontSize: "0.82rem", color: MUTED }}>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>
              Voir l&apos;offre d&apos;origine ↗
            </a>
          )}
          <span style={{ marginLeft: url ? "0.8rem" : 0 }}>
            sources : {offer.sources.map((s) => s.source).join(", ")}
          </span>
        </div>
      </header>

      <section style={{ marginTop: "1.8rem" }}>
        {app ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
              <span style={{ color: "#3ddc84", fontSize: "0.9rem" }}>✓ Candidature générée</span>
              {APPLICATION_FILES.map((f) => (
                <a
                  key={f}
                  href={`/api/applications/${offerId}/${f}`}
                  style={{ ...chip, color: ACCENT, borderColor: "#2a4658" }}
                >
                  ⬇ {f}
                </a>
              ))}
            </div>
            <ApplicationView content={app.content} />
            <ApplicationEditor offerId={offerId} initial={app.content} />
          </>
        ) : (
          <>
            <p style={{ color: MUTED }}>
              Aucune candidature générée pour cette offre. Lancez la génération du CV
              et de la lettre adaptés.
            </p>
            <GenerateButton offerId={offerId} />
          </>
        )}
      </section>
    </main>
  );
}
