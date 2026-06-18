import { listOffers } from "@/lib/aggregation/store";
import { parseSalaryAmount } from "@/lib/aggregation/salary";
import { getStatuses, STATUS_LABELS } from "@/lib/tracking/store";
import { STATUS_COLOR } from "@/app/ui/tokens";
import { DiscoverButton } from "./discover-button";
import { OffersList, type OfferRow } from "./offers-list";

// Reads the SQLite DB at request time — never statically prerendered.
export const dynamic = "force-dynamic";

export default function OffresPage() {
  const offers = listOffers(200);
  const statuses = getStatuses(offers.map((o) => o.id));

  const rows: OfferRow[] = offers.map((o) => {
    const status = statuses.get(o.id);
    return {
      id: o.id,
      title: o.title,
      company: o.company,
      location: o.location,
      contractType: o.contractType,
      salary: o.salary,
      postedAt: o.postedAt,
      score: o.score,
      scoreRationale: o.scoreRationale,
      sources: o.sources,
      statusLabel: status ? STATUS_LABELS[status] : null,
      statusColor: status ? STATUS_COLOR[status] : null,
      salaryAmount: parseSalaryAmount(o.salary),
    };
  });

  return (
    <main className="container">
      <p className="small" style={{ color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--sp-2)" }}>
        Communication · Île-de-France
      </p>
      <h1 style={{ marginBottom: "var(--sp-2)" }}>Offres</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {offers.length} offre{offers.length > 1 ? "s" : ""} en base. Triez par score,
        date ou rémunération. Cliquez un titre pour générer et éditer la candidature.
      </p>

      <div style={{ margin: "var(--sp-5) 0 var(--sp-6)" }}>
        <DiscoverButton />
      </div>

      {offers.length === 0 ? (
        <p className="muted">
          Aucune offre en base. Cliquez sur « Lancer une recherche » (nécessite les
          identifiants France Travail dans <code>.env</code>).
        </p>
      ) : (
        <OffersList offers={rows} />
      )}
    </main>
  );
}
