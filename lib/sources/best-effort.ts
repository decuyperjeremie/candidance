/**
 * Best-effort connectors: LinkedIn, Indeed, Glassdoor.
 *
 * These sites fight scraping hard, so they are OFF BY DEFAULT and the slice
 * deliverable never depends on them. They route through the `CrawlBackend`
 * seam (default: lazy Playwright), so Firecrawl / Obscura can be dropped in
 * later without touching connector code. When the backend is absent or the
 * site blocks us, the connector yields ZERO offers (console warning) — never
 * a crash (see specs/job-sources, best-effort requirement).
 *
 * Contact is extracted from rendered HTML via `extractContact` over
 * `mailto:` links and apply buttons.
 */

import type { JobSourceName } from "@/lib/config";
import { extractContact, firstEmail, firstUrl } from "./contact";
import { clean } from "./normalise";
import { getCrawlBackend } from "./crawl-backend";
import type { JobSource, OfferContact, RawOffer, SearchCriteria } from "./types";

type BestEffortConfig = {
  name: JobSourceName;
  /** Build the search results URL from the criteria. */
  searchUrl: (criteria: SearchCriteria) => string;
  /** CSS selector matching anchors that link to a job detail page. */
  jobLinkSelector: string;
};

/** Extract apply contact from a rendered offer page HTML. */
function contactFromHtml(html: string): OfferContact {
  const mailtoMatch = html.match(/href="(mailto:[^"]+)"/i);
  const applyMatch = html.match(/href="([^"]*(?:apply|postuler|candidat)[^"]*)"[^>]*>[^<]*(?:postuler|apply|candidater)/i);

  const emailish = mailtoMatch ? mailtoMatch[1] : undefined;
  const applyUrl = applyMatch ? applyMatch[1] : firstUrl(html.slice(0, 5000));

  return extractContact({ emailish, urls: applyUrl ? [applyUrl] : [] });
}

/** Shared best-effort flow: fetch the search page via the crawl backend, collect links. */
abstract class BestEffortSource implements JobSource {
  readonly reliability = "best-effort" as const;
  protected abstract config: BestEffortConfig;

  get name(): JobSourceName {
    return this.config.name;
  }

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const backend = getCrawlBackend();
    const html = await backend.fetchRendered(this.config.searchUrl(criteria));
    if (!html) {
      console.warn(
        `[${this.name}] crawl backend indisponible ou bloqué — source best-effort ignorée. 0 offre.`,
      );
      return [];
    }

    try {
      return this.extractOffers(html);
    } catch (err) {
      console.warn(
        `[${this.name}] extraction échouée (${err instanceof Error ? err.message : String(err)}). 0 offre.`,
      );
      return [];
    }
  }

  protected extractOffers(html: string): RawOffer[] {
    // Generic: collect <a> tags matching the job link selector pattern via regex.
    const hrefRe = new RegExp(`href="(${this.jobLinkPattern}[^"]*)"[^>]*>([^<]+)`, "gi");
    const out: RawOffer[] = [];
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1];
      const text = m[2].trim();
      const title = clean(text);
      const url = href.startsWith("http") ? href : `https://${this.host}${href}`;
      if (!title || !url) continue;
      out.push({
        source: this.name,
        sourceLocalId: url,
        title,
        url,
        contact: contactFromHtml(html),
      });
    }
    return [...new Map(out.map((o) => [o.sourceLocalId, o])).values()];
  }

  protected abstract jobLinkPattern: string;
  protected abstract host: string;
}

export class LinkedinSource extends BestEffortSource {
  protected config: BestEffortConfig = {
    name: "linkedin",
    searchUrl: (c) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(c.keywords.join(" "))}&location=Île-de-France`,
    jobLinkSelector: "a.base-card__full-link, a[href*='/jobs/view/']",
  };
  protected jobLinkPattern = "/jobs/view/";
  protected host = "www.linkedin.com";
}

export class IndeedSource extends BestEffortSource {
  protected config: BestEffortConfig = {
    name: "indeed",
    searchUrl: (c) =>
      `https://fr.indeed.com/jobs?q=${encodeURIComponent(c.keywords.join(" "))}&l=Île-de-France`,
    jobLinkSelector: "a[href*='/rc/clk'], a.jcs-JobTitle",
  };
  protected jobLinkPattern = "/rc/clk|/viewjob";
  protected host = "fr.indeed.com";
}

export class GlassdoorSource extends BestEffortSource {
  protected config: BestEffortConfig = {
    name: "glassdoor",
    searchUrl: (c) =>
      `https://www.glassdoor.fr/Emploi/île-de-france-${encodeURIComponent(c.keywords.join("-"))}-emplois-SRCH_IL.0,13.htm`,
    jobLinkSelector: "a[href*='/partner/jobListing'], a.JobCard_jobTitle__",
  };
  protected jobLinkPattern = "/partner/jobListing|/emploi-annonce";
  protected host = "www.glassdoor.fr";
}
