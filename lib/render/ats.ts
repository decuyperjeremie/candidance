/**
 * Shared rendering constants for both renderers (docx, pdfkit).
 *
 * Tuned to match the candidate's CV template (source/template_cv.docx): Times
 * New Roman, name 18pt, body 12pt, 1.5 line spacing, centred header block,
 * bold UPPERCASE section headings, right-aligned dates on entry lines. The
 * template is single-column with no tables/images, so it stays ATS-parsable
 * (see design.md anti-ATS guidance).
 */

/** DOCX font (matches the template). */
export const FONT = "Times New Roman";
/** PDFKit built-in equivalents (serif, selectable text). */
export const PDF_FONT = "Times-Roman";
export const PDF_FONT_BOLD = "Times-Bold";
export const PDF_FONT_ITALIC = "Times-Italic";

/** Dark-blue rule under section headings, matching the template. */
export const ACCENT_COLOR = "#1F4E79";
export const TEXT_COLOR = "#000000";

export const SIZES = {
  name: 18,
  heading: 12,
  body: 12,
  small: 11,
} as const;

/** Conventional French section headings, rendered in UPPERCASE like the template. */
export const HEADINGS = {
  profile: "PROFIL",
  experience: "EXPÉRIENCE PROFESSIONNELLE",
  education: "FORMATION",
  skills: "COMPÉTENCES",
  languages: "LANGUES",
} as const;

/** 1.5 line spacing (DOCX: 240ths of a line -> 360). */
export const LINE_SPACING = 360;
/** Right tab stop for dates on entry lines (twips), from the template. */
export const RIGHT_TAB = 9026;
/** Page margin in points (1 inch = 72pt) for the PDF (~2cm like the template). */
export const PDF_MARGIN = 56;
