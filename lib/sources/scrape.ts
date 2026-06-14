/**
 * Shared HTML-scraping helpers for the cheerio-based connectors (APEC, WTTJ).
 *
 * Scraping is inherently fragile: these connectors are opt-in and non-blocking
 * (see specs/job-sources). When markup changes, a connector should yield [] or
 * throw a JobSourceError — both are isolated by aggregation, never fatal.
 */

import * as cheerio from "cheerio";
import { JobSourceError } from "./types";
import type { JobSourceName } from "@/lib/config";

/** Browser-like UA so public pages don't immediately serve a bot wall. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 15_000;

/** Fetch a URL and return a loaded cheerio document, or throw JobSourceError. */
export async function fetchHtml(
  source: JobSourceName,
  url: string,
): Promise<cheerio.CheerioAPI> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new JobSourceError(source, `${url} -> HTTP ${res.status}`);
    }
    return cheerio.load(await res.text());
  } catch (err) {
    if (err instanceof JobSourceError) throw err;
    throw new JobSourceError(source, `Fetch failed for ${url}`, err);
  } finally {
    clearTimeout(timer);
  }
}

/** Read the Next.js `__NEXT_DATA__` JSON blob, if a page embeds one. */
export function readNextData($: cheerio.CheerioAPI): unknown | undefined {
  const raw = $("#__NEXT_DATA__").first().contents().text();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
