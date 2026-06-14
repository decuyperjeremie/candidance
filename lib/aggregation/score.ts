/**
 * Deterministic relevance scoring (0–100) vs the communication facet of the
 * CandidateProfile. No LLM — so scoring works even when no provider is
 * reachable (spec requirement) and a crawl of hundreds of offers stays cheap.
 *
 * Approach: derive a set of communication terms from the locked keyword set +
 * Tatiana's communication specialisations (crisis comm, press relations,
 * corporate/institutional, events) + her highlighted profile skills, then count
 * matches in the offer, weighting title hits above description hits.
 */

import type { CandidateProfile } from "@/lib/profile";
import { COMMUNICATION_TERMS } from "./keywords";
import { containsNorm, norm } from "./text";

/** Tatiana's communication specialisations (from FONDATIONS / profile). */
const SPECIALISATIONS = [
  "communication de crise",
  "relations presse",
  "communication corporate",
  "communication institutionnelle",
  "relations publiques",
  "evenementiel",
  "rebranding",
  "porte-parole",
  "media",
  "presse",
  "strategie de communication",
  "communication interne",
  "communication externe",
] as const;

const TITLE_WEIGHT = 22;
const DESC_WEIGHT = 8;
const MAX_SCORE = 100;

export type ScoreResult = { score: number; rationale: string };

/** Build the deduplicated term list scored against, drawn from the profile. */
export function buildCommunicationTerms(profile: CandidateProfile): string[] {
  const terms = new Set<string>();
  for (const t of COMMUNICATION_TERMS) terms.add(norm(t));
  for (const t of SPECIALISATIONS) terms.add(norm(t));
  // Highlighted profile skills that are communication-flavoured.
  for (const s of profile.skills) {
    if (!s.highlighted) continue;
    const n = norm(s.name);
    if (n.includes("communication") || n.includes("presse") || n.includes("media") || n.includes("relation")) {
      terms.add(n);
    }
  }
  return [...terms].filter(Boolean);
}

/** Score one offer; returns 0–100 plus a short rationale naming matches. */
export function scoreOffer(
  offer: { title: string; description?: string },
  terms: string[],
): ScoreResult {
  const title = offer.title ?? "";
  const desc = offer.description ?? "";
  const matched: string[] = [];
  let raw = 0;

  for (const term of terms) {
    const inTitle = containsNorm(title, term);
    const inDesc = containsNorm(desc, term);
    if (!inTitle && !inDesc) continue;
    raw += inTitle ? TITLE_WEIGHT : DESC_WEIGHT;
    matched.push(term);
  }

  const score = Math.min(MAX_SCORE, raw);
  const rationale =
    matched.length > 0
      ? `Communication — correspond à : ${matched.slice(0, 5).join(", ")}`
      : "Aucun terme communication détecté";
  return { score, rationale };
}
