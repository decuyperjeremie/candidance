/**
 * Generation core (the Slice 3 deliverable), shared by the CLI and the API.
 *
 * Pipeline: load offer (error if absent) + profile -> LLM adapt -> zero-
 * fabrication verify -> persist -> return content + a summary. Files are
 * rendered separately (on download) from the persisted content.
 */

import { getOffer } from "@/lib/aggregation/store";
import { loadCandidateProfile } from "@/lib/profile";
import { adaptApplication, GenerationError } from "./adapt";
import type { ApplicationContent } from "./content";
import { saveApplication } from "./store";
import { verifyAgainstProfile, normalizeProse, type VerificationReport } from "./verify";
import { APPLICATION_FILES } from "@/lib/render";

export { GenerationError };

export type GenerateSummary = {
  offerId: number;
  offerTitle: string;
  company?: string;
  provider: string;
  model: string;
  verification: VerificationReport;
  files: string[];
};

export type GenerateResult = {
  content: ApplicationContent;
  summary: GenerateSummary;
};

/** Generate (and persist) an adapted, verified application for an offer. */
export async function generateApplication(offerId: number): Promise<GenerateResult> {
  const offer = getOffer(offerId);
  if (!offer) {
    throw new GenerationError(`Offre #${offerId} introuvable. Lance d'abord une découverte (npm run discover).`);
  }

  const profile = await loadCandidateProfile();
  const { content: raw, provider, model } = await adaptApplication(profile, offer);
  const { content: verified, report } = verifyAgainstProfile(raw, profile);
  const { content, dashesRemoved } = normalizeProse(verified);
  if (dashesRemoved) {
    report.flags.push("Tirets longs (—) remplacés par des tirets courts (règle de style).");
  }

  saveApplication({ offerId, content, provider, model });

  return {
    content,
    summary: {
      offerId,
      offerTitle: offer.title,
      company: offer.company,
      provider,
      model,
      verification: report,
      files: [...APPLICATION_FILES],
    },
  };
}
