/**
 * Shared CV layout helpers used by both renderers (docx, pdf), so PDF and DOCX
 * present experiences identically. Runs at render time, so existing and edited
 * applications get the consistent formatting without regeneration.
 *
 * - formatPeriod: year-based, en-dash ("AAAA – AAAA"), ongoing -> "depuis AAAA".
 * - byRecency: antichronological order (ongoing first, then most recent).
 * - groupExperiences: split into professional vs teaching/research sections.
 * - skillPairs: two-per-row for the two-column key-skills block.
 */

import type { CvContent, CvExperience } from "@/lib/generation/content";

/** En-dash used for date ranges and separators (matches template_cv_ok.docx). */
export const EN_DASH = "–";

const ONGOING = /pr[ée]sent|aujourd'?hui|en cours|\bdepuis\b|actuel/i;

/** 4-digit years (1900–2099) in the order they appear. */
function years(s: string): number[] {
  return (s.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number);
}

/**
 * Normalise a raw period to a consistent year-based form. Unparseable strings
 * (no 4-digit year) are returned untouched so we never invent a date.
 */
export function formatPeriod(raw?: string): string {
  if (!raw) return "";
  const ys = years(raw);
  if (ys.length === 0) return raw.trim();
  if (ONGOING.test(raw)) return `depuis ${ys[0]}`;
  if (ys.length === 1) return String(ys[0]);
  const start = ys[0];
  const end = ys[ys.length - 1];
  return start === end ? String(start) : `${start} ${EN_DASH} ${end}`;
}

function recencyKey(e: CvExperience): { end: number; start: number } {
  const raw = e.period ?? "";
  const ys = years(raw);
  const start = ys[0] ?? 0;
  // Ongoing roles sort to the top; otherwise by latest year mentioned.
  const end = ONGOING.test(raw) ? 9999 : (ys[ys.length - 1] ?? start);
  return { end, start };
}

/** Antichronological comparator: ongoing first, then most recent end/start. */
export function byRecency(a: CvExperience, b: CvExperience): number {
  const ka = recencyKey(a);
  const kb = recencyKey(b);
  return kb.end - ka.end || kb.start - ka.start;
}

const TEACHING_RESEARCH =
  /doctora|th[èe]se|universit|facult|enseignement|recherche|travaux dirig[ée]s|\bater\b|ma[iî]tre de conf[ée]rence|chercheu/i;

/** Whether an experience belongs in the teaching/research section. */
function isTeachingResearch(e: CvExperience): boolean {
  if (e.category === "enseignement_recherche") return true;
  if (e.category === "professionnelle") return false;
  return TEACHING_RESEARCH.test(`${e.title} ${e.organisation ?? ""}`);
}

/** Split experiences into the two CV sections, each antichronological. */
export function groupExperiences(cv: CvContent): {
  professional: CvExperience[];
  teachingResearch: CvExperience[];
} {
  const professional: CvExperience[] = [];
  const teachingResearch: CvExperience[] = [];
  for (const e of cv.experiences) {
    (isTeachingResearch(e) ? teachingResearch : professional).push(e);
  }
  return {
    professional: [...professional].sort(byRecency),
    teachingResearch: [...teachingResearch].sort(byRecency),
  };
}

/** Pair skills two-per-row for the two-column key-skills layout. */
export function skillPairs(skills: string[]): [string, string?][] {
  const pairs: [string, string?][] = [];
  for (let i = 0; i < skills.length; i += 2) pairs.push([skills[i], skills[i + 1]]);
  return pairs;
}
