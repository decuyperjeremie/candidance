/**
 * Company-site connector — crawl direct career pages of configured companies.
 *
 * Off by default (`JOB_SOURCES=company-site` to enable). Seeded from a static
 * list in `COMPANY_CAREER_SITES` env var (comma-separated URLs) or a sensible
 * default list. Best-effort: if a page fails to render or yields no offers, it
 * is skipped silently. Emits `OfferContact` via the shared extractor.
 */

import { extractContact } from "./contact";
import { clean } from "./normalise";
import { getCrawlBackend } from "./crawl-backend";
import type { JobSource, RawOffer, SearchCriteria } from "./types";

/** Default seed list of IDF-oriented company career pages. Override via env. */
const DEFAULT_COMPANY_SITES: string[] = [];

function getCompanySites(): string[] {
  const raw = process.env.COMPANY_CAREER_SITES;
  if (!raw?.trim()) return DEFAULT_COMPANY_SITES;
  return raw.split(",").map((u) => u.trim()).filter(Boolean);
}

export class CompanySiteSource implements JobSource {
  readonly name = "company-site" as const;
  readonly reliability = "best-effort" as const;

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const sites = getCompanySites();
    if (!sites.length) {
      console.warn(
        "[company-site] Aucun site configuré — définir COMPANY_CAREER_SITES dans .env. 0 offre.",
      );
      return [];
    }

    const backend = getCrawlBackend();
    const results: RawOffer[] = [];

    for (const siteUrl of sites) {
      const html = await backend.fetchRendered(siteUrl);
      if (!html) {
        console.warn(`[company-site] Impossible de rendre ${siteUrl} — ignoré.`);
        continue;
      }
      try {
        results.push(...this.extractOffers(siteUrl, html, criteria));
      } catch (err) {
        console.warn(`[company-site] Extraction échouée pour ${siteUrl}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return results;
  }

  private extractOffers(siteUrl: string, html: string, criteria: SearchCriteria): RawOffer[] {
    const keywords = criteria.keywords.map((k) => k.toLowerCase());
    const origin = new URL(siteUrl).origin;

    // Collect <a> links that look like job postings (contain title text matching keywords).
    const linkRe = /href="([^"]+)"[^>]*>([^<]{10,120})</g;
    const out: RawOffer[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      const text = m[2].trim();
      const title = clean(text);
      if (!title) continue;
      // Only keep links whose text mentions at least one keyword.
      if (!keywords.some((kw) => title.toLowerCase().includes(kw))) continue;
      const url = href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
      const mailtoMatch = html.match(/href="(mailto:[^"]+)"/i);
      out.push({
        source: this.name,
        sourceLocalId: url,
        title,
        url,
        contact: extractContact({
          emailish: mailtoMatch ? mailtoMatch[1] : undefined,
          urls: [url],
        }),
      });
    }

    return [...new Map(out.map((o) => [o.sourceLocalId, o])).values()];
  }
}
