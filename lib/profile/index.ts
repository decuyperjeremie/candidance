import { z } from "zod";
import {
  CandidateProfile,
  type Experience,
  type Formation,
  type Language,
  type Publication,
  type Skill,
} from "./schema";
import { CV_PATH, CvFileMissingError, parseCv, type CvIntermediate } from "./cv";
import { LINKEDIN_PATH, parseLinkedin, type LinkedinIntermediate } from "./linkedin";

export { CandidateProfile, CvFileMissingError };
export type { Experience, Formation, Language, Publication, Skill };
export type { CvIntermediate, LinkedinIntermediate };

/** Thrown when the assembled profile fails zod validation. */
export class ProfileValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(
      "Assembled CandidateProfile failed validation:\n" +
        issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
    this.name = "ProfileValidationError";
  }
}

// --- fuzzy de-dup helpers --------------------------------------------------

function deaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Generic words that don't identify a specific org/school. */
const STOPWORDS = new Set([
  "universite", "university", "universidade", "universidad",
  "paris", "pantheon", "ecole", "institut",
  "fundacao", "fondation", "faculte", "the", "rio", "janeiro", "cidade",
  "estado", "etat", "federacao", "federation", "industries", "industrias",
  "comunicacoes", "communication", "communications", "general",
]);

/** Distinctive (non-stopword, length>=4) tokens of a name. */
function distinctiveTokens(name?: string): Set<string> {
  if (!name) return new Set();
  return new Set(
    deaccent(name)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

/** True if two names share at least one distinctive token (same entity). */
function sameEntity(a?: string, b?: string): boolean {
  const ta = distinctiveTokens(a);
  for (const t of distinctiveTokens(b)) if (ta.has(t)) return true;
  return false;
}

// --- builders --------------------------------------------------------------

function buildExperiences(
  cv: CvIntermediate,
  li: LinkedinIntermediate,
): Experience[] {
  const out: Experience[] = cv.experiences.map((e) => ({
    title: e.title,
    organisation: e.organisation,
    period: e.period,
    highlights: e.highlights,
    kind: e.kind,
    source: "cv",
  }));
  // Add LinkedIn roles whose organisation isn't already represented in the CV.
  for (const le of li.experiences) {
    const dup = out.some((e) => sameEntity(e.organisation, le.organisation));
    if (dup) continue;
    out.push({
      title: le.title,
      organisation: le.organisation,
      period: le.period,
      location: le.location,
      highlights: [],
      source: "linkedin",
    });
  }
  return out;
}

function buildFormations(
  cv: CvIntermediate,
  li: LinkedinIntermediate,
): Formation[] {
  const out: Formation[] = cv.formations.map((f) => ({
    degree: f.degree,
    institution: f.institution,
    period: f.period,
    source: "cv",
  }));
  // Add LinkedIn schools not already in the CV.
  for (const lf of li.formations) {
    const dup = out.some((f) => sameEntity(f.institution, lf.institution));
    if (dup) continue;
    out.push({
      degree: lf.degree ?? lf.field ?? lf.institution,
      institution: lf.institution,
      field: lf.field,
      period: lf.period,
      source: "linkedin",
    });
  }
  return out;
}

function buildSkills(
  cv: CvIntermediate,
  li: LinkedinIntermediate,
): Skill[] {
  const highlighted = new Set(li.highlightedSkills.map((s) => deaccent(s)));
  const seen = new Set<string>();
  const out: Skill[] = [];

  const push = (name: string, source: Skill["source"], hi: boolean) => {
    const key = deaccent(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, highlighted: hi || highlighted.has(key), source });
  };

  // CV "compétences clés" are, by definition, highlighted.
  for (const s of cv.skills) push(s, "cv", true);
  for (const s of li.skills) push(s, "linkedin", false);
  for (const s of li.highlightedSkills) push(s, "linkedin", true);
  return out;
}

function buildLanguages(cv: CvIntermediate): Language[] {
  return cv.languages.map((l) => ({ name: l.name, level: l.level, source: "cv" }));
}

/** Years-of-experience string as stated in the CV profil text, if any. */
function cvYears(cv: CvIntermediate): string | undefined {
  return cv.summary?.match(/(plus de\s*)?\d+\s*ans?\s+d['’]exp[ée]rience/i)?.[0];
}

function normYears(s?: string): string | undefined {
  return s?.match(/\d+/)?.[0];
}

/**
 * Merge CV (canonical) + LinkedIn (enrichment) into one CandidateProfile.
 * Conflicting facts are recorded in `conflicts`, never silently dropped.
 */
export function buildProfile(
  cv: CvIntermediate,
  li: LinkedinIntermediate,
): CandidateProfile {
  const conflicts: CandidateProfile["conflicts"] = [];

  const contact = {
    fullName: cv.fullName ?? "Tatiana Ávila Gomes",
    phone: cv.contact.phone,
    email: cv.contact.email,
    location: cv.contact.location ?? li.location,
    linkedinUrl: li.linkedinUrl,
  };

  // Headline: CV is canonical; record the LinkedIn variant as a conflict.
  const headline = cv.headline ?? li.headline;
  if (cv.headline && li.headline && cv.headline !== li.headline) {
    conflicts.push({
      field: "headline",
      cv: cv.headline,
      linkedin: li.headline,
      note: "Different headlines across sources; CV used as primary.",
    });
  }

  const summaries: CandidateProfile["summaries"] = [];
  if (cv.summary) summaries.push({ text: cv.summary, source: "cv" });
  if (li.about) summaries.push({ text: li.about, source: "linkedin" });

  const yCv = cvYears(cv);
  const yLi = li.yearsOfExperience;
  const yearsOfExperience = yCv || yLi ? { cv: yCv, linkedin: yLi } : undefined;
  if (yCv && yLi && normYears(yCv) !== normYears(yLi)) {
    conflicts.push({
      field: "yearsOfExperience",
      cv: yCv,
      linkedin: yLi,
      note: "Sources state different experience durations; both retained.",
    });
  }

  return CandidateProfile.parse({
    contact,
    headline,
    summaries,
    yearsOfExperience,
    experiences: buildExperiences(cv, li),
    formations: buildFormations(cv, li),
    skills: buildSkills(cv, li),
    languages: buildLanguages(cv),
    publications: [] as Publication[],
    conflicts,
  });
}

/**
 * Load and validate the full CandidateProfile from the source files.
 * - Fails with CvFileMissingError if the CV is absent (no partial profile).
 * - Returns a validated CandidateProfile, or throws ProfileValidationError.
 */
export async function loadCandidateProfile(opts?: {
  cvPath?: string;
  linkedinPath?: string;
}): Promise<CandidateProfile> {
  const cv = await parseCv(opts?.cvPath ?? CV_PATH);
  const li = parseLinkedin(opts?.linkedinPath ?? LINKEDIN_PATH);
  try {
    return buildProfile(cv, li);
  } catch (err) {
    if (err instanceof z.ZodError) throw new ProfileValidationError(err.issues);
    throw err;
  }
}
