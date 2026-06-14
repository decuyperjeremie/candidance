import { existsSync, readFileSync } from "node:fs";

/**
 * Deterministic parse of the candidate CV markdown into a structured
 * intermediate. NO LLM, NO fabrication — pure extraction of what the markdown
 * states. The markdown (`source/CV_Tatiana_Avila_Gomes.12.06.md`) is a faithful
 * conversion of the original PDF (kept alongside as the reference original).
 */

export const CV_PATH = "source/CV_Tatiana_Avila_Gomes.12.06.md";

export class CvFileMissingError extends Error {
  constructor(path: string) {
    super(
      `CV file not found at "${path}". This file is required to build the ` +
        `candidate profile and is the canonical source of truth. ` +
        `Place the CV markdown at that path and retry.`,
    );
    this.name = "CvFileMissingError";
  }
}

export type CvExperience = {
  title: string;
  organisation?: string;
  period?: string;
  highlights: string[];
  kind: "professional" | "academic";
};

export type CvFormation = {
  degree: string;
  institution?: string;
  period?: string;
};

export type CvLanguage = { name: string; level?: string };

export type CvIntermediate = {
  fullName?: string;
  headline?: string;
  contact: { location?: string; phone?: string; email?: string };
  summary?: string;
  skills: string[];
  experiences: CvExperience[];
  formations: CvFormation[];
  languages: CvLanguage[];
};

function deaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Strip markdown emphasis and surrounding whitespace. */
function stripMd(s: string): string {
  return s.replace(/\*\*/g, "").replace(/(^\*|\*$)/g, "").trim();
}

/** "| a | b |" -> ["a","b"] */
function tableCells(line: string): string[] {
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

type Section =
  | "profil"
  | "competences"
  | "experience-pro"
  | "enseignement"
  | "formation"
  | "langues"
  | "other"
  | "preamble";

function classifySection(title: string): Section {
  const t = deaccent(title);
  if (t.startsWith("profil")) return "profil";
  if (t.startsWith("competences")) return "competences";
  if (t.startsWith("experience")) return "experience-pro";
  if (t.startsWith("enseignement") || t.includes("recherche")) return "enseignement";
  if (t.startsWith("formation")) return "formation";
  if (t.startsWith("langues")) return "langues";
  return "other";
}

function classifyContact(raw: string, c: CvIntermediate["contact"]) {
  // Drop a leading emoji/symbol token, keep the value.
  const value = raw.replace(/^[^\p{L}\p{N}+]+/u, "").trim();
  if (!value) return;
  if (value.includes("@")) c.email = value;
  else if (/\d{2}[\s.]\d/.test(value)) c.phone = value;
  else if (/trilingue|·/i.test(value)) return; // language hint, ignored here
  else c.location = value;
}

/** Split a formation bullet "Degree — Institution, year" into parts. */
function parseFormation(text: string): CvFormation {
  const clean = stripMd(text).replace(/\s+/g, " ").trim();
  const [degreePart, ...rest] = clean.split(/\s+[—–]\s+/); // em/en dash separator
  const remainder = rest.join(" — ").replace(/\.$/, "").trim();
  const period = remainder.match(/(depuis\s*\d{4}|en cours|\b\d{4}\b)/i)?.[0];
  let institution = remainder;
  if (period) institution = remainder.replace(period, "").replace(/[,\s]+$/, "").trim();
  return {
    degree: degreePart.replace(/\.$/, "").trim(),
    institution: institution || undefined,
    period: period?.trim(),
  };
}

/** Parse "### Title — *period*" -> { title, period }. */
function parseExperienceHeading(line: string): { title: string; period?: string } {
  const body = line.replace(/^###\s+/, "");
  const m = body.match(/^(.*?)\s+[—–]\s+\*(.+?)\*\s*$/);
  if (m) return { title: stripMd(m[1]).trim(), period: m[2].trim() };
  return { title: stripMd(body).trim() };
}

/**
 * Parse the CV markdown into a structured intermediate.
 * Throws CvFileMissingError if the file is absent (no partial profile).
 */
export async function parseCv(path: string = CV_PATH): Promise<CvIntermediate> {
  if (!existsSync(path)) throw new CvFileMissingError(path);

  const md = readFileSync(path, "utf8");
  const lines = md.split(/\r?\n/);

  const out: CvIntermediate = {
    contact: {},
    skills: [],
    experiences: [],
    formations: [],
    languages: [],
  };

  let section: Section = "preamble";
  const summaryLines: string[] = [];
  let cur: CvExperience | null = null;

  const flushExp = () => {
    if (cur) out.experiences.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (trimmed === "---") continue;

    // Top-level name (# ...)
    const h1 = trimmed.match(/^#\s+(.+)/);
    if (h1) {
      out.fullName = stripMd(h1[1]).trim();
      continue;
    }

    // Section heading (## ...)
    const h2 = trimmed.match(/^##\s+(.+)/);
    if (h2) {
      flushExp();
      section = classifySection(h2[1]);
      continue;
    }

    if (section === "preamble") {
      // Headline (first bold line) then contact bullets.
      if (!out.headline && /^\*\*.+\*\*$/.test(trimmed)) {
        out.headline = stripMd(trimmed);
        continue;
      }
      const bullet = trimmed.match(/^[-*]\s+(.+)/);
      if (bullet) classifyContact(bullet[1], out.contact);
      continue;
    }

    if (section === "profil") {
      if (trimmed) summaryLines.push(trimmed);
      continue;
    }

    if (section === "competences") {
      const b = trimmed.match(/^[-*]\s+(.+)/);
      if (b) out.skills.push(stripMd(b[1]).trim());
      continue;
    }

    if (section === "experience-pro" || section === "enseignement") {
      const kind = section === "enseignement" ? "academic" : "professional";
      if (/^###\s+/.test(trimmed)) {
        flushExp();
        const { title, period } = parseExperienceHeading(trimmed);
        cur = { title, period, highlights: [], kind };
        continue;
      }
      const bullet = trimmed.match(/^[-*]\s+(.+)/);
      if (bullet) {
        if (cur) cur.highlights.push(stripMd(bullet[1]).trim());
        continue;
      }
      // Bold org line under the heading.
      if (cur && !cur.organisation && /^\*\*.+\*\*$/.test(trimmed)) {
        cur.organisation = stripMd(trimmed);
      }
      continue;
    }

    if (section === "formation") {
      const b = trimmed.match(/^[-*]\s+(.+)/);
      if (b) out.formations.push(parseFormation(b[1]));
      continue;
    }

    if (section === "langues" && trimmed.startsWith("|")) {
      const cells = tableCells(trimmed);
      if (isSeparatorRow(cells)) continue;
      if (/^langue$/i.test(cells[0])) continue; // header
      const [name, level] = cells;
      if (name) out.languages.push({ name, level: level || undefined });
    }
  }
  flushExp();

  out.summary = summaryLines.join(" ").trim() || undefined;
  return out;
}
