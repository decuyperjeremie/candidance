/**
 * Communication keyword set (locked with the user — see design.md).
 *
 * Used two ways:
 *  - inclusion gate: an offer must match at least one term to be kept;
 *  - source-side query: fed to France Travail `motsCles` to pre-filter.
 *
 * Slash-variants are expanded into concrete forms here. "RP" is matched as a
 * whole word elsewhere to avoid false positives (see text.containsWord).
 */

/** Multi-word / substring terms matched with containsNorm. */
export const COMMUNICATION_TERMS = [
  "communication",
  "relations presse",
  "communication de crise",
  "communication corporate",
  "communication institutionnelle",
  "charge de communication",
  "chargee de communication",
  "responsable de communication",
  "responsable communication",
  "directeur de communication",
  "directrice de communication",
] as const;

/** Whole-word acronyms (matched with containsWord). */
export const COMMUNICATION_ACRONYMS = ["RP"] as const;

/**
 * Source-side query keywords (France Travail `motsCles`). Each is queried
 * SEPARATELY (commas = AND on FT), so keep this to high-recall, distinct terms:
 * "communication" already covers "... de crise / corporate / institutionnelle"
 * and the "chargé/responsable/directeur de communication" titles; "relations
 * presse" catches press roles that don't spell out "communication". The full
 * COMMUNICATION_TERMS set still gates precision downstream.
 */
export const DEFAULT_QUERY_KEYWORDS = [
  "communication",
  "relations presse",
] as const;
