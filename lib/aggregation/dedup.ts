/**
 * Inter-source de-duplication.
 *
 * The same job syndicated to several boards collapses into one entry. The key
 * is a normalised fuzzy composite of company + title + city. When the company
 * is absent (anonymised postings), it falls back to title + city — a documented
 * limitation acceptable for the prototype (see design.md).
 */

import type { RawOffer } from "@/lib/sources/types";
import { norm } from "./text";

/** One source's contribution to a de-duplicated offer. */
export type OfferProvenance = {
  source: RawOffer["source"];
  sourceLocalId: string;
  url?: string;
};

/** A de-duplicated offer: merged fields + every source that surfaced it. */
export type AggregatedOffer = {
  dedupKey: string;
  title: string;
  company?: string;
  location?: string;
  departmentCode?: string;
  contractType?: string;
  description?: string;
  salary?: string;
  sector?: string;
  postedAt?: string;
  sources: OfferProvenance[];
};

/** Keep the city-ish head of a location ("75 - PARIS 02" -> "paris 02"). */
function cityKey(location?: string): string {
  if (!location) return "";
  // Drop a leading "NN - " department prefix, then normalise.
  return norm(location.replace(/^\s*\d{2,5}\s*-\s*/, ""));
}

/** Common French legal forms / corporate suffixes to ignore when matching. */
const LEGAL_FORMS = new Set([
  "sas", "sasu", "sa", "sarl", "eurl", "sci", "scop", "snc", "gie", "se",
  "group", "groupe", "holding", "france", "inc", "ltd", "llc", "gmbh", "ag",
]);

/** Normalise a company name: deaccent + drop legal-form tokens ("Acme SAS" ~ "ACME"). */
function companyKey(company?: string): string {
  if (!company) return "";
  return norm(company)
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !LEGAL_FORMS.has(t))
    .join(" ");
}

/** Normalise a job title: deaccent + drop gender markers ("Chargé (H/F)" ~ "charge"). */
function titleKey(title: string): string {
  return norm(title)
    .replace(/\(?\b[hf]\s*[\/]\s*[hf]\b\)?/g, " ") // (h/f), f/h, m/f-ish
    .replace(/\s+/g, " ")
    .trim();
}

/** Compute the fuzzy dedup key for an offer. */
export function dedupKeyOf(offer: RawOffer): string {
  const title = titleKey(offer.title);
  const city = cityKey(offer.location);
  const company = companyKey(offer.company);
  return company ? `${company}|${title}|${city}` : `${title}|${city}`;
}

/** Group raw offers from all sources into de-duplicated entries. */
export function dedupeOffers(raw: RawOffer[]): {
  offers: AggregatedOffer[];
  duplicatesMerged: number;
} {
  const byKey = new Map<string, AggregatedOffer>();
  let duplicatesMerged = 0;

  for (const o of raw) {
    if (!o.sourceLocalId) continue; // can't track provenance without an id
    const key = dedupKeyOf(o);
    const existing = byKey.get(key);
    const prov: OfferProvenance = {
      source: o.source,
      sourceLocalId: o.sourceLocalId,
      url: o.url,
    };

    if (!existing) {
      byKey.set(key, {
        dedupKey: key,
        title: o.title,
        company: o.company,
        location: o.location,
        departmentCode: o.departmentCode,
        contractType: o.contractType,
        description: o.description,
        salary: o.salary,
        sector: o.sector,
        postedAt: o.postedAt,
        sources: [prov],
      });
      continue;
    }

    // Same job from another (or the same) source: merge provenance + backfill.
    const dup = existing.sources.some(
      (s) => s.source === prov.source && s.sourceLocalId === prov.sourceLocalId,
    );
    if (!dup) {
      existing.sources.push(prov);
      duplicatesMerged += 1;
    }
    existing.company ??= o.company;
    existing.location ??= o.location;
    existing.departmentCode ??= o.departmentCode;
    existing.contractType ??= o.contractType;
    existing.description ??= o.description;
    existing.salary ??= o.salary;
    existing.sector ??= o.sector;
    existing.postedAt ??= o.postedAt;
  }

  return { offers: [...byKey.values()], duplicatesMerged };
}
