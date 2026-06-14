/**
 * France Travail "Offres d'emploi v2" connector — the primary, free, reliable
 * source and the only one the Slice 2 deliverable depends on.
 *
 * Auth   : OAuth2 client_credentials, token endpoint with mandatory
 *          ?realm=/partenaire, scope "api_offresdemploiv2 o2dsoffre".
 * Search : GET /partenaire/offresdemploi/v2/offres/search, paginated via
 *          `range=p-d` (≤150/page), following Content-Range / 206 up to the
 *          API's 1150-offer ceiling.
 * Zone   : Île-de-France via `departement`; one call for the comma list, with a
 *          per-department fallback if the API rejects multi-value.
 *
 * Native `fetch` only (no SDK). Facts verified against francetravail.io (2025-26).
 */

import { getConfig } from "@/lib/config";
import { clean, departmentFromLocation } from "./normalise";
import { IDF_DEPARTMENTS, JobSourceError, type JobSource, type RawOffer, type SearchCriteria } from "./types";

const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";
const SEARCH_URL =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

/** Page size and hard access ceiling documented by the API. */
const PAGE_SIZE = 150;
const MAX_OFFERS = 1150;
/** ~3 req/s rate limit -> minimum spacing between calls. */
const MIN_REQUEST_SPACING_MS = 350;

/** Shape of one offer in the API's `resultats[]` (only the fields we read). */
type FtOffer = {
  id?: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  typeContrat?: string;
  romeCode?: string;
  lieuTravail?: { libelle?: string; codePostal?: string; commune?: string };
  entreprise?: { nom?: string };
  origineOffre?: { urlOrigine?: string };
  salaire?: { libelle?: string };
  secteurActivite?: string;
};

export class FranceTravailSource implements JobSource {
  readonly name = "france-travail" as const;
  readonly reliability = "high" as const;

  private token: { value: string; expiresAt: number } | null = null;
  private lastRequestAt = 0;

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const departments = criteria.departments.length
      ? criteria.departments
      : [...IDF_DEPARTMENTS];
    const keywords = criteria.keywords.length ? criteria.keywords : ["communication"];

    // France Travail's `motsCles` treats a comma list as AND, so several phrases
    // joined would match almost nothing. Issue one query per keyword and merge
    // by source id (in-source dedup) for broad recall; the communication gate +
    // scoring downstream provide precision.
    const byId = new Map<string, RawOffer>();
    for (const kw of keywords) {
      for (const o of await this.searchKeyword(kw, departments)) {
        byId.set(o.sourceLocalId, o);
      }
    }
    return [...byId.values()];
  }

  /** One keyword across the zone: try the multi-department list, fall back per-dep. */
  private async searchKeyword(
    motsCles: string,
    departments: string[],
  ): Promise<RawOffer[]> {
    try {
      return await this.searchAllPages(motsCles, departments.join(","));
    } catch (err) {
      if (!(err instanceof MultiDepartmentRejected)) throw err;
      const byId = new Map<string, RawOffer>();
      for (const dep of departments) {
        for (const o of await this.searchAllPages(motsCles, dep)) {
          byId.set(o.sourceLocalId, o); // dedup within source by id
        }
      }
      return [...byId.values()];
    }
  }

  /** Walk `range` pages until exhausted or the API ceiling is reached. */
  private async searchAllPages(
    motsCles: string,
    departement: string,
  ): Promise<RawOffer[]> {
    const out: RawOffer[] = [];
    let start = 0;
    for (;;) {
      const end = Math.min(start + PAGE_SIZE - 1, MAX_OFFERS - 1);
      const { offers, total } = await this.searchPage(motsCles, departement, start, end);
      out.push(...offers);
      const next = end + 1;
      if (offers.length === 0 || next >= Math.min(total, MAX_OFFERS)) break;
      start = next;
    }
    return out;
  }

  private async searchPage(
    motsCles: string,
    departement: string,
    start: number,
    end: number,
  ): Promise<{ offers: RawOffer[]; total: number }> {
    const params = new URLSearchParams({
      motsCles,
      departement,
      range: `${start}-${end}`,
    });
    const res = await this.authedFetch(`${SEARCH_URL}?${params.toString()}`);

    // 204 = no offers for these criteria.
    if (res.status === 204) return { offers: [], total: 0 };

    // A 400 on a multi-department list -> signal the per-department fallback.
    if (res.status === 400 && departement.includes(",")) {
      throw new MultiDepartmentRejected();
    }
    if (!res.ok && res.status !== 206) {
      const body = await safeBody(res);
      throw new JobSourceError(
        this.name,
        `France Travail search failed (HTTP ${res.status}): ${body}`,
      );
    }

    const total = parseTotalFromContentRange(res.headers.get("content-range")) ?? undefined;
    const json = (await res.json().catch(() => ({}))) as { resultats?: FtOffer[] };
    const offers = (json.resultats ?? []).map((o) => this.normalise(o));
    return { offers, total: total ?? offers.length };
  }

  /** Map a France Travail offer to the common shape, coding defensively. */
  private normalise(o: FtOffer): RawOffer {
    const location = clean(o.lieuTravail?.libelle);
    const postal = clean(o.lieuTravail?.codePostal);
    const insee = clean(o.lieuTravail?.commune);
    return {
      source: this.name,
      sourceLocalId: clean(o.id) ?? "",
      title: clean(o.intitule) ?? "(sans intitulé)",
      company: clean(o.entreprise?.nom),
      location,
      departmentCode: departmentFromLocation(location ?? postal ?? insee),
      url: clean(o.origineOffre?.urlOrigine),
      description: clean(o.description),
      contractType: clean(o.typeContrat),
      salary: clean(o.salaire?.libelle),
      sector: clean(o.secteurActivite),
      postedAt: clean(o.dateCreation),
      romeCode: clean(o.romeCode),
    };
  }

  // --- auth ----------------------------------------------------------------

  private async authedFetch(url: string): Promise<Response> {
    await this.throttle();
    const token = await this.getToken();
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.token.expiresAt) return this.token.value;

    const { clientId, clientSecret } = getConfig().franceTravail;
    if (!clientId || !clientSecret) {
      throw new JobSourceError(
        this.name,
        "Identifiants France Travail manquants. Renseigne FRANCE_TRAVAIL_CLIENT_ID " +
          "et FRANCE_TRAVAIL_CLIENT_SECRET (compte gratuit sur https://francetravail.io).",
      );
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPE,
    });
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (err) {
      throw new JobSourceError(this.name, "France Travail token endpoint unreachable.", err);
    }
    if (!res.ok) {
      throw new JobSourceError(
        this.name,
        `France Travail auth failed (HTTP ${res.status}): ${await safeBody(res)}`,
      );
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new JobSourceError(this.name, "France Travail auth returned no access_token.");
    }
    const ttlMs = (json.expires_in ?? 1499) * 1000;
    this.token = { value: json.access_token, expiresAt: Date.now() + ttlMs - 60_000 };
    return this.token.value;
  }

  /** Keep calls under ~3 req/s. */
  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + MIN_REQUEST_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }
}

/** Internal signal: the comma-separated `departement` list was rejected. */
class MultiDepartmentRejected extends Error {}

/** Parse the total from a `Content-Range: offres p-d/total` header. */
function parseTotalFromContentRange(header: string | null): number | null {
  const m = header?.match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "(no body)";
  }
}
