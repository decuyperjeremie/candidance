/**
 * Welcome to the Jungle connector — opt-in, non-blocking, medium reliability.
 *
 * WTTJ's web search requires auth for bots. Instead we use their public
 * Algolia index (app: CSEKHVMS53, index: wk_cms_jobs_production) with the
 * search-only key embedded in the page. Credentials are stable (public, rotated
 * if WTTJ changes them) and requests go directly to Algolia — no Playwright needed.
 *
 * Best-effort: any failure returns [] without crashing the pass.
 */

import { extractContact } from "./contact";
import { clean, departmentFromLocation } from "./normalise";
import type { JobSource, RawOffer, SearchCriteria } from "./types";

const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_SEARCH_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_INDEX = "wk_cms_jobs_production";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

type AlgoliaHit = {
  objectID?: string;
  slug?: string;
  name?: string;
  profile?: string;
  contract_type?: string;
  contract_type_names?: { fr?: string };
  published_at?: string;
  office?: { city?: string; country_code?: string; district?: string };
  offices?: { city?: string; country_code?: string; district?: string }[];
  organization?: { name?: string; slug?: string };
  apply_on_company_site?: boolean;
  external_origin?: string;
};

export class WelcomeToTheJungleSource implements JobSource {
  readonly name = "welcome-to-the-jungle" as const;
  readonly reliability = "medium" as const;

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const out: RawOffer[] = [];

    for (const kw of criteria.keywords) {
      try {
        const hits = await this.searchAlgolia(kw);
        for (const h of hits) {
          const offer = this.normalise(h);
          if (offer) out.push(offer);
        }
      } catch (err) {
        console.warn(`[welcome-to-the-jungle] Algolia échoué pour "${kw}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return dedupById(out);
  }

  private async searchAlgolia(query: string): Promise<AlgoliaHit[]> {
    const body = JSON.stringify({
      query,
      hitsPerPage: 50,
      // Restrict to France, IDF departments/cities
      filters: "offices.country_code:FR",
      attributesToRetrieve: [
        "objectID", "slug", "name", "profile", "contract_type",
        "contract_type_names", "published_at", "office", "offices", "organization",
      ],
    });

    const res = await fetch(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "x-algolia-application-id": ALGOLIA_APP_ID,
        "x-algolia-api-key": ALGOLIA_SEARCH_KEY,
        "Content-Type": "application/json",
        "Referer": "https://www.welcometothejungle.com/",
        "Origin": "https://www.welcometothejungle.com",
      },
      body,
    });

    if (!res.ok) throw new Error(`Algolia HTTP ${res.status}`);
    const json = (await res.json()) as { hits?: AlgoliaHit[] };
    return json.hits ?? [];
  }

  private normalise(h: AlgoliaHit): RawOffer | null {
    const slug = clean(h.slug) ?? clean(h.objectID);
    const title = clean(h.name);
    if (!slug || !title) return null;

    const orgSlug = clean(h.organization?.slug);
    const offerUrl = orgSlug
      ? `https://www.welcometothejungle.com/fr/companies/${orgSlug}/jobs/${slug}`
      : undefined;

    // Use the first IDF office if available, else the primary office.
    const offices = h.offices ?? (h.office ? [h.office] : []);
    const idfOffice = offices.find((o) =>
      o.country_code === "FR" && isIdf(o.city, o.district)
    ) ?? offices.find((o) => o.country_code === "FR") ?? offices[0];

    const location = clean(idfOffice?.city ?? idfOffice?.district);

    return {
      source: this.name,
      sourceLocalId: slug,
      title,
      company: clean(h.organization?.name),
      location,
      departmentCode: departmentFromLocation(location),
      url: offerUrl,
      contractType: clean(h.contract_type_names?.fr ?? h.contract_type),
      description: clean(h.profile),
      postedAt: clean(h.published_at),
      contact: extractContact({ urls: offerUrl ? [offerUrl] : [] }),
    };
  }
}

/** Rough IDF city / district detection. */
function isIdf(city?: string, district?: string): boolean {
  const IDF_PATTERNS = /paris|seine|val.de.marne|hauts.de.seine|essonne|yvelines|val.d.oise|marne.la|versailles|boulogne|neuilly|levallois|issy|nanterre|montreuil|vincennes|ivry|vitry|st.denis|aubervilliers|cr.teil|argenteuil|cergy|évry|evry|massy/i;
  return IDF_PATTERNS.test(city ?? "") || IDF_PATTERNS.test(district ?? "");
}

function dedupById(offers: RawOffer[]): RawOffer[] {
  const byId = new Map<string, RawOffer>();
  for (const o of offers) if (o.sourceLocalId) byId.set(o.sourceLocalId, o);
  return [...byId.values()];
}
