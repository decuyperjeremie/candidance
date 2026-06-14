/**
 * Run the enabled connectors concurrently and collect their offers. A failing
 * connector is isolated (Promise.allSettled) and recorded — it never prevents
 * aggregation of the others (see specs/offer-aggregation).
 */

import { getEnabledJobSources } from "@/lib/sources/registry";
import type { JobSourceName } from "@/lib/config";
import { JobSourceError, type RawOffer, type SearchCriteria } from "@/lib/sources/types";

/** Per-connector outcome for the run summary. */
export type SourceOutcome =
  | { source: JobSourceName; ok: true; count: number }
  | { source: JobSourceName; ok: false; error: string };

export type AggregateResult = {
  offers: RawOffer[];
  outcomes: SourceOutcome[];
};

/** Fetch from every enabled connector; collect offers + per-source outcomes. */
export async function aggregateOffers(
  criteria: SearchCriteria,
): Promise<AggregateResult> {
  const sources = getEnabledJobSources();

  const settled = await Promise.allSettled(
    sources.map(async (s) => ({ name: s.name, offers: await s.fetchOffers(criteria) })),
  );

  const offers: RawOffer[] = [];
  const outcomes: SourceOutcome[] = [];

  settled.forEach((result, i) => {
    const name = sources[i].name;
    if (result.status === "fulfilled") {
      offers.push(...result.value.offers);
      outcomes.push({ source: name, ok: true, count: result.value.offers.length });
    } else {
      const reason = result.reason;
      const msg =
        reason instanceof JobSourceError || reason instanceof Error
          ? reason.message
          : String(reason);
      outcomes.push({ source: name, ok: false, error: msg });
    }
  });

  return { offers, outcomes };
}
