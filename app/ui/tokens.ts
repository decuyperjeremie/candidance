/**
 * TS mirror of the design tokens that application logic needs (values that can't
 * live only in CSS because they're chosen in code). Names match the CSS custom
 * properties in app/globals.css — keep the two in sync.
 */

import type { ApplicationStatus } from "@/lib/tracking/store";

export const COLOR = {
  ink: "#1b1a17",
  muted: "#6f6b62",
  faint: "#908b80",
  hairline: "#e7e3da",
  accent: "#1f4e79",
  good: "#2f7d56",
  warn: "#9a6a1c",
} as const;

/** Relevance score band colour (0–100). */
export function scoreColor(score: number): string {
  if (score >= 70) return COLOR.good;
  if (score >= 40) return COLOR.warn;
  return COLOR.muted;
}

/** Human-readable label per job-source connector (technical name → display). */
export const SOURCE_LABELS: Record<string, string> = {
  "france-travail": "France Travail",
  apec: "APEC",
  "welcome-to-the-jungle": "Welcome to the Jungle",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  "company-site": "Site entreprise",
};

/** Display label for a source connector name, falling back to the raw name. */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Calm per-status tint for tracking chips. */
export const STATUS_COLOR: Record<ApplicationStatus, string> = {
  à_traiter: "#6f6b62",
  générée: "#1f4e79",
  validée: "#5b4b8a",
  envoyée: "#9a6a1c",
  relancée: "#a4561f",
  réponse: "#2f7d56",
};
