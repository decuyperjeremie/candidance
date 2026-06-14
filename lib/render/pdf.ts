/**
 * PDF renderer (ATS-parsable) using `pdfkit`, tuned to match the candidate's
 * template look as closely as a from-scratch PDF can: Times serif, centred
 * header (name bold / italic headline / contact), section headings in bold
 * UPPERCASE underlined with a dark-blue rule, entry lines with the date in
 * italic right-aligned, bullet highlights, 1.5-ish line spacing.
 *
 * Real selectable text (not an image), single column, no images. Consumes the
 * shared ApplicationContent — never adds content.
 */

import PDFDocument from "pdfkit";
import type { CvContent, LetterContent } from "@/lib/generation/content";
import {
  ACCENT_COLOR,
  PDF_FONT,
  PDF_FONT_BOLD,
  PDF_FONT_ITALIC,
  PDF_MARGIN,
  SIZES,
  TEXT_COLOR,
} from "./ats";

/** 1.5-ish spacing for 12pt body text. */
const LINE_GAP = 4;

function toBuffer(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PDF_MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      doc.fillColor(TEXT_COLOR).lineGap(LINE_GAP);
      draw(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

const contentWidth = (doc: PDFKit.PDFDocument) =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

/** Bold UPPERCASE heading with a dark-blue bottom rule, like the template. */
function section(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.6);
  doc.font(PDF_FONT_BOLD).fontSize(SIZES.heading).fillColor(TEXT_COLOR).text(text.toUpperCase());
  const y = doc.y + 1.5;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + contentWidth(doc), y)
    .lineWidth(1)
    .strokeColor(ACCENT_COLOR)
    .stroke();
  doc.moveDown(0.5);
}

function para(doc: PDFKit.PDFDocument, text: string, opts: { font?: string; bullet?: boolean } = {}): void {
  doc.font(opts.font ?? PDF_FONT).fontSize(SIZES.body).fillColor(TEXT_COLOR);
  doc.text(opts.bullet ? `•  ${text}` : text, { align: "left", ...(opts.bullet ? { indent: 14 } : {}) });
}

/** Entry line: bold title on the left, italic date right-aligned on the same line. */
function entry(doc: PDFKit.PDFDocument, left: string, right?: string): void {
  const x = doc.page.margins.left;
  const w = contentWidth(doc);
  const y0 = doc.y;
  if (right) {
    const rightW = doc.font(PDF_FONT_ITALIC).fontSize(SIZES.body).widthOfString(right);
    doc.font(PDF_FONT_BOLD).fontSize(SIZES.body).fillColor(TEXT_COLOR);
    doc.text(left, x, y0, { width: w - rightW - 12 });
    const afterLeft = doc.y;
    doc.font(PDF_FONT_ITALIC).fontSize(SIZES.body).text(right, x, y0, { width: w, align: "right" });
    doc.y = Math.max(afterLeft, doc.y);
  } else {
    doc.font(PDF_FONT_BOLD).fontSize(SIZES.body).fillColor(TEXT_COLOR).text(left, x, y0, { width: w });
  }
}

/** Render the CV to a PDF buffer. */
export function renderCvPdf(cv: CvContent): Promise<Buffer> {
  return toBuffer((doc) => {
    // Centred header block (name / italic headline / contact).
    doc.font(PDF_FONT_BOLD).fontSize(SIZES.name).text(cv.contact.fullName, { align: "center" });
    if (cv.headline) doc.font(PDF_FONT_ITALIC).fontSize(SIZES.body).text(cv.headline, { align: "center" });
    const contactBits = [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedinUrl].filter(
      Boolean,
    ) as string[];
    if (contactBits.length) {
      doc.font(PDF_FONT).fontSize(SIZES.small).text(contactBits.join("  •  "), { align: "center" });
    }

    if (cv.summary) {
      section(doc, "Profil");
      para(doc, cv.summary);
    }
    if (cv.experiences.length) {
      section(doc, "Expérience professionnelle");
      for (const e of cv.experiences) {
        entry(doc, [e.title, e.organisation].filter(Boolean).join(" — "), e.period);
        if (e.location) para(doc, e.location, { font: PDF_FONT_ITALIC });
        for (const h of e.highlights) para(doc, h, { bullet: true });
        doc.moveDown(0.2);
      }
    }
    if (cv.formations.length) {
      section(doc, "Formation");
      for (const f of cv.formations) {
        entry(doc, [f.degree, f.institution].filter(Boolean).join(" — "), f.period);
      }
    }
    if (cv.skills.length) {
      section(doc, "Compétences");
      para(doc, cv.skills.join(", "));
    }
    if (cv.languages.length) {
      section(doc, "Langues");
      para(doc, cv.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(", "));
    }
  });
}

/** Render the cover letter to a PDF buffer. */
export function renderLetterPdf(letter: LetterContent, fullName: string): Promise<Buffer> {
  return toBuffer((doc) => {
    doc.font(PDF_FONT_BOLD).fontSize(SIZES.body).fillColor(TEXT_COLOR).text(fullName, { align: "right" });
    doc.moveDown(1);
    if (letter.recipientContext) {
      doc.font(PDF_FONT).fontSize(SIZES.small).text(letter.recipientContext);
      doc.moveDown(1);
    }
    doc.font(PDF_FONT).fontSize(SIZES.body);
    for (const p of letter.paragraphs) {
      doc.text(p, { align: "justify" });
      doc.moveDown(0.8);
    }
  });
}
