import { existsSync, readFileSync } from "node:fs";

/**
 * Deterministic parse of the LinkedIn extract markdown (`extract-linkedin.md`).
 * NO LLM, NO fabrication — we read the known structured sections (headline,
 * experience table, formation table, skills list, achievements, years).
 * If the file is absent we return an empty extract (CV remains the canonical
 * required source; LinkedIn only enriches).
 */

export const LINKEDIN_PATH = "source/extract-linkedin.md";

export type LinkedinExperience = {
  title: string;
  organisation?: string;
  period?: string;
  duration?: string;
  location?: string;
};

export type LinkedinFormation = {
  institution: string;
  degree?: string;
  field?: string;
  period?: string;
};

export type LinkedinIntermediate = {
  present: boolean;
  headline?: string;
  location?: string;
  linkedinUrl?: string;
  yearsOfExperience?: string;
  about?: string;
  achievements: string[];
  experiences: LinkedinExperience[];
  formations: LinkedinFormation[];
  skills: string[];
  highlightedSkills: string[];
};

function emptyExtract(): LinkedinIntermediate {
  return {
    present: false,
    achievements: [],
    experiences: [],
    formations: [],
    skills: [],
    highlightedSkills: [],
  };
}

/** "| a | b | c |" -> ["a","b","c"] */
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")));
}

function blank(v?: string): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t && t !== "—" && t !== "-" ? t : undefined;
}

export function parseLinkedin(
  path: string = LINKEDIN_PATH,
): LinkedinIntermediate {
  if (!existsSync(path)) return emptyExtract();

  const md = readFileSync(path, "utf8");
  const lines = md.split(/\r?\n/);
  const out = emptyExtract();
  out.present = true;

  // --- inline single-field lines ---
  const headlineMatch = md.match(/\*\*Titre \/ Headline ?:\*\*\s*(.+)/);
  if (headlineMatch) out.headline = headlineMatch[1].trim();

  const locMatch = md.match(/\*\*Localisation ?:\*\*\s*(.+)/);
  if (locMatch) out.location = blank(locMatch[1]);

  const urlMatch = md.match(/\*\*URL ?:\*\*\s*(\S+)/);
  if (urlMatch) out.linkedinUrl = urlMatch[1].trim();

  // Years of experience — appears as "24 ans d'expérience".
  const yearsMatch = md.match(/(\d+\s*ans?\s+d['’]exp[ée]rience)/i);
  if (yearsMatch) out.yearsOfExperience = yearsMatch[1].trim();

  // --- section-aware line walk ---
  type Section =
    | "about"
    | "achievements"
    | "experience"
    | "formation"
    | "skills"
    | "other";
  let section: Section = "other";
  const aboutLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^#{1,4}\s+(.+)/);
    if (h) {
      const title = h[1]
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      if (title.includes("infos") || title.includes("a propos"))
        section = "about";
      else if (title.includes("realisations")) section = "achievements";
      else if (title.startsWith("experience")) section = "experience";
      else if (title.startsWith("formation")) section = "formation";
      else if (title.startsWith("competences")) section = "skills";
      else section = "other";
      continue;
    }

    const trimmed = line.trim();

    if (section === "about") {
      if (trimmed && !trimmed.startsWith("###") && !trimmed.startsWith("---"))
        aboutLines.push(trimmed);
    }

    if (section === "achievements") {
      const b = trimmed.match(/^[-*]\s+(.+)/);
      if (b) out.achievements.push(b[1].trim());
    }

    if (section === "experience" && trimmed.startsWith("|")) {
      const cells = parseTableRow(trimmed);
      if (isSeparatorRow(cells)) continue;
      if (/^poste$/i.test(cells[0])) continue; // header
      const [title, org, period, duration, location] = cells;
      if (blank(title)) {
        out.experiences.push({
          title: title.trim(),
          organisation: blank(org),
          period: blank(period),
          duration: blank(duration),
          location: blank(location),
        });
      }
    }

    if (section === "formation" && trimmed.startsWith("|")) {
      const cells = parseTableRow(trimmed);
      if (isSeparatorRow(cells)) continue;
      if (/etablissement/i.test(cells[0].normalize("NFD").replace(/[̀-ͯ]/g, "")))
        continue; // header
      const [institution, degree, field, period] = cells;
      if (blank(institution)) {
        out.formations.push({
          institution: institution.trim(),
          degree: blank(degree),
          field: blank(field),
          period: blank(period),
        });
      }
    }

    if (section === "skills") {
      // Numbered list: "1. Communication de crise"
      const num = trimmed.match(/^\d+\.\s+(.+)/);
      if (num) out.skills.push(num[1].trim());
      // Highlighted block: "A · B · C"
      if (trimmed.includes("·") && !num) {
        const parts = trimmed
          .split("·")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length > 1) out.highlightedSkills.push(...parts);
      }
    }
  }

  out.about = aboutLines.join(" ").trim() || undefined;
  return out;
}
