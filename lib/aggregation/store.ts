/**
 * SQLite persistence for de-duplicated, scored offers (migration 0002).
 *
 * - Offers upsert by `dedup_key`: a re-run updates last_seen_at + fields rather
 *   than creating duplicates.
 * - Provenance rows upsert by (source, source_local_id).
 * - Each pass writes a `crawl_runs` summary row.
 */

import { getDb } from "@/lib/db";
import type { OfferContact } from "@/lib/sources/types";
import type { AggregatedOffer } from "./dedup";

/** A de-duplicated offer enriched with its relevance score. */
export type ScoredOffer = AggregatedOffer & {
  score: number;
  scoreRationale: string;
};

/** An offer as read back from the DB, with its sources. */
export type StoredOffer = {
  id: number;
  title: string;
  company?: string;
  location?: string;
  departmentCode?: string;
  contractType?: string;
  description?: string;
  salary?: string;
  sector?: string;
  postedAt?: string;
  score: number;
  scoreRationale?: string;
  contact?: OfferContact;
  sources: { source: string; url?: string }[];
};

/** Upsert all offers + provenance in one transaction. Returns count stored. */
export function persistOffers(offers: ScoredOffer[]): number {
  const db = getDb();

  const upsertOffer = db.prepare(`
    INSERT INTO offers
      (dedup_key, title, company, location, department_code, contract_type,
       description, salary, sector, posted_at, score, score_rationale,
       contact_method, contact_email, contact_url, contact_name, last_seen_at)
    VALUES
      (@dedupKey, @title, @company, @location, @departmentCode, @contractType,
       @description, @salary, @sector, @postedAt, @score, @scoreRationale,
       @contactMethod, @contactEmail, @contactUrl, @contactName, datetime('now'))
    ON CONFLICT(dedup_key) DO UPDATE SET
      title           = excluded.title,
      company         = COALESCE(excluded.company, offers.company),
      location        = COALESCE(excluded.location, offers.location),
      department_code = COALESCE(excluded.department_code, offers.department_code),
      contract_type   = COALESCE(excluded.contract_type, offers.contract_type),
      description     = COALESCE(excluded.description, offers.description),
      salary          = COALESCE(excluded.salary, offers.salary),
      sector          = COALESCE(excluded.sector, offers.sector),
      posted_at       = COALESCE(excluded.posted_at, offers.posted_at),
      score           = excluded.score,
      score_rationale = excluded.score_rationale,
      contact_method  = COALESCE(excluded.contact_method, offers.contact_method),
      contact_email   = COALESCE(excluded.contact_email, offers.contact_email),
      contact_url     = COALESCE(excluded.contact_url, offers.contact_url),
      contact_name    = COALESCE(excluded.contact_name, offers.contact_name),
      last_seen_at    = datetime('now')
    RETURNING id
  `);

  const upsertSource = db.prepare(`
    INSERT INTO offer_sources (offer_id, source, source_local_id, url, seen_at)
    VALUES (@offerId, @source, @sourceLocalId, @url, datetime('now'))
    ON CONFLICT(source, source_local_id) DO UPDATE SET
      offer_id = excluded.offer_id,
      url      = COALESCE(excluded.url, offer_sources.url),
      seen_at  = datetime('now')
  `);

  const tx = db.transaction((batch: ScoredOffer[]) => {
    for (const o of batch) {
      const row = upsertOffer.get({
        dedupKey: o.dedupKey,
        title: o.title,
        company: o.company ?? null,
        location: o.location ?? null,
        departmentCode: o.departmentCode ?? null,
        contractType: o.contractType ?? null,
        description: o.description ?? null,
        salary: o.salary ?? null,
        sector: o.sector ?? null,
        postedAt: o.postedAt ?? null,
        score: o.score,
        scoreRationale: o.scoreRationale,
        contactMethod: o.contact?.method ?? null,
        contactEmail: o.contact?.email ?? null,
        contactUrl: o.contact?.applyUrl ?? null,
        contactName: o.contact?.contactName ?? null,
      }) as { id: number };

      for (const s of o.sources) {
        upsertSource.run({
          offerId: row.id,
          source: s.source,
          sourceLocalId: s.sourceLocalId,
          url: s.url ?? null,
        });
      }
    }
    return batch.length;
  });

  return tx(offers);
}

/** Write one crawl-run summary row. */
export function recordCrawlRun(summary: {
  criteria: unknown;
  perSource: unknown;
  duplicatesMerged: number;
  totalStored: number;
}): void {
  getDb()
    .prepare(`
      INSERT INTO crawl_runs
        (finished_at, criteria, per_source, duplicates_merged, total_stored)
      VALUES (datetime('now'), @criteria, @perSource, @duplicatesMerged, @totalStored)
    `)
    .run({
      criteria: JSON.stringify(summary.criteria),
      perSource: JSON.stringify(summary.perSource),
      duplicatesMerged: summary.duplicatesMerged,
      totalStored: summary.totalStored,
    });
}

const OFFER_COLUMNS = `id, title, company, location, department_code, contract_type,
             description, salary, sector, posted_at, score, score_rationale,
             contact_method, contact_email, contact_url, contact_name`;

function mapOfferRow(r: Record<string, unknown>): StoredOffer {
  const sourcesFor = getDb().prepare(
    "SELECT source, url FROM offer_sources WHERE offer_id = ?",
  );
  const contactMethod = r.contact_method as string | null;
  const contact: OfferContact | undefined = contactMethod
    ? {
        method: contactMethod as OfferContact["method"],
        email: (r.contact_email as string) ?? undefined,
        applyUrl: (r.contact_url as string) ?? undefined,
        contactName: (r.contact_name as string) ?? undefined,
      }
    : undefined;
  return {
    id: r.id as number,
    title: r.title as string,
    company: (r.company as string) ?? undefined,
    location: (r.location as string) ?? undefined,
    departmentCode: (r.department_code as string) ?? undefined,
    contractType: (r.contract_type as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    salary: (r.salary as string) ?? undefined,
    sector: (r.sector as string) ?? undefined,
    postedAt: (r.posted_at as string) ?? undefined,
    score: r.score as number,
    scoreRationale: (r.score_rationale as string) ?? undefined,
    contact,
    sources: sourcesFor.all(r.id) as { source: string; url?: string }[],
  };
}

/** Read stored offers ranked by descending relevance score. */
export function listOffers(limit = 100): StoredOffer[] {
  const rows = getDb()
    .prepare(
      `SELECT ${OFFER_COLUMNS} FROM offers ORDER BY score DESC, last_seen_at DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapOfferRow);
}

/** Load a single stored offer by id, or undefined if absent. */
export function getOffer(id: number): StoredOffer | undefined {
  const row = getDb()
    .prepare(`SELECT ${OFFER_COLUMNS} FROM offers WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapOfferRow(row) : undefined;
}
