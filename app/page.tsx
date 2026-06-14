export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        Tatiana — Assistant de recherche d&apos;emploi
      </h1>
      <p style={{ color: "#9a9aa3", marginTop: 0 }}>
        Prototype jetable · Slice 2 (Trouver) — offres réelles agrégées.
      </p>

      <section style={{ marginTop: "2rem", lineHeight: 1.7 }}>
        <p>
          <a
            href="/offres"
            style={{
              display: "inline-block",
              background: "#7fd4ff",
              color: "#0b0b0f",
              fontWeight: 600,
              borderRadius: 8,
              padding: "0.6rem 1.1rem",
              textDecoration: "none",
            }}
          >
            Voir les offres →
          </a>
        </p>
        <p style={{ color: "#9a9aa3" }}>
          Offres de communication (Île-de-France) agrégées, dédupliquées et
          scorées vs le profil. La sélection / l&apos;édition (CV + lettre) arrive
          dans les tranches suivantes.
        </p>
        <ul style={{ color: "#9a9aa3" }}>
          <li>
            Recherche en ligne de commande&nbsp;:{" "}
            <code style={{ color: "#7fd4ff" }}>npm run discover</code>
          </li>
          <li>
            Endpoints&nbsp;:{" "}
            <a href="/api/discover" style={{ color: "#7fd4ff" }}>
              /api/discover
            </a>{" "}
            ·{" "}
            <a href="/api/smoke" style={{ color: "#7fd4ff" }}>
              /api/smoke
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
