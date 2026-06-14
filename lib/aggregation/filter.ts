/**
 * Filters for the communication crawl (Île-de-France). An offer is kept only if
 * it is an in-zone communication role that passes every exclusion below.
 *
 * Tatiana is a senior cadre, so we exclude (in order of confidence):
 *  - internships / work-study / apprenticeships (title OR description signals);
 *  - hospitality employers (restaurant / bar / café — via NAF sector + name);
 *  - graphic-design roles (the job itself, detected on the TITLE);
 *  - parental-leave replacements and short CDD/intérim (< 6 months).
 *
 * Precision is favoured over recall: matchers target signals that the OFFER
 * ITSELF is of the excluded kind, not mere mentions (e.g. a comm role that
 * "supervises graphic creation" or wants "internship experience" is kept).
 */

import type { RawOffer } from "@/lib/sources/types";
import { IDF_DEPARTMENTS } from "@/lib/sources/types";
import { COMMUNICATION_ACRONYMS, COMMUNICATION_TERMS } from "./keywords";
import { containsNorm, containsWord, norm } from "./text";

// --- inclusion: communication + zone ---------------------------------------

/** True if the offer's text matches at least one communication keyword. */
export function isCommunicationOffer(offer: Pick<RawOffer, "title" | "description">): boolean {
  const text = `${offer.title ?? ""} ${offer.description ?? ""}`;
  if (COMMUNICATION_TERMS.some((term) => containsNorm(text, term))) return true;
  return COMMUNICATION_ACRONYMS.some((acr) => containsWord(text, acr));
}

/**
 * True if the offer is in Île-de-France. Offers whose department can't be
 * determined are kept (France Travail already filters server-side by zone).
 */
export function isInZone(offer: Pick<RawOffer, "departmentCode">): boolean {
  if (!offer.departmentCode) return true;
  return (IDF_DEPARTMENTS as readonly string[]).includes(offer.departmentCode);
}

// --- exclusion: internships / work-study / apprenticeships -----------------

/** Title tokens that flag a junior contract outright. */
const JUNIOR_TITLE_WORDS = [
  "stage", "stagiaire", "alternance", "alternant", "alternante",
  "apprenti", "apprentie", "apprentissage", "professionnalisation",
] as const;

/**
 * High-precision description signals that the OFFER is a stage/alternance.
 * Applied to a normalised string where "·" and "/" become spaces so forms like
 * "un·e stagiaire" and "professionnalisation/alternance" match. Deliberately
 * avoids bare "stage"/"stagiaire" (would catch "Gentils Stagiaires", "une
 * expérience de stage est un plus", etc.).
 */
const JUNIOR_DESC_PATTERNS: RegExp[] = [
  /\ben alternance\b/,
  /\ben apprentissage\b/,
  /contrat d apprentissage\b/,
  /contrat de professionnalisation\b/,
  /\(\s*stage\s*\)/,
  /\bstage\s*[-:]/,
  /\b(recherch|recrut|propos)\w*\s+(un|une|un\s*e|notre)\s*stagiaire\b/,
  /\bun\s*e?\s+stagiaire\b/,
  /\bposte de stagiaire\b/,
  /\boffre de stage\b/,
];

/** True if the offer is an internship / work-study / apprenticeship role. */
export function isExcludedContract(
  offer: Pick<RawOffer, "title" | "contractType" | "description">,
): boolean {
  const head = `${offer.title ?? ""} ${offer.contractType ?? ""}`;
  if (JUNIOR_TITLE_WORDS.some((w) => containsWord(head, w))) return true;
  // "·" and "/" -> space so glued forms match.
  const desc = norm(offer.description).replace(/[·/]/g, " ").replace(/\s+/g, " ");
  return JUNIOR_DESC_PATTERNS.some((re) => re.test(desc));
}

// --- exclusion: hospitality (restaurant / bar / café) ----------------------

/** NAF divisions for hébergement (55) and restauration (56). */
const HOSPITALITY_NAF = ["55", "56"];
/** Employer-name tokens that identify a hospitality business. */
const HOSPITALITY_NAME_WORDS = [
  "restaurant", "restauration", "brasserie", "bar", "cafe", "traiteur", "bistrot",
] as const;

/** True if the employer is in hospitality (restaurant/bar/café). */
export function isHospitality(
  offer: Pick<RawOffer, "sector" | "company" | "description">,
): boolean {
  const sector = norm(offer.sector);
  if (HOSPITALITY_NAF.some((naf) => sector.startsWith(naf))) return true;
  // Company name is short -> low false-positive risk (whole-word match).
  if (HOSPITALITY_NAME_WORDS.some((w) => containsWord(offer.company ?? "", w))) return true;
  // Fallback when the source gives no NAF/company: a self-description naming
  // several hospitality activities (e.g. "un café, un bar, un restaurant").
  // Requiring >= 2 DISTINCT terms keeps this precise (verified: 0 collateral).
  const distinct = HOSPITALITY_NAME_WORDS.filter((w) =>
    containsWord(offer.description ?? "", w),
  ).length;
  return distinct >= 2;
}

// --- exclusion: graphic-design roles (title only) --------------------------

const GRAPHIC_TITLE_TERMS = [
  "graphiste", "infographiste", "directeur artistique", "directrice artistique",
  "direction artistique", "designer graphique", "design graphique",
  "creation graphique", "motion designer", "motion design", "illustrateur",
  "illustratrice", "ui designer", "ux designer", "webdesigner", "web designer",
] as const;

/** True if the role itself is graphic design (detected on the title). */
export function isGraphicDesignRole(offer: Pick<RawOffer, "title">): boolean {
  return GRAPHIC_TITLE_TERMS.some((t) => containsNorm(offer.title ?? "", t));
}

// --- exclusion: parental-leave replacement / short CDD ---------------------

const SHORT_CDD_TYPES = new Set(["cdd", "mis"]);

/** Smallest contract duration (months) stated near a contract context, if any. */
function shortestContractMonths(text: string): number | undefined {
  const n = norm(text);
  const months: number[] = [];
  const ctx = /(cdd|contrat|mission|duree|pour|remplacement)\D{0,15}(\d{1,2})\s*mois/g;
  const ctxAfter = /(\d{1,2})\s*mois\D{0,15}(renouvelable|de remplacement|de mission)/g;
  for (const m of n.matchAll(ctx)) months.push(Number(m[2]));
  for (const m of n.matchAll(ctxAfter)) months.push(Number(m[1]));
  return months.length ? Math.min(...months) : undefined;
}

/**
 * True for parental-leave covers (always) and short CDD/intérim (< 6 months).
 * Permanent roles that merely mention "remplacement" are not excluded.
 */
export function isShortOrReplacementCdd(
  offer: Pick<RawOffer, "title" | "contractType" | "description">,
): boolean {
  const text = `${offer.title ?? ""} ${offer.description ?? ""}`;
  const n = norm(text);
  if (/conge (parental|maternite|de maternite)/.test(n)) return true;

  const type = norm(offer.contractType);
  if (!SHORT_CDD_TYPES.has(type)) return false;
  const months = shortestContractMonths(text);
  return months !== undefined && months < 6;
}

// --- combined ---------------------------------------------------------------

/** Keep only relevant, in-zone communication offers (all exclusions applied). */
export function filterOffers(raw: RawOffer[]): RawOffer[] {
  return raw.filter(
    (o) =>
      isInZone(o) &&
      isCommunicationOffer(o) &&
      !isExcludedContract(o) &&
      !isHospitality(o) &&
      !isGraphicDesignRole(o) &&
      !isShortOrReplacementCdd(o),
  );
}
