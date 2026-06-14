/**
 * Shared smoke-check core (Slice 0+1 end-to-end verification).
 *
 * Step 1 — load the structured CandidateProfile (NO LLM, NO key needed).
 * Step 2 — optionally run one LLM completion through the active provider.
 *
 * Both steps degrade gracefully: a missing CV or an unconfigured/unreachable
 * provider yields a structured error, never a hard crash. Exposed as a CLI
 * script (scripts/smoke.ts) and an API route (app/api/smoke/route.ts).
 */
import { getConfig } from "@/lib/config";
import { getLLMProvider } from "@/lib/llm";
import { loadCandidateProfile, type CandidateProfile } from "@/lib/profile";

export type ProfileSummary = {
  fullName: string;
  headline?: string;
  email?: string;
  location?: string;
  yearsOfExperience?: { cv?: string; linkedin?: string };
  counts: {
    experiences: number;
    formations: number;
    skills: number;
    languages: number;
    publications: number;
  };
  conflicts: { field: string; cv?: string; linkedin?: string; note?: string }[];
};

export function summarizeProfile(p: CandidateProfile): ProfileSummary {
  return {
    fullName: p.contact.fullName,
    headline: p.headline,
    email: p.contact.email,
    location: p.contact.location,
    yearsOfExperience: p.yearsOfExperience,
    counts: {
      experiences: p.experiences.length,
      formations: p.formations.length,
      skills: p.skills.length,
      languages: p.languages.length,
      publications: p.publications.length,
    },
    conflicts: p.conflicts,
  };
}

/** Build a compact, fact-only prompt so the LLM has something real to chew on. */
function oneLinePrompt(p: CandidateProfile): string {
  const langs = p.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(", ");
  const topSkills = p.skills.filter((s) => s.highlighted).map((s) => s.name).slice(0, 6).join(", ");
  return [
    `Nom : ${p.contact.fullName}`,
    p.headline ? `Titre : ${p.headline}` : null,
    `Expériences : ${p.experiences.length} · Formations : ${p.formations.length}`,
    topSkills ? `Compétences clés : ${topSkills}` : null,
    langs ? `Langues : ${langs}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export type SmokeReport = {
  profile:
    | { ok: true; summary: ProfileSummary }
    | { ok: false; error: string };
  llm:
    | { attempted: false; reason: string }
    | { attempted: true; ok: true; provider: string; model?: string; response: string }
    | { attempted: true; ok: false; provider: string; error: string };
};

export async function runSmoke(opts?: { withLLM?: boolean }): Promise<SmokeReport> {
  const withLLM = opts?.withLLM ?? true;

  // --- Step 1: profile (no LLM, no secrets) ---
  let profile: CandidateProfile | null = null;
  const report: SmokeReport = {
    profile: { ok: false, error: "not loaded" },
    llm: { attempted: false, reason: "profile not loaded" },
  };

  try {
    profile = await loadCandidateProfile();
    report.profile = { ok: true, summary: summarizeProfile(profile) };
  } catch (err) {
    report.profile = { ok: false, error: err instanceof Error ? err.message : String(err) };
    report.llm = { attempted: false, reason: "skipped: profile failed to load" };
    return report;
  }

  if (!withLLM) {
    report.llm = { attempted: false, reason: "LLM step disabled" };
    return report;
  }

  // --- Step 2: one LLM completion through the active provider ---
  const cfg = getConfig();
  const providerName = cfg.llmProvider;
  try {
    const provider = getLLMProvider();
    const response = await provider.complete({
      system:
        "Tu es un assistant RH. Résume la candidate en UNE seule phrase en français, " +
        "à partir des faits fournis uniquement. N'invente rien.",
      messages: [{ role: "user", content: oneLinePrompt(profile) }],
      maxTokens: 200,
      temperature: 0.3,
    });
    report.llm = {
      attempted: true,
      ok: true,
      provider: provider.name,
      model:
        providerName === "claude"
          ? cfg.anthropic.model
          : providerName === "claude-code"
            ? cfg.claudeCode.model
            : cfg.ollama.model,
      response,
    };
  } catch (err) {
    report.llm = {
      attempted: true,
      ok: false,
      provider: providerName,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return report;
}
