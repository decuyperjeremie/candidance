/**
 * Runs the LLM adaptation: calls the active provider, parses + validates the
 * returned JSON against ApplicationContent, with one repair retry. Stays within
 * the existing LLMProvider.complete interface (text in / text out).
 */

import { getConfig } from "@/lib/config";
import { getLLMProvider } from "@/lib/llm";
import type { CandidateProfile } from "@/lib/profile";
import type { StoredOffer } from "@/lib/aggregation/store";
import { ApplicationContent } from "./content";
import { buildAdaptationPrompt } from "./prompt";

export class GenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GenerationError";
  }
}

/** Pull a JSON object out of a model response (tolerates ``` fences / prose). */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return candidate.trim();
  return candidate.slice(start, end + 1);
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(extractJson(text)) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type AdaptResult = {
  content: ApplicationContent;
  provider: string;
  model: string;
};

/** Adapt the profile to the offer; validate; one repair retry on bad output. */
export async function adaptApplication(
  profile: CandidateProfile,
  offer: StoredOffer,
): Promise<AdaptResult> {
  const cfg = getConfig();
  const provider = getLLMProvider();
  const model =
    cfg.llmProvider === "claude"
      ? cfg.anthropic.model
      : cfg.llmProvider === "claude-code"
        ? cfg.claudeCode.model
        : cfg.ollama.model;

  const { system, user } = buildAdaptationPrompt(profile, offer);

  const call = (messages: { role: "user" | "assistant"; content: string }[]) =>
    provider.complete({ system, messages, maxTokens: 4000, temperature: 0.4 });

  // First attempt.
  let raw = await call([{ role: "user", content: user }]);
  let parsed = tryParse(raw);
  let validated = parsed.ok ? ApplicationContent.safeParse(parsed.value) : null;

  const issuesText = (v: typeof validated): string =>
    v && !v.success
      ? v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : "structure invalide";

  // One repair retry, feeding back what was wrong.
  if (!parsed.ok || !validated?.success) {
    const why = !parsed.ok ? `JSON invalide: ${parsed.error}` : `Structure invalide: ${issuesText(validated)}`;
    raw = await call([
      { role: "user", content: user },
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `Ta réponse précédente n'était pas exploitable (${why}). Renvoie UNIQUEMENT l'objet JSON valide conforme au schéma, sans texte ni bloc de code.`,
      },
    ]);
    parsed = tryParse(raw);
    validated = parsed.ok ? ApplicationContent.safeParse(parsed.value) : null;
  }

  if (!parsed.ok) {
    throw new GenerationError(`Le modèle n'a pas renvoyé de JSON exploitable. (${parsed.error})`);
  }
  if (!validated?.success) {
    throw new GenerationError(
      `Le JSON renvoyé ne correspond pas au schéma attendu: ${issuesText(validated)}`,
    );
  }

  return { content: validated.data, provider: provider.name, model };
}
