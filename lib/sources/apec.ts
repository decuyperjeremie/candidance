/**
 * APEC connector (cadre offers) — opt-in, non-blocking, medium reliability.
 *
 * APEC renders search results client-side from its internal JSON API
 * (api.apec.fr). We hit that public search endpoint directly (more robust than
 * scraping the JS-rendered DOM) and normalise the hits. Endpoint shape is
 * unverified against a live key-less call — see design.md Open Questions; if it
 * changes or blocks, this yields [] / a JobSourceError, both isolated by
 * aggregation. Never load-bearing for the slice deliverable.
 */

import { clean, departmentFromLocation } from "./normalise";
import { JobSourceError, type JobSource, type RawOffer, type SearchCriteria } from "./types";

const SEARCH_API = "https://www.apec.fr/cms/webservices/rechercheOffre";

type ApecHit = {
  numeroOffre?: string;
  intitule?: string;
  texteHtml?: string;
  texteOffre?: string;
  nomCommercialEntreprise?: string;
  lieux?: { libelle?: string }[];
  typeContrat?: string;
  datePublication?: string;
};

export class ApecSource implements JobSource {
  readonly name = "apec" as const;
  readonly reliability = "medium" as const;

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const payload = {
      motsCles: criteria.keywords.join(" "),
      lieux: criteria.departments, // department codes; best-effort
      typesConvention: [],
      pagination: { range: 50, startIndex: 0 },
      sorts: [{ type: "DATE", direction: "DESCENDING" }],
    };

    let res: Response;
    try {
      res = await fetch(SEARCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new JobSourceError(this.name, "APEC search endpoint unreachable.", err);
    }
    if (!res.ok) {
      throw new JobSourceError(this.name, `APEC search failed (HTTP ${res.status}).`);
    }
    const json = (await res.json().catch(() => ({}))) as { resultats?: ApecHit[] };
    return (json.resultats ?? []).map((h) => this.normalise(h)).filter((o) => o.sourceLocalId);
  }

  private normalise(h: ApecHit): RawOffer {
    const location = clean(h.lieux?.map((l) => l.libelle).filter(Boolean).join(", "));
    const id = clean(h.numeroOffre);
    return {
      source: this.name,
      sourceLocalId: id ?? "",
      title: clean(h.intitule) ?? "(sans intitulé)",
      company: clean(h.nomCommercialEntreprise),
      location,
      departmentCode: departmentFromLocation(location),
      url: id ? `https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/${id}` : undefined,
      description: clean(h.texteOffre) ?? clean(h.texteHtml),
      contractType: clean(h.typeContrat),
      postedAt: clean(h.datePublication),
    };
  }
}
