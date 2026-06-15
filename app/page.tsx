import Link from "next/link";

export default function Home() {
  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <p className="small" style={{ color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--sp-3)" }}>
        Assistant de recherche d&apos;emploi
      </p>
      <h1 style={{ fontSize: "clamp(2.2rem, 1.6rem + 2vw, 3rem)", marginBottom: "var(--sp-4)" }}>
        Trouver, adapter, suivre — sans le bruit.
      </h1>
      <p style={{ color: "var(--ink-soft)", fontSize: "1.08rem", maxWidth: "52ch" }}>
        Des offres de communication en Île-de-France, agrégées et filtrées pour un
        profil de cadre senior. Pour chaque offre, un CV et une lettre adaptés,
        relus et prêts à envoyer.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", margin: "var(--sp-6) 0" }}>
        <Link href="/offres" className="btn btn-primary" style={{ textDecoration: "none" }}>
          Voir les offres →
        </Link>
        <Link href="/suivi" className="btn" style={{ textDecoration: "none" }}>
          Suivi des candidatures
        </Link>
      </div>

      <hr className="rule" />
      <p className="small muted">
        Recherche en ligne de commande : <code>npm run discover</code> · génération :{" "}
        <code>npm run generate -- --offer=&lt;id&gt;</code>.
      </p>
    </main>
  );
}
