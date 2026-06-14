import { z } from "zod";

/**
 * CandidateProfile — the structured single source of truth for Tatiana.
 *
 * Hard rule (see specs/profile-ingestion): only facts present in the source
 * files (`source/CV_Tatiana_27.05.docx`, `source/extract-linkedin.md`) may
 * appear here. Nothing is fabricated. Optional fields stay absent when no
 * source data exists. Conflicting facts are preserved, never silently merged.
 */

/** Where a given fact came from, for traceability / no-fabrication audits. */
export const SourceTag = z.enum(["cv", "linkedin", "both"]);
export type SourceTag = z.infer<typeof SourceTag>;

export const Contact = z.object({
  fullName: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
});
export type Contact = z.infer<typeof Contact>;

export const Experience = z.object({
  title: z.string().min(1),
  organisation: z.string().optional(),
  period: z.string().optional(),
  location: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  /** "professional" | "academic" — as separated in the CV. */
  kind: z.enum(["professional", "academic"]).optional(),
  source: SourceTag,
});
export type Experience = z.infer<typeof Experience>;

export const Formation = z.object({
  degree: z.string().min(1),
  institution: z.string().optional(),
  field: z.string().optional(),
  period: z.string().optional(),
  notes: z.string().optional(),
  source: SourceTag,
});
export type Formation = z.infer<typeof Formation>;

export const Skill = z.object({
  name: z.string().min(1),
  highlighted: z.boolean().default(false),
  source: SourceTag,
});
export type Skill = z.infer<typeof Skill>;

export const Language = z.object({
  name: z.string().min(1),
  level: z.string().optional(),
  source: SourceTag,
});
export type Language = z.infer<typeof Language>;

export const Publication = z.object({
  text: z.string().min(1),
  source: SourceTag,
});
export type Publication = z.infer<typeof Publication>;

/**
 * A fact that differs between the two sources (e.g. "20+" vs "24" years).
 * Both values are retained; resolution is left to a human / later slice.
 */
export const FactConflict = z.object({
  field: z.string().min(1),
  cv: z.string().optional(),
  linkedin: z.string().optional(),
  note: z.string().optional(),
});
export type FactConflict = z.infer<typeof FactConflict>;

export const CandidateProfile = z.object({
  contact: Contact,
  /** Professional headline. May differ between sources (see conflicts). */
  headline: z.string().optional(),
  /** Free-text "Profil"/"À propos" summaries kept verbatim per source. */
  summaries: z
    .array(z.object({ text: z.string().min(1), source: SourceTag }))
    .default([]),
  /** Years of experience as stated, per source (kept distinct on conflict). */
  yearsOfExperience: z
    .object({ cv: z.string().optional(), linkedin: z.string().optional() })
    .optional(),
  experiences: z.array(Experience).default([]),
  formations: z.array(Formation).default([]),
  skills: z.array(Skill).default([]),
  languages: z.array(Language).default([]),
  publications: z.array(Publication).default([]),
  /** Preserved cross-source discrepancies (no-fabrication / no-silent-merge). */
  conflicts: z.array(FactConflict).default([]),
});
export type CandidateProfile = z.infer<typeof CandidateProfile>;
