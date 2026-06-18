/**
 * Salary parsing for offers. Source labels are free text — France Travail emits
 * shapes like "Mensuel de 2300.0 Euros à 2302.0 Euros sur 12.0 mois", while
 * crawled descriptions may say "2 500 € brut / mois soit 1 950 € net".
 *
 * parseSalary() turns that into a structured {@link SalaryInfo}: a gross (brut)
 * and/or net figure when the text distinguishes them, or a single generic
 * amount otherwise. Each figure carries a clean display label and an annualised
 * value used only for sorting. The raw label is preserved for transparency.
 */

type Period = "mois" | "an" | "h" | "unknown";

/** One extracted pay figure: a human label plus an annualised amount for sorting. */
export type SalaryFigure = {
  /** Display string, e.g. "2 300 € / mois" or "45 000–48 000 € / an". */
  label: string;
  /** Annualised upper bound, for ranking offers by pay. */
  annual: number;
};

/** Structured result of reading a salary label. */
export type SalaryInfo = {
  /** The original, untouched label. */
  raw: string;
  /** Gross figure, when the text marks an amount as "brut". */
  brut?: SalaryFigure;
  /** Net figure, when the text marks an amount as "net". */
  net?: SalaryFigure;
  /** Single amount/range when no brut/net distinction is found. */
  montant?: SalaryFigure;
  /** Best annualised value for sorting (brut → net → montant), or null. */
  annual: number | null;
};

/** Parse a salary label into a structured breakdown, or null when empty. */
export function parseSalary(salary?: string): SalaryInfo | null {
  if (!salary || !salary.trim()) return null;
  const raw = salary;
  const period = detectPeriod(raw);
  const months = detectMonths(raw);

  const lower = raw.toLowerCase();
  const brutVals: number[] = [];
  const netVals: number[] = [];
  const plainVals: number[] = [];

  const re = /(\d[\d  .,]*?)\s*(k)?\s*(?:€|euros?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const value = toNumber(m[1], Boolean(m[2]));
    if (value == null) continue;
    const qual = nearestQualifier(lower, m.index);
    if (qual === "brut") brutVals.push(value);
    else if (qual === "net") netVals.push(value);
    else plainVals.push(value);
  }

  const brut = makeFigure(brutVals, period, months);
  const net = makeFigure(netVals, period, months);
  // A generic amount only when the text never said brut/net.
  const montant = brut || net ? undefined : makeFigure(plainVals, period, months);

  const annual = brut?.annual ?? net?.annual ?? montant?.annual ?? null;
  return { raw, brut, net, montant, annual };
}

/** True when a parsed result yielded at least one displayable figure. */
export function hasSalaryFigures(info: SalaryInfo | null): boolean {
  return Boolean(info && (info.brut || info.net || info.montant));
}

/**
 * True when a raw label is worth showing even though no amount was extracted —
 * pure text like "Selon profil", but not a "0 Euros" placeholder.
 */
export function rawSalaryIsMeaningful(raw?: string): boolean {
  if (!raw || !raw.trim()) return false;
  if (/\d/.test(raw)) return /[1-9]/.test(raw); // has digits → needs a non-zero one
  return true; // no digits at all → descriptive text
}

/** Plain-text recap of the extracted figures, for the detail page. */
export function salaryExtractionSummary(info: SalaryInfo | null): string | null {
  if (!info) return null;
  const parts: string[] = [];
  if (info.brut) parts.push(`brut ${info.brut.label}`);
  if (info.net) parts.push(`net ${info.net.label}`);
  if (info.montant && !info.brut && !info.net) parts.push(info.montant.label);
  return parts.length ? parts.join(" · ") : null;
}

// --- internals ---------------------------------------------------------------

function detectPeriod(raw: string): Period {
  if (/mensuel|\/\s*mois|par\s+mois/i.test(raw)) return "mois";
  if (/annuel|\/\s*an\b|par\s+an/i.test(raw)) return "an";
  if (/horaire|\/\s*h\b|de\s+l['’]heure|par\s+heure/i.test(raw)) return "h";
  return "unknown";
}

function detectMonths(raw: string): number {
  const mm = raw.match(/sur\s*([\d.,]+)\s*mois/i);
  const n = mm ? Number(mm[1].replace(",", ".")) : 12;
  return Number.isFinite(n) && n > 0 ? n : 12;
}

/** Closest "brut"/"net" word to a position, within a small window (else null). */
function nearestQualifier(lower: string, pos: number): "brut" | "net" | null {
  const brut = nearestDistance(lower, /\bbruts?\b/g, pos);
  const net = nearestDistance(lower, /\bnets?\b/g, pos);
  if (brut == null && net == null) return null;
  if (net == null) return "brut";
  if (brut == null) return "net";
  return net < brut ? "net" : "brut";
}

function nearestDistance(haystack: string, re: RegExp, pos: number, max = 30): number | null {
  re.lastIndex = 0;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) {
    const d = Math.abs(m.index - pos);
    if (d <= max && (best == null || d < best)) best = d;
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
  }
  return best;
}

function toNumber(text: string, k: boolean): number | null {
  let s = text.replace(/[\s ]/g, "");
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, ""); // commas are thousands separators when dots exist
  const dots = s.split(".");
  if (dots.length > 2) s = dots.slice(0, -1).join("") + "." + dots[dots.length - 1];
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return k ? n * 1000 : n;
}

function makeFigure(values: number[], period: Period, months: number): SalaryFigure | undefined {
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length === 0) return undefined;
  const low = Math.min(...nonZero);
  const high = Math.max(...nonZero);
  const num = low === high ? fmt(low, period) : `${fmt(low, period)}–${fmt(high, period)}`;
  const suffix = period === "mois" ? " / mois" : period === "an" ? " / an" : period === "h" ? " / h" : "";
  return { label: `${num} €${suffix}`, annual: annualize(high, period, months) };
}

function fmt(n: number, period: Period): string {
  if (period === "h") return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("fr-FR");
}

function annualize(n: number, period: Period, months: number): number {
  if (period === "mois") return Math.round(n * months);
  if (period === "h") return Math.round(n * 1820); // ~35 h × 52 weeks
  return Math.round(n); // annual or unknown → treat as annual
}
