/**
 * Deterministic zero-fabrication guard (FONDATIONS §5).
 *
 * The prompt forbids invention, but the prompt is not a guarantee. Here we map
 * every generated CV experience/formation back to a CandidateProfile entry and
 * drop anything untraceable, and we restrict skills to those the candidate
 * actually has. Wording/ordering may change freely; invented ENTITIES (jobs,
 * employers, diplomas) and unsupported SKILLS are removed and recorded.
 *
 * Known limitation: a fabricated detail inside a real role is not structurally
 * detectable — mitigated by the constrained prompt and human review (Slice 4).
 */

import type { CandidateProfile } from "@/lib/profile";
import { deaccent } from "@/lib/aggregation/text";
import type { ApplicationContent } from "./content";

export type VerificationReport = {
  droppedExperiences: string[];
  droppedFormations: string[];
  droppedSkills: string[];
  flags: string[];
};

/** Distinctive (len>=4) tokens of a string, deaccented. */
function tokens(s?: string): Set<string> {
  if (!s) return new Set();
  return new Set(
    deaccent(s)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4),
  );
}

/** True if two strings share at least one distinctive token. */
function overlaps(a?: string, b?: string): boolean {
  const ta = tokens(a);
  if (!ta.size) return false;
  for (const t of tokens(b)) if (ta.has(t)) return true;
  return false;
}

/** Verify + clean the generated content against the profile. */
export function verifyAgainstProfile(
  content: ApplicationContent,
  profile: CandidateProfile,
): { content: ApplicationContent; report: VerificationReport } {
  const report: VerificationReport = {
    droppedExperiences: [],
    droppedFormations: [],
    droppedSkills: [],
    flags: [],
  };

  // --- experiences: anchor on organisation, fall back to title overlap ---
  const profExp = profile.experiences;
  const keptExperiences = content.cv.experiences.filter((e) => {
    const traceable = profExp.some((p) => {
      if (e.organisation && p.organisation && overlaps(e.organisation, p.organisation)) return true;
      // No org to anchor on (either side): accept a title overlap with a real role.
      if ((!e.organisation || !p.organisation) && overlaps(e.title, p.title)) return true;
      return false;
    });
    if (!traceable) {
      report.droppedExperiences.push(`${e.title}${e.organisation ? ` — ${e.organisation}` : ""}`);
    }
    return traceable;
  });

  // --- formations: degree or institution overlap ---
  const keptFormations = content.cv.formations.filter((f) => {
    const traceable = profile.formations.some(
      (p) =>
        overlaps(f.institution, p.institution) ||
        overlaps(f.degree, p.degree) ||
        overlaps(f.degree, p.field),
    );
    if (!traceable) {
      report.droppedFormations.push(`${f.degree}${f.institution ? ` — ${f.institution}` : ""}`);
    }
    return traceable;
  });

  // --- skills: must be supported by a profile skill (no stuffing) ---
  const profSkillTokens = profile.skills.map((s) => tokens(s.name));
  const keptSkills = content.cv.skills.filter((skill) => {
    const st = tokens(skill);
    if (!st.size) return false;
    const supported = profSkillTokens.some((pt) => {
      for (const t of st) if (pt.has(t)) return true;
      return false;
    });
    if (!supported) report.droppedSkills.push(skill);
    return supported;
  });

  // --- flags: lost core content ---
  if (profExp.length > 0 && keptExperiences.length === 0) {
    report.flags.push("Aucune expérience générée n'a pu être tracée au profil.");
  }

  return {
    content: {
      cv: {
        ...content.cv,
        experiences: keptExperiences,
        formations: keptFormations,
        skills: keptSkills,
      },
      letter: content.letter,
    },
    report,
  };
}

/**
 * Style normalisation: the cv-lettre-motivation-fr skill forbids the em dash
 * (—) and the double hyphen. We strip those deterministically before saving,
 * replacing each with a short hyphen. The en dash (–) is intentionally KEPT:
 * the reference CV template uses it for dates and incises (see cv-layout).
 */
function stripLongDashes(s: string): string {
  return s
    .replace(/\s*(?:—|--)\s*/g, " - ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Apply stripLongDashes to every text field; report whether anything changed. */
export function normalizeProse(
  content: ApplicationContent,
): { content: ApplicationContent; dashesRemoved: boolean } {
  let changed = false;
  const fix = (s: string): string => {
    const out = stripLongDashes(s);
    if (out !== s) changed = true;
    return out;
  };
  const fixOpt = (s?: string): string | undefined => (s === undefined ? undefined : fix(s));

  const cv = content.cv;
  const next: ApplicationContent = {
    cv: {
      ...cv,
      headline: fixOpt(cv.headline),
      summary: fixOpt(cv.summary),
      experiences: cv.experiences.map((e) => ({
        ...e,
        title: fix(e.title),
        organisation: fixOpt(e.organisation),
        period: fixOpt(e.period),
        location: fixOpt(e.location),
        highlights: e.highlights.map(fix),
      })),
      formations: cv.formations.map((f) => ({
        ...f,
        degree: fix(f.degree),
        institution: fixOpt(f.institution),
        period: fixOpt(f.period),
      })),
      skills: cv.skills.map(fix),
    },
    letter: {
      recipientContext: fixOpt(content.letter.recipientContext),
      paragraphs: content.letter.paragraphs.map(fix),
    },
  };
  return { content: next, dashesRemoved: changed };
}
