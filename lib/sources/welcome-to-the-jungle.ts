/**
 * Welcome to the Jungle connector — opt-in, non-blocking, medium reliability.
 *
 * WTTJ search is Algolia-backed and rendered client-side; the SSR HTML still
 * embeds a `__NEXT_DATA__` JSON blob from which we try to read job cards. This
 * is best-effort: WTTJ markup/data shape changes often and may block bots — on
 * any mismatch we return [] (recorded reason), never crashing the pass. Not
 * load-bearing for the slice deliverable. Selectors/paths are unverified
 * against live markup (see design.md Open Questions).
 */

import { fetchHtml, readNextData } from "./scrape";
import { clean, departmentFromLocation } from "./normalise";
import type { JobSource, RawOffer, SearchCriteria } from "./types";

export class WelcomeToTheJungleSource implements JobSource {
  readonly name = "welcome-to-the-jungle" as const;
  readonly reliability = "medium" as const;

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const query = encodeURIComponent(criteria.keywords.join(" "));
    const url = `https://www.welcometothejungle.com/fr/jobs?query=${query}&aroundQuery=Paris%2C+France`;
    const $ = await fetchHtml(this.name, url);

    // Try the embedded Next.js data first; fall back to visible job links.
    const fromData = this.fromNextData(readNextData($));
    if (fromData.length) return fromData;

    const out: RawOffer[] = [];
    $('a[href*="/companies/"][href*="/jobs/"]').each((_, el) => {
      const href = $(el).attr("href");
      const title = clean($(el).text());
      if (!href || !title) return;
      const slug = href.split("/jobs/")[1]?.split(/[?#]/)[0];
      if (!slug) return;
      out.push({
        source: this.name,
        sourceLocalId: slug,
        title,
        url: href.startsWith("http") ? href : `https://www.welcometothejungle.com${href}`,
      });
    });
    return dedupById(out);
  }

  /** Walk the embedded JSON for anything that looks like a hits[] array. */
  private fromNextData(data: unknown): RawOffer[] {
    const hits = findHits(data);
    return dedupById(
      hits
        .map((h) => this.normaliseHit(h))
        .filter((o): o is RawOffer => o !== null),
    );
  }

  private normaliseHit(h: Record<string, unknown>): RawOffer | null {
    const slug = clean(h.slug as string) ?? clean(h.reference as string);
    const title = clean(h.name as string) ?? clean(h.title as string);
    if (!slug || !title) return null;
    const org = h.organization as Record<string, unknown> | undefined;
    const offices = h.offices as { city?: string }[] | undefined;
    const location = clean(offices?.map((o) => o.city).filter(Boolean).join(", "));
    const orgSlug = clean(org?.slug as string);
    return {
      source: this.name,
      sourceLocalId: slug,
      title,
      company: clean(org?.name as string),
      location,
      departmentCode: departmentFromLocation(location),
      url:
        orgSlug != null
          ? `https://www.welcometothejungle.com/fr/companies/${orgSlug}/jobs/${slug}`
          : undefined,
      contractType: clean(h.contract_type as string),
      postedAt: clean(h.published_at as string),
    };
  }
}

/** Recursively find the first plausible array of job hits in nested JSON. */
function findHits(data: unknown): Record<string, unknown>[] {
  const looksLikeJob = (o: unknown): o is Record<string, unknown> =>
    !!o && typeof o === "object" && ("slug" in o || "reference" in o) && ("name" in o || "title" in o);

  const seen: Record<string, unknown>[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      if (node.length && node.every(looksLikeJob)) {
        seen.push(...(node as Record<string, unknown>[]));
        return;
      }
      for (const item of node) visit(item, depth + 1);
      return;
    }
    for (const v of Object.values(node)) visit(v, depth + 1);
  };
  visit(data, 0);
  return seen;
}

function dedupById(offers: RawOffer[]): RawOffer[] {
  const byId = new Map<string, RawOffer>();
  for (const o of offers) if (o.sourceLocalId) byId.set(o.sourceLocalId, o);
  return [...byId.values()];
}
