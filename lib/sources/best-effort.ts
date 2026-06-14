/**
 * Best-effort connectors: LinkedIn, Indeed, Glassdoor.
 *
 * These sites fight scraping hard, so they are OFF BY DEFAULT and the slice
 * deliverable never depends on them. They use a headless browser via the
 * OPTIONAL `playwright` dependency, imported lazily so the core installs and
 * runs without it. When playwright is absent or the site blocks us, the
 * connector yields ZERO offers with a recorded reason (console warning) — never
 * a crash (see specs/job-sources, best-effort requirement).
 *
 * The extraction below is a generic scaffold (collect job-detail links). Real,
 * per-site selectors are intentionally left minimal; enable + harden only if a
 * site proves worth the maintenance.
 */

import type { JobSourceName } from "@/lib/config";
import { clean } from "./normalise";
import type { JobSource, RawOffer, SearchCriteria } from "./types";

/** Lazy, type-free playwright load. Returns null if the dep isn't installed. */
async function loadPlaywright(): Promise<{ chromium: { launch: (o?: unknown) => Promise<unknown> } } | null> {
  const moduleName = "playwright"; // non-literal at call site -> not bundled/typed
  try {
    return (await import(/* webpackIgnore: true */ moduleName)) as never;
  } catch {
    return null;
  }
}

type BestEffortConfig = {
  name: JobSourceName;
  /** Build the search results URL from the criteria. */
  searchUrl: (criteria: SearchCriteria) => string;
  /** CSS selector matching anchors that link to a job detail page. */
  jobLinkSelector: string;
};

/** Shared best-effort flow: launch chromium, open the search page, collect links. */
abstract class BestEffortSource implements JobSource {
  readonly reliability = "best-effort" as const;
  protected abstract config: BestEffortConfig;

  get name(): JobSourceName {
    return this.config.name;
  }

  async fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]> {
    const pw = await loadPlaywright();
    if (!pw) {
      console.warn(
        `[${this.name}] playwright non installé — source best-effort ignorée ` +
          `(npm i playwright && npx playwright install chromium pour l'activer). 0 offre.`,
      );
      return [];
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    let browser: any;
    try {
      browser = await (pw.chromium as any).launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(this.config.searchUrl(criteria), {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      const links: { href: string; text: string }[] = await page.$$eval(
        this.config.jobLinkSelector,
        (els: any[]) =>
          els.map((e) => ({ href: e.href as string, text: (e.textContent ?? "").trim() })),
      );
      return links
        .map((l) => this.normalise(l))
        .filter((o): o is RawOffer => o !== null);
    } catch (err) {
      console.warn(
        `[${this.name}] best-effort bloqué/échec (${err instanceof Error ? err.message : String(err)}). 0 offre.`,
      );
      return [];
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  private normalise(link: { href: string; text: string }): RawOffer | null {
    const title = clean(link.text);
    const url = clean(link.href);
    if (!title || !url) return null;
    return { source: this.name, sourceLocalId: url, title, url };
  }
}

export class LinkedinSource extends BestEffortSource {
  protected config: BestEffortConfig = {
    name: "linkedin",
    searchUrl: (c) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(c.keywords.join(" "))}&location=Île-de-France`,
    jobLinkSelector: "a.base-card__full-link, a[href*='/jobs/view/']",
  };
}

export class IndeedSource extends BestEffortSource {
  protected config: BestEffortConfig = {
    name: "indeed",
    searchUrl: (c) =>
      `https://fr.indeed.com/jobs?q=${encodeURIComponent(c.keywords.join(" "))}&l=Île-de-France`,
    jobLinkSelector: "a[href*='/rc/clk'], a.jcs-JobTitle",
  };
}

export class GlassdoorSource extends BestEffortSource {
  protected config: BestEffortConfig = {
    name: "glassdoor",
    searchUrl: (c) =>
      `https://www.glassdoor.fr/Emploi/île-de-france-${encodeURIComponent(c.keywords.join("-"))}-emplois-SRCH_IL.0,13.htm`,
    jobLinkSelector: "a[href*='/partner/jobListing'], a.JobCard_jobTitle__",
  };
}
