/**
 * DOCX renderer that CLONES the candidate's template (source/template_cv.docx)
 * and injects only text — so the output is byte-for-byte identical in styling
 * (fonts, the dark-blue underlined section headings, italic dates, bullet list
 * style, spacing, margins, theme) and only the content changes.
 *
 * We keep every template part (styles.xml, numbering.xml, theme, settings,
 * fontTable, sectPr) untouched and replace just the <w:body> paragraphs, using
 * the exact pPr/rPr "recipes" extracted from the template. Consumes the shared
 * ApplicationContent — never adds content.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import type { CvContent, CvExperience, LetterContent } from "@/lib/generation/content";
import { EN_DASH, formatPeriod, groupExperiences, skillPairs } from "./cv-layout";

const TEMPLATE_PATH = join(process.cwd(), "source", "template_cv_ok.docx");

// --- run-property recipes copied verbatim from the template ----------------
const TNR = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
const RPR_NAME = `<w:rPr>${TNR}<w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>`;
const RPR_REG = `<w:rPr>${TNR}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
const RPR_BOLD = `<w:rPr>${TNR}<w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
const RPR_ITALIC = `<w:rPr>${TNR}<w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
const SPACING = '<w:spacing w:line="360" w:lineRule="auto"/>';

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function t(s: string): string {
  return `<w:t xml:space="preserve">${esc(s)}</w:t>`;
}
function run(text: string, rpr: string): string {
  return `<w:r>${rpr}${t(text)}</w:r>`;
}

// --- paragraph recipes (mirror the template exactly) -----------------------
function pName(text: string): string {
  return `<w:p><w:pPr>${SPACING}<w:jc w:val="center"/></w:pPr>${run(text, RPR_NAME)}</w:p>`;
}
function pCenter(text: string, rpr: string): string {
  return `<w:p><w:pPr>${SPACING}<w:jc w:val="center"/></w:pPr>${run(text, rpr)}</w:p>`;
}
function pSection(text: string): string {
  // dark-blue bottom border + bold, like the template's section titles.
  const pPr = `<w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="1F4E79"/></w:pBdr>${SPACING}</w:pPr>`;
  return `<w:p>${pPr}${run(text, RPR_BOLD)}</w:p>`;
}
function pEntry(left: string, right?: string): string {
  const pPr = `<w:pPr><w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>${SPACING}</w:pPr>`;
  let runs = run(left, RPR_BOLD);
  if (right) {
    runs += `<w:r>${RPR_BOLD}<w:tab/></w:r>` + run(right, RPR_ITALIC);
  }
  return `<w:p>${pPr}${runs}</w:p>`;
}
/** Two-column row for the key-skills block (left tab like the template). */
function pSkillRow(a: string, b?: string): string {
  const pPr = `<w:pPr><w:tabs><w:tab w:val="left" w:pos="4680"/></w:tabs>${SPACING}</w:pPr>`;
  let runs = run(a, RPR_REG);
  if (b) runs += `<w:r>${RPR_REG}<w:tab/></w:r>` + run(b, RPR_REG);
  return `<w:p>${pPr}${runs}</w:p>`;
}
function pBullet(text: string): string {
  const pPr = `<w:pPr><w:pStyle w:val="Paragraphedeliste"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr>${SPACING}</w:pPr>`;
  return `<w:p>${pPr}${run(text, RPR_REG)}</w:p>`;
}
function pBody(text: string, opts: { rpr?: string; jc?: string } = {}): string {
  const jc = opts.jc ? `<w:jc w:val="${opts.jc}"/>` : "";
  return `<w:p><w:pPr>${SPACING}${jc}</w:pPr>${run(text, opts.rpr ?? RPR_REG)}</w:p>`;
}
function pEmpty(): string {
  return `<w:p><w:pPr>${SPACING}</w:pPr></w:p>`;
}

// --- bodies ----------------------------------------------------------------
function cvBody(cv: CvContent): string {
  const out: string[] = [];
  out.push(pName(cv.contact.fullName));
  if (cv.headline) out.push(pCenter(cv.headline, RPR_ITALIC));
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedinUrl].filter(
    Boolean,
  ) as string[];
  if (contact.length) out.push(pCenter(contact.join(" • "), RPR_REG));

  if (cv.summary) {
    out.push(pSection("PROFIL"));
    out.push(pBody(cv.summary));
  }
  const renderExperiences = (list: CvExperience[]) => {
    for (const e of list) {
      out.push(pEntry([e.title, e.organisation].filter(Boolean).join(` ${EN_DASH} `), formatPeriod(e.period)));
      if (e.location) out.push(pBody(e.location, { rpr: RPR_ITALIC }));
      for (const h of e.highlights) out.push(pBullet(h));
    }
  };
  const { professional, teachingResearch } = groupExperiences(cv);
  if (professional.length) {
    out.push(pSection("EXPÉRIENCE PROFESSIONNELLE"));
    renderExperiences(professional);
  }
  if (teachingResearch.length) {
    out.push(pSection("ENSEIGNEMENT & RECHERCHE"));
    renderExperiences(teachingResearch);
  }
  if (cv.formations.length) {
    out.push(pSection("FORMATION"));
    for (const f of cv.formations) {
      out.push(pEntry([f.degree, f.institution].filter(Boolean).join(` ${EN_DASH} `), formatPeriod(f.period)));
    }
  }
  if (cv.skills.length) {
    out.push(pSection("COMPÉTENCES CLÉS"));
    for (const [a, b] of skillPairs(cv.skills)) out.push(pSkillRow(a, b));
  }
  if (cv.languages.length) {
    out.push(pSection("LANGUES"));
    out.push(pBody(cv.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(", ")));
  }
  return out.join("");
}

function letterBody(letter: LetterContent, fullName: string): string {
  const out: string[] = [];
  out.push(pBody(fullName, { rpr: RPR_BOLD, jc: "right" }));
  out.push(pEmpty());
  if (letter.recipientContext) {
    out.push(pBody(letter.recipientContext));
    out.push(pEmpty());
  }
  for (const p of letter.paragraphs) {
    out.push(pBody(p, { jc: "both" }));
    out.push(pEmpty());
  }
  return out.join("");
}

// --- clone the template, swap the body ------------------------------------
async function buildFromTemplate(bodyXml: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Template invalide : word/document.xml introuvable.");
  const doc = await docFile.async("string");

  const bodyOpen = doc.match(/<w:body[^>]*>/);
  const sectStart = doc.lastIndexOf("<w:sectPr");
  if (!bodyOpen || sectStart === -1) {
    throw new Error("Template invalide : structure <w:body>/<w:sectPr> introuvable.");
  }
  const head = doc.slice(0, bodyOpen.index! + bodyOpen[0].length);
  const tail = doc.slice(sectStart); // keep the original sectPr (page/margins/cols)

  zip.file("word/document.xml", head + bodyXml + tail);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) as Promise<Buffer>;
}

/** Render the CV to a DOCX buffer using the template's styling. */
export function renderCvDocx(cv: CvContent): Promise<Buffer> {
  return buildFromTemplate(cvBody(cv));
}

/** Render the cover letter to a DOCX buffer using the template's styling. */
export function renderLetterDocx(letter: LetterContent, fullName: string): Promise<Buffer> {
  return buildFromTemplate(letterBody(letter, fullName));
}
