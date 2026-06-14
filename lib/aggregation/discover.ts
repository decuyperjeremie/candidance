/**
 * On-demand discovery pass (the Slice 2 deliverable).
 *
 * Pipeline: load profile -> run enabled connectors -> filter (communication +
 * IDF) -> de-duplicate inter-source -> score vs the communication profile ->
 * persist -> return the ranked list + a run summary. Shared by the CLI
 * (scripts/discover.ts) and the API route (app/api/discover).
 */

import { loadCandidateProfile } from "@/lib/profile";
import { IDF_DEPARTMENTS, type SearchCriteria } from "@/lib/sources/types";
import { aggregateOffers, type SourceOutcome } from "./aggregate";
import { dedupeOffers } from "./dedup";
import { filterOffers } from "./filter";
import { DEFAULT_QUERY_KEYWORDS } from "./keywords";
import { buildCommunicationTerms, scoreOffer } from "./score";
import { listOffers, persistOffers, recordCrawlRun, type ScoredOffer, type StoredOffer } from "./store";

export type DiscoverOptions = {
  /** Source-side query keywords (France Travail motsCles). Defaults to comm set. */
  keywords?: string[];
  /** Department codes; defaults to all of Île-de-France. */
  departments?: string[];
  /** Max offers returned in the ranked list. */
  limit?: number;
};

export type DiscoverSummary = {
  criteria: SearchCriteria;
  perSource: SourceOutcome[];
  fetched: number;
  afterFilter: number;
  duplicatesMerged: number;
  totalStored: number;
};

export type DiscoverResult = {
  summary: DiscoverSummary;
  offers: StoredOffer[];
};

export async function runDiscovery(opts: DiscoverOptions = {}): Promise<DiscoverResult> {
  const criteria: SearchCriteria = {
    keywords: opts.keywords?.length ? opts.keywords : [...DEFAULT_QUERY_KEYWORDS],
    departments: opts.departments?.length ? opts.departments : [...IDF_DEPARTMENTS],
  };

  // 1. fetch from enabled connectors (failures isolated).
  const { offers: raw, outcomes } = await aggregateOffers(criteria);

  // 2. communication + zone gate.
  const kept = filterOffers(raw);

  // 3. de-duplicate inter-source.
  const { offers: deduped, duplicatesMerged } = dedupeOffers(kept);

  // 4. score vs the communication facet of the profile.
  const terms = buildCommunicationTerms(await loadCandidateProfile());
  const scored: ScoredOffer[] = deduped.map((o) => {
    const { score, rationale } = scoreOffer(o, terms);
    return { ...o, score, scoreRationale: rationale };
  });

  // 5. persist (upsert — no duplicates on re-run).
  const totalStored = persistOffers(scored);

  const summary: DiscoverSummary = {
    criteria,
    perSource: outcomes,
    fetched: raw.length,
    afterFilter: kept.length,
    duplicatesMerged,
    totalStored,
  };
  recordCrawlRun({
    criteria,
    perSource: outcomes,
    duplicatesMerged,
    totalStored,
  });

  // 6. return the ranked list from storage.
  return { summary, offers: listOffers(opts.limit ?? 100) };
}
