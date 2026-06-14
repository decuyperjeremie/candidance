/**
 * Persistence for generated applications (migration 0004). One row per offer
 * (upsert on offer_id). Files are re-rendered on demand from the stored content.
 */

import { getDb } from "@/lib/db";
import { ApplicationContent } from "./content";

export type StoredApplication = {
  offerId: number;
  content: ApplicationContent;
  provider?: string;
  model?: string;
  updatedAt: string;
};

/** Upsert the generated application for an offer. */
export function saveApplication(input: {
  offerId: number;
  content: ApplicationContent;
  provider?: string;
  model?: string;
}): void {
  getDb()
    .prepare(`
      INSERT INTO applications (offer_id, cv_json, letter_text, provider, model, updated_at)
      VALUES (@offerId, @cvJson, @letterText, @provider, @model, datetime('now'))
      ON CONFLICT(offer_id) DO UPDATE SET
        cv_json     = excluded.cv_json,
        letter_text = excluded.letter_text,
        provider    = excluded.provider,
        model       = excluded.model,
        updated_at  = datetime('now')
    `)
    .run({
      offerId: input.offerId,
      cvJson: JSON.stringify(input.content.cv),
      letterText: JSON.stringify(input.content.letter),
      provider: input.provider ?? null,
      model: input.model ?? null,
    });
}

/** Load a stored application by offer id, or undefined if none. */
export function getApplication(offerId: number): StoredApplication | undefined {
  const row = getDb()
    .prepare(
      "SELECT offer_id, cv_json, letter_text, provider, model, updated_at FROM applications WHERE offer_id = ?",
    )
    .get(offerId) as Record<string, unknown> | undefined;
  if (!row) return undefined;

  const content = ApplicationContent.parse({
    cv: JSON.parse(row.cv_json as string),
    letter: JSON.parse(row.letter_text as string),
  });
  return {
    offerId: row.offer_id as number,
    content,
    provider: (row.provider as string) ?? undefined,
    model: (row.model as string) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}
