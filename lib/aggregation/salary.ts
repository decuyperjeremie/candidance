/**
 * Parse a France-Travail salary label into a comparable **annual** euro figure,
 * used only for sorting offers by pay. Returns null when no amount is readable.
 *
 * The connector emits labels like:
 *   "Mensuel de 2300.0 Euros à 2302.0 Euros sur 12.0 mois" → 27624  (2302 × 12)
 *   "Annuel de 45000.0 Euros à 48000.0 Euros"              → 48000
 *   "Mensuel de 2000.0 Euros sur 12 mois"                  → 24000
 *   "Annuel de 0.0 Euros"                                  → 0
 *
 * When a range is given we keep the upper bound; the raw label stays visible in
 * the UI, so this is purely an ordering heuristic, not a displayed value.
 */
export function parseSalaryAmount(salary?: string): number | null {
  if (!salary) return null;

  // Amounts are the numbers immediately preceding "Euro(s)" — this skips the
  // "sur 12 mois" count, which is never followed by "Euro".
  const amounts: number[] = [];
  const re = /([\d][\d\s.,]*)\s*Euro/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(salary)) !== null) {
    const n = Number(m[1].replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) amounts.push(n);
  }
  if (amounts.length === 0) return null;

  const top = Math.max(...amounts);
  if (!/mensuel/i.test(salary)) return Math.round(top); // assume annual otherwise

  const monthsMatch = salary.match(/sur\s*([\d.,]+)\s*mois/i);
  const months = monthsMatch ? Number(monthsMatch[1].replace(",", ".")) : 12;
  return Math.round(top * (Number.isFinite(months) && months > 0 ? months : 12));
}
