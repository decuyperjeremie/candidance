/** Text-normalisation helpers shared across dedup / filter / score. */

/** Lowercase + strip accents (NFD) for accent/case-insensitive matching. */
export function deaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Collapse whitespace to single spaces and trim. */
export function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Normalise a free string for comparison: deaccented, ws-collapsed, trimmed. */
export function norm(s?: string): string {
  return s ? collapseWs(deaccent(s)) : "";
}

/** True if the normalised haystack contains the normalised needle. */
export function containsNorm(haystack: string, needle: string): boolean {
  return norm(haystack).includes(norm(needle));
}

/** True if `term` appears as a whole word in `haystack` (e.g. "RP"). */
export function containsWord(haystack: string, term: string): boolean {
  const t = norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!t) return false;
  return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(norm(haystack));
}
