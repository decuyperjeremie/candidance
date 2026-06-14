/**
 * The pluggable job-source bridge (mirrors lib/llm's provider bridge).
 *
 * Aggregation/discovery code depends ONLY on these types — never on a specific
 * site's transport (HTTP API, HTML scrape, headless browser). One connector per
 * site implements `JobSource`; a registry (see ./registry) maps name -> factory.
 */

import type { JobSourceName } from "@/lib/config";

/** Île-de-France department codes — the only zone this prototype targets. */
export const IDF_DEPARTMENTS = [
  "75",
  "77",
  "78",
  "91",
  "92",
  "93",
  "94",
  "95",
] as const;
export type IdfDepartment = (typeof IDF_DEPARTMENTS)[number];

/** Search criteria handed to every connector. */
export type SearchCriteria = {
  /** Communication keywords (inclusion + source-side query). */
  keywords: string[];
  /** Department codes to restrict to (defaults to all of IDF). */
  departments: string[];
};

/**
 * A connector's normalised offer. Built defensively — fields with no source
 * data stay absent (never fabricated), per the no-invention rule.
 */
export type RawOffer = {
  /** Connector that produced this offer. */
  source: JobSourceName;
  /** The offer's id within that source (for in-source dedup + provenance). */
  sourceLocalId: string;
  title: string;
  company?: string;
  location?: string;
  /** IDF department code parsed from the location, when determinable. */
  departmentCode?: string;
  /** Original posting URL on the source site. */
  url?: string;
  description?: string;
  contractType?: string;
  /** Human-readable pay string from the source, when available (never invented). */
  salary?: string;
  /** Source activity/NAF code (e.g. France Travail `secteurActivite`). */
  sector?: string;
  /** Source-provided posting date (kept as the source's string). */
  postedAt?: string;
  /** Source-specific code (e.g. France Travail ROME), kept for debugging. */
  romeCode?: string;
};

/** The connector interface. */
export interface JobSource {
  readonly name: JobSourceName;
  readonly reliability: "high" | "medium" | "best-effort";
  /** Fetch and normalise offers for the given criteria. */
  fetchOffers(criteria: SearchCriteria): Promise<RawOffer[]>;
}

/** Raised for any connector problem; carries the connector name for reporting. */
export class JobSourceError extends Error {
  constructor(
    public readonly source: JobSourceName,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "JobSourceError";
  }
}
