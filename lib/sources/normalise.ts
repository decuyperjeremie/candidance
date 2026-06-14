/**
 * Shared helpers to build a `RawOffer` defensively from partial source data.
 * Missing fields stay absent — nothing is invented.
 */

import { IDF_DEPARTMENTS } from "./types";

/** Trim to a non-empty string, or undefined. Never returns "". */
export function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length ? t : undefined;
}

/**
 * Extract an IDF department code from a free-text location or postal/INSEE
 * code (e.g. "75 - PARIS 02", "92100", "Boulogne 92"). Returns undefined when
 * no IDF department can be determined — callers must not guess.
 */
export function departmentFromLocation(
  location?: string,
): string | undefined {
  if (!location) return undefined;
  // First 2 digits of any 5-digit postal/INSEE code, or a standalone 2-digit code.
  const five = location.match(/\b(\d{5})\b/);
  if (five) {
    const dep = five[1].slice(0, 2);
    if ((IDF_DEPARTMENTS as readonly string[]).includes(dep)) return dep;
  }
  const two = location.match(/\b(\d{2})\b/);
  if (two && (IDF_DEPARTMENTS as readonly string[]).includes(two[1])) {
    return two[1];
  }
  return undefined;
}
