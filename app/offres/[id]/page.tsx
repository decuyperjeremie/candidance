import Link from "next/link";
import { getOffer } from "@/lib/aggregation/store";
import { getApplication } from "@/lib/generation/store";
import { APPLICATION_FILES } from "@/lib/render";
import type { ApplicationContent } from "@/lib/generation/content";
import { buildDraft, gmailComposeUrl, mailtoUrl } from "@/lib/email/draft";
import { getEvents, getStatus, STATUSES, STATUS_LABELS } from "@/lib/tracking/store";
import { scoreColor } from "@/app/ui/tokens";
import { ApplicationEditor, GenerateButton } from "./editor";
import { TrackingControls } from "./tracking";

// Reads the SQLite DB at request time — never statically prerendered.
export const dynamic = "force-dynamic";

/** Read-only rendering of the generated CV + letter, mirroring what downloads carry. */
function ApplicationView({ content }: { content: ApplicationContent }) {
  const { cv, letter } = content;
  return (
    <section className="card">
      <h2 className="section-title">Aperçu</h2>

      {cv.headline && <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{cv.headline}</div>}
      {cv.summary && <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, marginTop: "var(--sp-2)" }}>{cv.summary}</p>}

      {cv.experiences.length > 0 && (
        <>
          <h3 style={{ margin: "var(--sp-4) 0 var(--sp-2)" }}>Expériences</h3>
          {cv.experiences.map((e, i) => (
            <div key={i} style={{ marginBottom: "var(--sp-3)" }}>
              <div style={{ fontWeight: 600 }}>
                {e.title}
                {e.organisation ? ` – ${e.organisation}` : ""}
              </div>
              <div className="muted small">{[e.period, e.location].filter(Boolean).join(" · ")}</div>
              {e.highlights.length > 0 && (
                <ul style={{ margin: "4px 0 0", paddingLeft: "1.2rem", color: "var(--ink-soft)", lineHeight: 1.55 }}>
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
          <h3 style={{ margin: "var(--sp-4) 0 var(--sp-2)" }}>Formations</h3>
          {cv.formations.map((f, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{f.degree}</span>
              {f.institution ? ` – ${f.institution}` : ""}
              {f.period ? <span className="muted"> ({f.period})</span> : null}
            </div>
          ))}
        </>
      )}

      {cv.skills.length > 0 && (
        <>
          <h3 style={{ margin: "var(--sp-4) 0 var(--sp-2)" }}>Compétences</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {cv.skills.map((s, i) => (
              <span key={i} className="chip">{s}</span>
            ))}
          </div>
        </>
      )}

      {cv.languages.length > 0 && (
        <>
          <h3 style={{ margin: "var(--sp-4) 0 var(--sp-2)" }}>Langues</h3>
          <div style={{ color: "var(--ink-soft)" }}>
            {cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(" · ")}
          </div>
        </>
      )}

      <h3 style={{ margin: "var(--sp-5) 0 var(--sp-2)" }}>Lettre de motivation</h3>
      {letter.recipientContext && <div className="muted small" style={{ marginBottom: 6 }}>{letter.recipientContext}</div>}
      {letter.paragraphs.map((p, i) => (
        <p key={i} style={{ color: "var(--ink-soft)", lineHeight: 1.65, margin: "0 0 0.7rem" }}>{p}</p>
      ))}
    </section>
  );
}

export default async function OffreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offerId = Number(id);
  const offer = Number.isNaN(offerId) ? undefined : getOffer(offerId);

  if (!offer) {
    return (
      <main className="container" style={{ maxWidth: 720 }}>
        <Link href="/offres" className="small">← Retour aux offres</Link>
        <h1 style={{ marginTop: "var(--sp-5)" }}>Offre introuvable</h1>
        <p className="muted">
          Aucune offre ne correspond à l&apos;identifiant #{id}. Elle a peut-être été
          retirée de la base.
        </p>
      </main>
    );
  }

  const app = getApplication(offerId);
  const status = getStatus(offerId);
  const events = app ? getEvents(offerId) : [];
  const draft = app ? buildDraft(offer, app.content.cv.contact.fullName) : null;
  const url = offer.sources.find((s) => s.url)?.url;
  const applyUrl =
    offer.contact?.method === "url"
      ? offer.contact.applyUrl
      : offer.contact?.method === "email"
        ? undefined
        : url;
  const where = [offer.company, offer.location].filter(Boolean).join(" · ");
  const postedAt = offer.postedAt ? new Date(offer.postedAt) : null;
  const postedLabel = postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt.toLocaleDateString("fr-FR") : null;

  return (
    <main className="container">
      <Link href="/offres" className="small">← Retour aux offres</Link>

      <header style={{ marginTop: "var(--sp-5)" }}>
        <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "baseline" }}>
          <span style={{ color: scoreColor(offer.score), fontWeight: 600, fontVariantNumeric: "tabular-nums" }} title="Score de pertinence (0–100)">
            {offer.score}
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)" }}>{offer.title}</h1>
        </div>
        {where && <div className="muted" style={{ marginTop: 6 }}>{where}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginTop: "var(--sp-3)" }}>
          {offer.contractType && <span className="chip">{offer.contractType}</span>}
          {offer.salary && <span className="chip chip-pay">💶 {offer.salary}</span>}
          {offer.sector && <span className="chip">{offer.sector}</span>}
          {postedLabel && <span className="chip">🗓 {postedLabel}</span>}
        </div>

        {offer.scoreRationale && <p className="muted small" style={{ marginTop: "var(--sp-3)" }}>{offer.scoreRationale}</p>}
        <div className="small" style={{ marginTop: "var(--sp-2)", color: "var(--faint)" }}>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              Voir l&apos;offre d&apos;origine ↗
            </a>
          )}
          <span style={{ marginLeft: url ? "0.8rem" : 0 }}>
            sources : {offer.sources.map((s) => s.source).join(", ")}
          </span>
        </div>
      </header>

      <div style={{ marginTop: "var(--sp-6)", display: "grid", gap: "var(--sp-5)" }}>
        {app ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
              <span className="small" style={{ color: "var(--good)" }}>✓ Candidature générée</span>
              {APPLICATION_FILES.map((f) => (
                <a key={f} href={`/api/applications/${offerId}/${f}`} className="chip chip-accent">
                  ⬇ {f}
                </a>
              ))}
            </div>

            {draft && (
              <section className="card">
                <h2 className="section-title">Préparer l&apos;email</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
                  <a href={gmailComposeUrl(draft)} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: "none" }}>
                    ✉ Ouvrir dans Gmail
                  </a>
                  <a href={mailtoUrl(draft)} className="btn" style={{ textDecoration: "none" }}>
                    Brouillon mailto
                  </a>
                  <a href={`/api/applications/${offerId}/email.eml`} className="chip chip-accent">
                    ⬇ email.eml (avec pièces jointes)
                  </a>
                  {applyUrl && (
                    <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="chip chip-accent" style={{ textDecoration: "none" }}>
                      Postuler en ligne ↗
                    </a>
                  )}
                </div>
                {offer.contact?.method === "email" && offer.contact.email && (
                  <p className="muted small" style={{ marginTop: "var(--sp-2)", marginBottom: 0 }}>
                    Destinataire détecté : <strong>{offer.contact.email}</strong>
                    {offer.contact.contactName ? ` (${offer.contact.contactName})` : ""}
                  </p>
                )}
                <p className="muted small" style={{ marginTop: "var(--sp-3)", marginBottom: 0 }}>
                  Le brouillon <em>mailto</em> pré-remplit l&apos;objet et le message ; les pièces
                  jointes doivent y être ajoutées à la main. Le fichier <em>email.eml</em> s&apos;ouvre
                  dans ton client mail avec le CV et la lettre déjà attachés. Aucun envoi automatique.
                </p>
              </section>
            )}

            <TrackingControls
              offerId={offerId}
              status={status}
              statuses={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              events={events}
            />

            <ApplicationView content={app.content} />
            <ApplicationEditor offerId={offerId} initial={app.content} />
          </>
        ) : (
          <section className="card">
            <h2 className="section-title">Candidature</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Aucune candidature générée pour cette offre. Lancez la génération du CV
              et de la lettre adaptés.
            </p>
            <GenerateButton offerId={offerId} />
          </section>
        )}
      </div>
    </main>
  );
}
