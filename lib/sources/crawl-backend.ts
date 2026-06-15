/**
 * Pluggable crawl backend — thin seam so connectors don't hard-code Playwright.
 *
 * Default: the existing lazy-Playwright loader. Firecrawl / Obscura can be
 * dropped in later by config without touching connector code.
 *
 * `fetchRendered(url)` → HTML string, or null on failure (never throws).
 */

export interface CrawlBackend {
  /**
   * Render `url` and return its HTML, or null on failure (never throws).
   * @param waitUntil  Playwright lifecycle event. Default "networkidle" waits
   *   for JS-rendered content (Algolia, React hydration…). Use "domcontentloaded"
   *   for faster loads on server-rendered pages.
   */
  fetchRendered(url: string, waitUntil?: "domcontentloaded" | "networkidle" | "load"): Promise<string | null>;
}

/** Lazy, type-free playwright load — mirrors the existing pattern in best-effort.ts. */
async function loadPlaywright(): Promise<{ chromium: { launch: (o?: unknown) => Promise<unknown> } } | null> {
  const moduleName = "playwright";
  try {
    return (await import(/* webpackIgnore: true */ moduleName)) as never;
  } catch {
    return null;
  }
}

/** Default backend: headless Chromium via the optional playwright dep. */
class PlaywrightBackend implements CrawlBackend {
  async fetchRendered(
    url: string,
    waitUntil: "domcontentloaded" | "networkidle" | "load" = "networkidle",
  ): Promise<string | null> {
    const pw = await loadPlaywright();
    if (!pw) return null;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    let browser: any;
    try {
      browser = await (pw.chromium as any).launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil, timeout: 30_000 });
      return (await page.content()) as string;
    } catch {
      return null;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

/** Singleton backend instance — replaced in tests or when switching providers. */
let _backend: CrawlBackend = new PlaywrightBackend();

export function getCrawlBackend(): CrawlBackend {
  return _backend;
}

/** Override the active backend (for tests or alternative providers). */
export function setCrawlBackend(b: CrawlBackend): void {
  _backend = b;
}
