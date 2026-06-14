import { z } from "zod";

/**
 * ApplicationContent — the single structured model the LLM fills and both
 * renderers (docx, pdfkit) consume. Keeping one model guarantees the PDF and
 * DOCX carry identical content, and lets the zero-fabrication check operate on
 * structured data rather than prose (see design.md).
 *
 * Everything here must trace back to the CandidateProfile; the adaptation step
 * may reword/reorder/select, never invent (see lib/generation/verify).
 */

export const CvContact = z.object({
  fullName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
});
export type CvContact = z.infer<typeof CvContact>;

export const CvExperience = z.object({
  title: z.string().min(1),
  organisation: z.string().optional(),
  /** Normalised to "MM/AAAA – MM/AAAA" where possible by the prompt. */
  period: z.string().optional(),
  location: z.string().optional(),
  /** Offer-adapted bullet points, drawn from the profile's real highlights. */
  highlights: z.array(z.string()).default([]),
});
export type CvExperience = z.infer<typeof CvExperience>;

export const CvFormation = z.object({
  degree: z.string().min(1),
  institution: z.string().optional(),
  period: z.string().optional(),
});
export type CvFormation = z.infer<typeof CvFormation>;

export const CvLanguage = z.object({
  name: z.string().min(1),
  level: z.string().optional(),
});
export type CvLanguage = z.infer<typeof CvLanguage>;

export const CvContent = z.object({
  /** Headline tailored to the offer (reuses the offer's exact title where it fits the profile). */
  headline: z.string().optional(),
  /** A short profile/accroche paragraph, offer-adapted, fact-only. */
  summary: z.string().optional(),
  contact: CvContact,
  experiences: z.array(CvExperience).default([]),
  formations: z.array(CvFormation).default([]),
  /** Skill names, prioritised toward the offer; only skills the candidate has. */
  skills: z.array(z.string()).default([]),
  languages: z.array(CvLanguage).default([]),
});
export type CvContent = z.infer<typeof CvContent>;

export const LetterContent = z.object({
  /** Free-text addressing context (company/role) when the offer gives no name. */
  recipientContext: z.string().optional(),
  /** Body paragraphs of the cover letter, in order. */
  paragraphs: z.array(z.string().min(1)).min(1),
});
export type LetterContent = z.infer<typeof LetterContent>;

export const ApplicationContent = z.object({
  cv: CvContent,
  letter: LetterContent,
});
export type ApplicationContent = z.infer<typeof ApplicationContent>;
